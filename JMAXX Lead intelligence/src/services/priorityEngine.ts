import { supabase } from '../lib/supabase';
import { Lead, LeadClassification } from '../types';
import { generateWhatsAppMessage } from './actionLayer';

export interface PriorityActionItem {
  lead: Lead;
  action: 'call_now' | 'whatsapp_now' | 'contact_today' | 'schedule' | 'review_later';
  urgency: 'immediate' | 'today' | 'week' | 'anytime';
  reason: string;
  whatsappLink?: string;
  emailSubject?: string;
}

export interface AlertNotification {
  id: string;
  leadId: string;
  type: 'hot_detected' | 'high_detected' | 'action_required';
  title: string;
  message: string;
  whatsappLink?: string;
  createdAt: string;
  read: boolean;
}

const PRIORITY_RULES = {
  hot: {
    urgency: 'immediate',
    action: 'contact_today',
    maxResponseMinutes: 30,
  },
  high: {
    urgency: 'today',
    action: 'contact_today',
    maxResponseMinutes: 240,
  },
  medium: {
    urgency: 'week',
    action: 'schedule',
    maxResponseMinutes: 2880,
  },
  low: {
    urgency: 'anytime',
    action: 'review_later',
    maxResponseMinutes: 10080,
  },
};

export async function getPriorityActions(limit: number = 20): Promise<PriorityActionItem[]> {
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .in('status', ['new'])
    .order('score', { ascending: false })
    .limit(limit);

  if (!leads) return [];

  return leads.map((lead) => {
    const classification = lead.classification as LeadClassification || 'low';
    const { urgency, action } = PRIORITY_RULES[classification];

    let whatsappLink: string | undefined;
    let actionReason: string;
    let actionType: PriorityActionItem['action'];

    if (classification === 'hot' && lead.phone) {
      whatsappLink = generateWhatsAppMessage(lead).link;
      actionType = 'whatsapp_now';
      actionReason = `Score ${lead.score}/100 - URGENTE. Contactar ahora para maximizar conversión.`;
    } else if (classification === 'hot') {
      actionType = 'call_now';
      actionReason = `Score ${lead.score}/100 - URGENTE. Llamar inmediatamente.`;
    } else if (classification === 'high' && lead.phone) {
      whatsappLink = generateWhatsAppMessage(lead).link;
      actionType = 'whatsapp_now';
      actionReason = `Score ${lead.score}/100 - Contactar hoy. Alta probabilidad de conversión.`;
    } else if (classification === 'high') {
      actionType = 'contact_today';
      actionReason = `Score ${lead.score}/100 - Contactar hoy por email o teléfono.`;
    } else if (classification === 'medium') {
      actionType = 'schedule';
      actionReason = `Score ${lead.score}/100 - Planificar contacto esta semana.`;
    } else {
      actionType = 'review_later';
      actionReason = `Score ${lead.score}/100 - Baja prioridad. Revisar cuando haya tiempo.`;
    }

    return {
      lead,
      action: actionType,
      urgency,
      reason: actionReason,
      whatsappLink,
    };
  });
}

export async function getHotLeadAlerts(): Promise<AlertNotification[]> {
  const { data: events } = await supabase
    .from('lead_events')
    .select('*, leads(*)')
    .eq('event_type', 'hot_lead_detected')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!events) return [];

  return events.map((event) => {
    const lead = event.leads as Lead;
    let whatsappLink: string | undefined;

    if (lead?.phone) {
      whatsappLink = generateWhatsAppMessage(lead).link;
    }

    return {
      id: event.id,
      leadId: event.lead_id,
      type: 'hot_detected',
      title: `🔥 HOT LEAD: ${lead?.title || 'Sin título'}`,
      message: `Score: ${lead?.score || 0}/100. ${lead?.city || 'Sin ubicación'}. Actuar AHORA.`,
      whatsappLink,
      createdAt: event.created_at,
      read: false,
    };
  });
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await supabase
    .from('lead_events')
    .update({ 'event_data->read': true })
    .eq('id', notificationId);
}

export async function getActionMetrics(): Promise<{
  pendingActions: number;
  hotPending: number;
  highPending: number;
  avgResponseTime: number;
  responseRate: number;
}> {
  const { data: leads } = await supabase
    .from('leads')
    .select('id, classification, status, created_at')
    .in('status', ['new']);

  const pending = leads || [];
  const hotPending = pending.filter((l) => l.classification === 'hot').length;
  const highPending = pending.filter((l) => l.classification === 'high').length;

  const { data: contactedEvents } = await supabase
    .from('lead_events')
    .select('lead_id, created_at, leads!inner(created_at)')
    .in('event_type', ['whatsapp_sent', 'called', 'emailed', 'whatsapp_contact', 'email_sent']);

  let avgResponseTime = 0;
  if (contactedEvents && contactedEvents.length > 0) {
    const responseTimes = contactedEvents.map((e: any) => {
      const eventTime = new Date(e.created_at).getTime();
      const leadTime = new Date(e.leads?.created_at).getTime();
      return (eventTime - leadTime) / 60000;
    });
    avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  }

  const { data: totalCreated } = await supabase
    .from('leads')
    .select('id')
    .not('created_at', 'is', null);

  const responseRate = totalCreated && contactedEvents
    ? (contactedEvents.length / totalCreated.length) * 100
    : 0;

  return {
    pendingActions: pending.length,
    hotPending,
    highPending,
    avgResponseTime: Math.round(avgResponseTime),
    responseRate: Math.round(responseRate),
  };
}

export async function createActionSession(): Promise<{
  sessionDate: string;
  actions: PriorityActionItem[];
  hotAlerts: AlertNotification[];
  metrics: Awaited<ReturnType<typeof getActionMetrics>>;
}> {
  const [actions, hotAlerts, metrics] = await Promise.all([
    getPriorityActions(25),
    getHotLeadAlerts(),
    getActionMetrics(),
  ]);

  return {
    sessionDate: new Date().toISOString(),
    actions,
    hotAlerts,
    metrics,
  };
}