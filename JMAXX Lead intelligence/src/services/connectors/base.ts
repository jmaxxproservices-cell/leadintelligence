import { supabase } from '../../lib/supabase';
import { Lead, LeadClassification, LeadSource } from '../../types';

// Standard normalized lead that ALL connectors must output
export interface NormalizedLead {
  external_id: string;
  external_url: string;
  source: LeadSource | string;
  title: string;
  description: string | null;
  city: string | null;
  canton: string | null;
  service_type: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  price_mentioned: number | null;
  raw_data?: Record<string, unknown>;
}

// Raw lead data from external source (connector-specific format)
export interface RawLeadData {
  id: string;
  [key: string]: unknown;
}

// Result of a fetch operation
export interface FetchResult {
  success: boolean;
  leads: RawLeadData[];
  totalAvailable?: number;
  page?: number;
  hasMore?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Result of an ingest operation
export interface IngestResult {
  connectorId: string;
  connectorName: string;
  fetched: number;
  created: number;
  updated: number;
  duplicates: number;
  invalid: number;
  hotDetected: number;
  leads: Lead[];
  errors: Array<{ external_id: string; error: string }>;
  duration: number;
}

// Connector configuration
export interface ConnectorConfig {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  schedule?: string;
  maxResults?: number;
  filters?: Record<string, unknown>;
  credentials?: Record<string, string>;
  lastRun?: string;
  metadata?: Record<string, unknown>;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Abstract base connector - ALL connectors must extend this
export abstract class BaseConnector {
  public readonly id: string;
  public readonly name: string;
  public readonly type: string;
  public readonly source: LeadSource | string;
  protected config: ConnectorConfig;

  constructor(config: ConnectorConfig) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.config = config;
    this.source = config.type as LeadSource;
  }

  // Abstract methods that MUST be implemented by each connector
  abstract fetch(options?: { page?: number; limit?: number }): Promise<FetchResult>;
  abstract normalize(rawLead: RawLeadData): NormalizedLead;

  // Optional methods with default implementations
  async validate(normalizedLead: NormalizedLead): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!normalizedLead.external_id) {
      errors.push('Missing external_id');
    }

    if (!normalizedLead.title || normalizedLead.title.trim().length < 3) {
      errors.push('Title too short or missing');
    }

    if (!normalizedLead.source) {
      errors.push('Missing source');
    }

    if (!normalizedLead.contact_name && !normalizedLead.phone && !normalizedLead.email) {
      warnings.push('No contact information');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async ingest(options?: {
    skipDuplicates?: boolean;
    autoScore?: boolean;
    generateAlerts?: boolean;
  }): Promise<IngestResult> {
    const startTime = Date.now();
    const result: IngestResult = {
      connectorId: this.id,
      connectorName: this.name,
      fetched: 0,
      created: 0,
      updated: 0,
      duplicates: 0,
      invalid: 0,
      hotDetected: 0,
      leads: [],
      errors: [],
      duration: 0,
    };

    try {
      // Fetch raw leads
      const fetchResult = await this.fetch({
        limit: this.config.maxResults || 50,
      });

      if (!fetchResult.success) {
        result.errors.push({
          external_id: 'fetch',
          error: fetchResult.error || 'Fetch failed',
        });
        return result;
      }

      result.fetched = fetchResult.leads.length;

      // Process each lead
      for (const rawLead of fetchResult.leads) {
        try {
          // Normalize
          const normalized = this.normalize(rawLead);

          // Validate
          const validation = await this.validate(normalized);
          if (!validation.valid) {
            result.invalid++;
            result.errors.push({
              external_id: normalized.external_id,
              error: validation.errors.join(', '),
            });
            continue;
          }

          // Check for duplicates
          const { data: existing } = await supabase
            .from('leads')
            .select('id, score, classification')
            .eq('external_id', normalized.external_id)
            .maybeSingle();

          if (existing) {
            result.duplicates++;
            continue;
          }

          // Insert into database
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
            result.errors.push({
              external_id: normalized.external_id,
              error: error.message,
            });
            continue;
          }

          // Auto-score if enabled
          if (options?.autoScore !== false) {
            await this.scoreLead(newLead, normalized);
          }

          // Check for HOT classification
          if (newLead.classification === 'hot') {
            result.hotDetected++;

            if (options?.generateAlerts !== false) {
              await this.generateAlert(newLead);
            }
          }

          result.created++;
          result.leads.push(newLead);
        } catch (err) {
          const errorMsg = (err as Error).message;
          result.errors.push({
            external_id: rawLead.id || 'unknown',
            error: errorMsg,
          });
        }
      }
    } catch (err) {
      result.errors.push({
        external_id: 'connector',
        error: (err as Error).message,
      });
    }

    result.duration = Date.now() - startTime;

    // Log the ingestion
    await this.logIngestion(result);

    return result;
  }

  // Default scoring implementation
  protected async scoreLead(lead: Lead, normalized: NormalizedLead): Promise<void> {
    const textToAnalyze = [
      normalized.title,
      normalized.description,
      normalized.raw_data?.keywords,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    // Get scoring rules
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

    const classification: LeadClassification =
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
  }

  // Generate alert for HOT lead
  protected async generateAlert(lead: Lead): Promise<void> {
    await supabase.from('lead_events').insert({
      lead_id: lead.id,
      event_type: 'hot_lead_detected',
      event_data: {
        score: lead.score,
        classification: lead.classification,
        connector: this.id,
        connector_type: this.type,
      },
    });
  }

  // Log ingestion to database
  protected async logIngestion(result: IngestResult): Promise<void> {
    await supabase.from('ingestion_logs').insert({
      connector: this.name,
      source: this.source,
      fetched: result.fetched,
      created: result.created,
      duplicates: result.duplicates,
      hot_count: result.hotDetected,
      errors: result.errors.length > 0 ? result.errors.map((e) => e.error) : null,
    });

    // Update last run
    await supabase
      .from('scheduled_ingestions')
      .update({
        last_run_at: new Date().toISOString(),
        last_result: {
          fetched: result.fetched,
          created: result.created,
          hotDetected: result.hotDetected,
          duration: result.duration,
        },
      })
      .eq('connector_type', this.type);
  }

  // Helper: Normalize Swiss phone number
  protected normalizePhone(phone?: string): string | undefined {
    if (!phone) return undefined;
    const cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('+41')) return cleaned;
    if (cleaned.startsWith('0041')) return '+' + cleaned.slice(2);
    if (cleaned.startsWith('0')) return '+41' + cleaned.slice(1);
    return cleaned.startsWith('+') ? cleaned : `+41${cleaned}`;
  }

  // Test connection (optional override)
  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Connection successful' };
  }
}
