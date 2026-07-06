import { supabase } from '../lib/supabase';
import { Lead, LeadStatus, ScoringFeedback, RevenueHistory } from '../types';
import { eventSystem } from './eventSystem';

export interface RevenueUpdate {
  leadId: string;
  revenue: number | null;
  currency?: string;
}

export interface CloseLeadResult {
  success: boolean;
  lead: Lead | null;
  feedback: ScoringFeedback | null;
  error?: string;
}

export async function updateLeadRevenue(
  leadId: string,
  revenue: number | null,
  currency: string = 'CHF'
): Promise<{ success: boolean; error?: string }> {
  const { data: oldLead } = await supabase
    .from('leads')
    .select('revenue, status')
    .eq('id', leadId)
    .maybeSingle();

  const { error } = await supabase
    .from('leads')
    .update({
      revenue,
      revenue_currency: currency,
    })
    .eq('id', leadId);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase.from('revenue_history').insert({
    lead_id: leadId,
    old_revenue: oldLead?.revenue,
    new_revenue: revenue,
    old_status: oldLead?.status,
    new_status: oldLead?.status,
    changed_by: 'manual',
  });

  await eventSystem.emit('revenue_updated', {
    leadId,
    metadata: { revenue, currency },
  });

  return { success: true };
}

export async function closeLeadAsWon(
  leadId: string,
  revenue: number
): Promise<CloseLeadResult> {
  const { data: lead, error: fetchError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle();

  if (fetchError || !lead) {
    return { success: false, lead: null, feedback: null, error: fetchError?.message || 'Lead not found' };
  }

  const { error } = await supabase
    .from('leads')
    .update({
      status: 'won',
      revenue,
      revenue_currency: 'CHF',
      closed_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  if (error) {
    return { success: false, lead: null, feedback: null, error: error.message };
  }

  const feedback = await createScoringFeedback(
    leadId,
    lead.score,
    lead.classification || 'medium',
    'won',
    revenue
  );

  await eventSystem.emit('lead_won', {
    leadId,
    metadata: { revenue, closedAt: new Date().toISOString() },
  });

  const { data: updatedLead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle();

  return { success: true, lead: updatedLead, feedback };
}

export async function closeLeadAsLost(
  leadId: string,
  reason?: string
): Promise<CloseLeadResult> {
  const { data: lead, error: fetchError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle();

  if (fetchError || !lead) {
    return { success: false, lead: null, feedback: null, error: fetchError?.message || 'Lead not found' };
  }

  const { error } = await supabase
    .from('leads')
    .update({
      status: 'lost',
      closed_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  if (error) {
    return { success: false, lead: null, feedback: null, error: error.message };
  }

  const feedback = await createScoringFeedback(
    leadId,
    lead.score,
    lead.classification || 'medium',
    'lost',
    null,
    reason
  );

  await eventSystem.emit('lead_lost', {
    leadId,
    metadata: { reason, closedAt: new Date().toISOString() },
  });

  const { data: updatedLead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle();

  return { success: true, lead: updatedLead, feedback };
}

async function createScoringFeedback(
  leadId: string,
  initialScore: number,
  initialClassification: string,
  outcome: 'won' | 'lost',
  revenue: number | null,
  notes?: string
): Promise<ScoringFeedback | null> {
  const isAccurate = evaluatePredictionAccuracy(initialScore, initialClassification, outcome);
  const falsePositive = outcome === 'lost' && ['high', 'hot'].includes(initialClassification);
  const falseNegative = outcome === 'won' && ['low', 'medium'].includes(initialClassification);

  const { data } = await supabase
    .from('scoring_feedback')
    .insert({
      lead_id: leadId,
      initial_score: initialScore,
      initial_classification: initialClassification,
      outcome,
      revenue,
      is_accurate: isAccurate,
      false_positive: falsePositive,
      false_negative: falseNegative,
      feedback_notes: notes,
    })
    .select()
    .maybeSingle();

  return data;
}

function evaluatePredictionAccuracy(
  score: number,
  classification: string,
  outcome: 'won' | 'lost'
): boolean {
  if (outcome === 'won') {
    return score >= 60;
  } else {
    return score < 70;
  }
}

export async function getRevenueHistory(leadId: string): Promise<RevenueHistory[]> {
  const { data } = await supabase
    .from('revenue_history')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  return data || [];
}

export async function getScoringFeedback(): Promise<ScoringFeedback[]> {
  const { data } = await supabase
    .from('scoring_feedback')
    .select('*, leads(title, source)')
    .order('created_at', { ascending: false });

  return data || [];
}

export async function reopenLead(
  leadId: string,
  newStatus: LeadStatus = 'contacted'
): Promise<{ success: boolean; error?: string }> {
  const validStatuses: LeadStatus[] = ['new', 'contacted', 'quoted'];

  if (!validStatuses.includes(newStatus)) {
    return { success: false, error: 'Invalid status for reopening' };
  }

  const { error } = await supabase
    .from('leads')
    .update({
      status: newStatus,
      closed_at: null,
      time_to_close_days: null,
    })
    .eq('id', leadId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
