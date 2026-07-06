import { connectorRegistry } from './registry';
import { IngestResult, NormalizedLead, RawLeadData } from './base';
import { supabase } from '../../lib/supabase';

// Initialize the registry on first use
let registryInitialized = false;

async function ensureRegistry(): Promise<void> {
  if (!registryInitialized) {
    await connectorRegistry.initialize();
    registryInitialized = true;
  }
}

// Run all connectors
export async function runAllConnectors(options?: {
  skipDuplicates?: boolean;
  autoScore?: boolean;
  generateAlerts?: boolean;
}): Promise<IngestResult[]> {
  await ensureRegistry();
  return connectorRegistry.runAllIngestions(options);
}

// Run a specific connector
export async function runConnector(
  connectorId: string,
  options?: {
    skipDuplicates?: boolean;
    autoScore?: boolean;
    generateAlerts?: boolean;
  }
): Promise<IngestResult | null> {
  await ensureRegistry();
  return connectorRegistry.runIngestion(connectorId, options);
}

// Import a lead manually (for manual connector)
export async function importManualLead(data: {
  title: string;
  description?: string;
  city?: string;
  canton?: string;
  service_type?: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
}): Promise<{ success: boolean; leadId?: string; error?: string }> {
  await ensureRegistry();

  // Normalize to standard format
  const normalized: NormalizedLead = {
    external_id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    external_url: '',
    source: 'manual',
    title: data.title,
    description: data.description || null,
    city: data.city || null,
    canton: data.canton || null,
    service_type: data.service_type || null,
    contact_name: data.contact_name || null,
    phone: data.phone ? normalizePhone(data.phone) : null,
    email: data.email || null,
    priority: data.priority || 'medium',
    price_mentioned: null,
  };

  // Validate
  if (!normalized.title || normalized.title.trim().length < 3) {
    return { success: false, error: 'Title is required' };
  }

  try {
    // Insert directly
    const { data: newLead, error } = await supabase
      .from('leads')
      .insert({
        ...normalized,
        status: 'new',
        score: 50,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Score the lead
    await scoreLead(newLead);

    return { success: true, leadId: newLead.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// Process a webhook from website
export async function processWebsiteWebhook(
  data: Record<string, unknown>
): Promise<{ success: boolean; leadId?: string; error?: string }> {
  await ensureRegistry();

  const normalized: NormalizedLead = {
    external_id: `web-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    external_url: '',
    source: 'website',
    title: (data.title as string) || (data.subject as string) || 'Website inquiry',
    description: (data.message as string) || (data.description as string) || null,
    city: (data.city as string) || null,
    canton: (data.canton as string) || null,
    service_type: (data.service as string) || (data.service_type as string) || null,
    contact_name: (data.name as string) || (data.contact_name as string) || null,
    phone: normalizePhone(data.phone as string),
    email: (data.email as string) || null,
    priority: 'medium',
    price_mentioned: null,
  };

  // Validate
  if (!normalized.title && !normalized.contact_name) {
    return { success: false, error: 'Missing required fields' };
  }

  try {
    const { data: newLead, error } = await supabase
      .from('leads')
      .insert({
        ...normalized,
        status: 'new',
        score: 50,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await scoreLead(newLead);

    return { success: true, leadId: newLead.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// Get connector status
export async function getConnectorsStatus(): Promise<
  Array<{
    id: string;
    name: string;
    type: string;
    enabled: boolean;
    lastRun: string | null;
    status: 'active' | 'inactive' | 'error';
  }>
> {
  await ensureRegistry();
  return connectorRegistry.getConnectorStatus();
}

// Test a connector
export async function testConnector(
  connectorId: string
): Promise<{ success: boolean; message: string }> {
  await ensureRegistry();
  return connectorRegistry.testConnector(connectorId);
}

// Enable/disable a connector
export async function setConnectorEnabled(
  connectorId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('scheduled_ingestions')
      .update({ is_active: enabled })
      .eq('id', connectorId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Reload registry
    connectorRegistry.clear();
    registryInitialized = false;
    await ensureRegistry();

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// Scoring helper
async function scoreLead(lead: any): Promise<void> {
  const textToAnalyze = [
    lead.title,
    lead.description,
    lead.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const { data: rules } = await supabase
    .from('scoring_rules')
    .select('*')
    .eq('is_active', true);

  let urgency = 0;
  let intent = 0;
  let service = 0;
  let geographic = 0;

  if (rules) {
    for (const rule of rules) {
      if (textToAnalyze.includes(rule.pattern.toLowerCase())) {
        switch (rule.category) {
          case 'urgency':
            urgency += rule.score_impact;
            break;
          case 'intent':
            intent += rule.score_impact;
            break;
          case 'service':
            service += rule.score_impact;
            break;
          case 'geographic':
            geographic += rule.score_impact;
            break;
        }
      }
    }
  }

  const baseScore = 50;
  const total = Math.min(100, Math.max(0, baseScore + urgency + intent + service + geographic));

  const classification =
    total >= 80 ? 'hot' : total >= 65 ? 'high' : total >= 45 ? 'medium' : 'low';

  await supabase
    .from('leads')
    .update({
      score: total,
      classification,
      urgency_detected: urgency > 0,
      last_scored_at: new Date().toISOString(),
    })
    .eq('id', lead.id);

  if (classification === 'hot') {
    await supabase.from('lead_events').insert({
      lead_id: lead.id,
      event_type: 'hot_lead_detected',
      event_data: {
        score: total,
        classification,
        source: lead.source,
      },
    });
  }
}

// Phone normalization helper
function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+41')) return cleaned;
  if (cleaned.startsWith('0041')) return '+' + cleaned.slice(2);
  if (cleaned.startsWith('0')) return '+41' + cleaned.slice(1);
  return cleaned.startsWith('+') ? cleaned : `+41${cleaned}`;
}
