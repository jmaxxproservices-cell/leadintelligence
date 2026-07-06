import { supabase } from '../lib/supabase';
import { ExternalLead, NormalizedLead, ILeadConnector } from './connectors';
import { processNewLead } from './eventSystem';
import { generateWhatsAppMessage } from './actionLayer';
import { Lead, LeadClassification } from '../types';

export interface IngestionResult {
  connector: string;
  fetched: number;
  created: number;
  duplicates: number;
  hotLeads: HotLeadsResult[];
  errors: string[];
}

export interface HotLeadsResult {
  leadId: string;
  title: string;
  score: number;
  phone: string | null;
  whatsappLink: string | null;
  detectedAt: string;
}

export interface PriorityAction {
  leadId: string;
  priority: 'now' | 'today' | 'review' | 'ignore';
  classification: LeadClassification;
  score: number;
  recommendedAction: string;
  whatsappLink?: string;
}

export async function ingestLeadsFromConnector(
  connector: ILeadConnector,
  options?: {
    skipExisting?: boolean;
    autoScore?: boolean;
    generateAlerts?: boolean;
  }
): Promise<IngestionResult> {
  const result: IngestionResult = {
    connector: connector.name,
    fetched: 0,
    created: 0,
    duplicates: 0,
    hotLeads: [],
    errors: [],
  };

  try {
    const externalLeads = await connector.fetchLeads();
    result.fetched = externalLeads.length;

    for (const externalLead of externalLeads) {
      try {
        if (!connector.validate(normalizedPartial)) {
          continue;
        }

        const normalized = connector.normalize(externalLead);

        const { data: existing } = await supabase
          .from('leads')
          .select('id')
          .eq('external_id', normalized.external_id)
          .maybeSingle();

        if (existing) {
          result.duplicates++;
          continue;
        }

        const { data: newLead, error } = await supabase
          .from('leads')
          .insert({
            ...normalized,
            status: 'new',
          })
          .select()
          .single();

        if (error) {
          result.errors.push(`Failed to create lead: ${error.message}`);
          continue;
        }

        result.created++;

        const processed = await processNewLead(newLead);

        if (options?.generateAlerts && processed.classification === 'hot') {
          const hotResult = await generateHotLeadAlert(newLead);
          result.hotLeads.push(hotResult);
        }
      } catch (err) {
        result.errors.push(`Error processing lead: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    result.errors.push(`Connector error: ${(err as Error).message}`);
  }

  await supabase.from('ingestion_logs').insert({
    connector: connector.name,
    source: connector.source,
    fetched: result.fetched,
    created: result.created,
    duplicates: result.duplicates,
    hot_count: result.hotLeads.length,
    errors: result.errors.length > 0 ? result.errors : null,
  });

  return result;
}

async function generateHotLeadAlert(lead: Lead): Promise<HotLeadsResult> {
  let whatsappLink: string | null = null;

  if (lead.phone) {
    const waMessage = generateWhatsAppMessage(lead);
    whatsappLink = waMessage.link;
  }

  await supabase.from('lead_events').insert({
    lead_id: lead.id,
    event_type: 'hot_lead_detected',
    event_data: {
      score: lead.score,
      classification: lead.classification,
      whatsapp_generated: !!whatsappLink,
    },
  });

  return {
    leadId: lead.id,
    title: lead.title,
    score: lead.score,
    phone: lead.phone,
    whatsappLink,
    detectedAt: new Date().toISOString(),
  };
}

export async function getPriorityActions(): Promise<PriorityAction[]> {
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .in('status', ['new', 'contacted', 'quoted'])
    .order('score', { ascending: false });

  if (!leads) return [];

  return leads.map((lead) => {
    const classification = lead.classification as LeadClassification;
    let priority: 'now' | 'today' | 'review' | 'ignore';
    let recommendedAction: string;

    const waLink = lead.phone ? generateWhatsAppMessage(lead).link : undefined;

    switch (classification) {
      case 'hot':
        priority = 'now';
        recommendedAction = 'Contactar inmediatamente. Score alto + señales de urgencia.';
        break;
      case 'high':
        priority = 'today';
        recommendedAction = 'Contactar hoy. Alto potencial de conversión.';
        break;
      case 'medium':
        priority = 'review';
        recommendedAction = 'Revisar y priorizar según disponibilidad.';
        break;
      default:
        priority = 'ignore';
        recommendedAction = 'Bajo potencial. Revisar solo si hay tiempo libre.';
    }

    return {
      leadId: lead.id,
      priority,
      classification,
      score: lead.score,
      recommendedAction,
      whatsappLink: classification === 'hot' || classification === 'high' ? waLink : undefined,
    };
  });
}

export async function getHotLeadsToday(): Promise<Lead[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('leads')
    .select('*')
    .eq('classification', 'hot')
    .in('status', ['new', 'contacted', 'quoted'])
    .gte('created_at', today.toISOString())
    .order('score', { ascending: false });

  return data || [];
}

export async function markLeadContacted(leadId: string, method: 'whatsapp' | 'phone' | 'email'): Promise<void> {
  await supabase
    .from('leads')
    .update({ status: 'contacted' })
    .eq('id', leadId);

  await supabase.from('lead_events').insert({
    lead_id: leadId,
    event_type: method === 'whatsapp' ? 'whatsapp_contact' : method === 'email' ? 'email_sent' : 'called',
    event_data: { method },
  });
}
