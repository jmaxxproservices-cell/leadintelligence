import { supabase } from '../lib/supabase';
import { Lead, LeadStatus } from '../types';
import { Activity } from '../types';
import { processNewLead, updateLeadScore, markLeadAsHot as markHot } from './eventSystem';

export async function getLeads(
  filters?: {
    status?: LeadStatus;
    source?: string;
    priority?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: Lead[] | null; error: string | null; count?: number }> {
  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.source) {
    query = query.eq('source', filters.source);
  }
  if (filters?.priority) {
    query = query.eq('priority', filters.priority);
  }
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null, count };
}

export async function getLeadById(id: string): Promise<{ data: Lead | null; error: string | null }> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function createLead(
  lead: Partial<Lead>
): Promise<{ data: Lead | null; error: string | null }> {
  const { data, error } = await supabase
    .from('leads')
    .insert({
      ...lead,
      status: lead.status || 'new',
      priority: lead.priority || 'medium',
      score: lead.score || 50,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  await processNewLead(data);

  return { data, error: null };
}

export async function updateLead(
  id: string,
  updates: Partial<Lead>
): Promise<{ data: Lead | null; error: string | null }> {
  const { data: oldLead } = await supabase
    .from('leads')
    .select('status, priority, score')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  if (oldLead && oldLead.status !== updates.status) {
    await logActivity(id, 'status_changed', `Estado cambiado a ${updates.status}`,
      `De ${oldLead.status} a ${updates.status}`);
  }
  if (updates.priority && oldLead?.priority !== updates.priority) {
    await logActivity(id, 'priority_changed', `Prioridad cambiada a ${updates.priority}`,
      `De ${oldLead.priority} a ${updates.priority}`);
  }
  if (updates.score !== undefined && oldLead?.score !== updates.score) {
    await logActivity(id, 'score_updated', `Score actualizado a ${updates.score}`,
      `De ${oldLead.score} a ${updates.score}`);
  }

  return { data, error: null };
}

export async function deleteLead(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('leads').delete().eq('id', id);

  return { error: error?.message || null };
}

export async function getLeadStats(): Promise<{
  data: {
    new: number;
    in_review: number;
    contacted: number;
    quote_sent: number;
    won: number;
    lost: number;
    total: number;
    hot: number;
    high: number;
    medium: number;
    low: number;
  } | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('leads')
    .select('status, classification');

  if (error) {
    return { data: null, error: error.message };
  }

  const stats = {
    new: 0,
    in_review: 0,
    contacted: 0,
    quote_sent: 0,
    won: 0,
    lost: 0,
    total: data.length,
    hot: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  data.forEach((item) => {
    stats[item.status as LeadStatus]++;
    if (item.classification) {
      stats[item.classification as keyof typeof stats]++;
    }
  });

  return { data: stats, error: null };
}

export async function markLeadAsHot(leadId: string): Promise<{ error: string | null }> {
  try {
    await markHot(leadId);
    return { error: null };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function recalculateLeadScore(leadId: string): Promise<{ score: number; error: string | null }> {
  try {
    const result = await updateLeadScore(leadId);
    return { score: result.score, error: null };
  } catch (err) {
    return { score: 0, error: (err as Error).message };
  }
}

async function logActivity(
  leadId: string,
  type: string,
  title: string,
  description?: string
): Promise<void> {
  await supabase.from('activities').insert({
    lead_id: leadId,
    type,
    title,
    description,
  });
}

export async function getActivities(
  leadId: string
): Promise<{ data: Activity[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function addNote(
  leadId: string,
  note: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('activities').insert({
    lead_id: leadId,
    type: 'note_added',
    title: 'Nueva nota',
    description: note,
  });

  return { error: error?.message || null };
}
