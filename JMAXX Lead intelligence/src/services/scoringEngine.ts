import { supabase } from '../lib/supabase';
import { Lead } from '../types';

export interface ScoringRule {
  id: string;
  category: string;
  name: string;
  pattern: string;
  score_impact: number;
  is_active: boolean;
  priority: number;
  metadata: Record<string, unknown>;
}

export interface ScoreBreakdown {
  base: number;
  urgency: number;
  intent: number;
  service: number;
  geographic: number;
  total: number;
  matched_rules: Array<{
    category: string;
    name: string;
    impact: number;
  }>;
  detected_signals: string[];
}

export const CLASSIFICATION_THRESHOLDS = {
  hot: 80,
  high: 65,
  medium: 45,
  low: 0,
} as const;

export type Classification = 'low' | 'medium' | 'high' | 'hot';

export async function calculateLeadScore(lead: Partial<Lead>): Promise<ScoreBreakdown> {
  const breakdown: ScoreBreakdown = {
    base: 50,
    urgency: 0,
    intent: 0,
    service: 0,
    geographic: 0,
    total: 50,
    matched_rules: [],
    detected_signals: [],
  };

  const textToAnalyze = [
    lead.title || '',
    lead.description || '',
    lead.notes || '',
  ].join(' ').toLowerCase();

  const { data: rules } = await supabase
    .from('scoring_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (!rules || rules.length === 0) {
    breakdown.total = breakdown.base;
    return breakdown;
  }

  for (const rule of rules) {
    const matched = matchRule(rule, lead, textToAnalyze);
    if (matched) {
      const category = rule.category as keyof Pick<ScoreBreakdown, 'urgency' | 'intent' | 'service' | 'geographic'>;

      if (category === 'urgency' || category === 'intent' || category === 'service' || category === 'geographic') {
        breakdown[category] += rule.score_impact;
      }

      breakdown.matched_rules.push({
        category: rule.category,
        name: rule.name,
        impact: rule.score_impact,
      });

      if (rule.category === 'urgency' || rule.category === 'intent') {
        breakdown.detected_signals.push(`${rule.category}:${rule.name}`);
      }
    }
  }

  breakdown.total = Math.min(100, Math.max(0,
    breakdown.base +
    breakdown.urgency +
    breakdown.intent +
    breakdown.service +
    breakdown.geographic
  ));

  return breakdown;
}

function matchRule(rule: ScoringRule, lead: Partial<Lead>, text: string): boolean {
  const matchType = rule.metadata?.match_type as string;
  const pattern = rule.pattern.toLowerCase();

  switch (matchType) {
    case 'keyword':
      return text.includes(pattern);

    case 'service_type':
      return (lead.service_type?.toLowerCase() || '').includes(pattern) ||
             text.includes(pattern);

    case 'city':
      return (lead.city?.toLowerCase() || '').includes(pattern);

    case 'canton':
      return (lead.canton?.toLowerCase() || '') === pattern.toLowerCase();

    default:
      return text.includes(pattern);
  }
}

export function getClassification(score: number): Classification {
  if (score >= CLASSIFICATION_THRESHOLDS.hot) return 'hot';
  if (score >= CLASSIFICATION_THRESHOLDS.high) return 'high';
  if (score >= CLASSIFICATION_THRESHOLDS.medium) return 'medium';
  return 'low';
}

export async function updateLeadScore(leadId: string): Promise<{
  score: number;
  classification: Classification;
  breakdown: ScoreBreakdown;
}> {
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle();

  if (!lead) {
    throw new Error('Lead not found');
  }

  const breakdown = await calculateLeadScore(lead);
  const classification = getClassification(breakdown.total);
  const urgencyDetected = breakdown.urgency > 0;
  const intentSignals = breakdown.detected_signals
    .filter(s => s.startsWith('intent:'))
    .map(s => s.replace('intent:', ''));

  await supabase
    .from('leads')
    .update({
      score: breakdown.total,
      classification,
      score_breakdown: breakdown,
      last_scored_at: new Date().toISOString(),
      urgency_detected: urgencyDetected,
      intent_signals: intentSignals,
    })
    .eq('id', leadId);

  return {
    score: breakdown.total,
    classification,
    breakdown,
  };
}

export async function recalculateAllScores(): Promise<void> {
  const { data: leads } = await supabase
    .from('leads')
    .select('id');

  if (!leads) return;

  for (const lead of leads) {
    await updateLeadScore(lead.id);
  }
}

export async function getScoringRules(): Promise<ScoringRule[]> {
  const { data } = await supabase
    .from('scoring_rules')
    .select('*')
    .order('category')
    .order('priority', { ascending: false });

  return data || [];
}

export async function createScoringRule(
  rule: Omit<ScoringRule, 'id'>
): Promise<ScoringRule | null> {
  const { data } = await supabase
    .from('scoring_rules')
    .insert(rule)
    .select()
    .single();

  return data;
}

export async function updateScoringRule(
  id: string,
  updates: Partial<ScoringRule>
): Promise<ScoringRule | null> {
  const { data } = await supabase
    .from('scoring_rules')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  return data;
}
