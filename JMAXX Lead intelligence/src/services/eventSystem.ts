import { supabase } from '../lib/supabase';
import { Lead } from '../types';
import { calculateLeadScore, getClassification, ScoreBreakdown, Classification, updateLeadScore as calculateAndUpdateScore } from './scoringEngine';

export { calculateAndUpdateScore as updateLeadScore };

export type LeadEventType =
  | 'lead_created'
  | 'score_calculated'
  | 'lead_classified'
  | 'status_changed'
  | 'priority_changed'
  | 'contact_attempted'
  | 'whatsapp_sent'
  | 'email_sent'
  | 'quote_created'
  | 'marked_hot'
  | 'note_added';

export interface LeadEvent {
  id: string;
  lead_id: string;
  event_type: LeadEventType | string;
  event_data: Record<string, unknown>;
  source: string;
  created_at: string;
}

export interface EventPayload {
  leadId: string;
  lead?: Lead;
  score?: number;
  classification?: Classification;
  breakdown?: ScoreBreakdown;
  previousStatus?: string;
  newStatus?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

class EventSystem {
  private handlers: Map<string, Array<(payload: EventPayload) => Promise<void>>> = new Map();

  on(event: LeadEventType, handler: (payload: EventPayload) => Promise<void>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  async emit(eventType: LeadEventType, payload: EventPayload): Promise<void> {
    await this.recordEvent(eventType, payload);

    const handlers = this.handlers.get(eventType) || [];
    for (const handler of handlers) {
      await handler(payload);
    }
  }

  private async recordEvent(eventType: string, payload: EventPayload): Promise<void> {
    await supabase.from('lead_events').insert({
      lead_id: payload.leadId,
      event_type: eventType,
      event_data: {
        ...payload.metadata,
        score: payload.score,
        classification: payload.classification,
        message: payload.message,
      },
      source: 'system',
    });
  }

  async getLeadEvents(leadId: string): Promise<LeadEvent[]> {
    const { data } = await supabase
      .from('lead_events')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    return data || [];
  }
}

export const eventSystem = new EventSystem();

export async function processNewLead(lead: Lead): Promise<{
  score: number;
  classification: Classification;
  breakdown: ScoreBreakdown;
}> {
  await eventSystem.emit('lead_created', { leadId: lead.id, lead });

  const breakdown = await calculateLeadScore(lead);
  const score = breakdown.total;
  const classification = getClassification(score);

  await supabase
    .from('leads')
    .update({
      score,
      classification,
      score_breakdown: breakdown,
      last_scored_at: new Date().toISOString(),
      urgency_detected: breakdown.urgency > 0,
    })
    .eq('id', lead.id);

  await eventSystem.emit('score_calculated', {
    leadId: lead.id,
    score,
    breakdown,
  });

  await eventSystem.emit('lead_classified', {
    leadId: lead.id,
    classification,
    score,
  });

  return { score, classification, breakdown };
}

export async function markLeadAsHot(leadId: string): Promise<void> {
  await supabase
    .from('leads')
    .update({
      classification: 'hot',
      priority: 'urgent',
      score: 95,
    })
    .eq('id', leadId);

  await eventSystem.emit('marked_hot', {
    leadId,
    metadata: { manually_set: true },
  });
}

export async function recordContactAttempt(
  leadId: string,
  method: 'whatsapp' | 'email' | 'phone'
): Promise<void> {
  const eventType: LeadEventType = method === 'whatsapp' ? 'whatsapp_sent' :
                                      method === 'email' ? 'email_sent' :
                                      'contact_attempted';

  await eventSystem.emit(eventType, {
    leadId,
    metadata: { method },
  });
}
