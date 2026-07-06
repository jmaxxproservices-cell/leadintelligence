import { supabase } from '../../lib/supabase';
import { BaseConnector, ConnectorConfig, FetchResult, RawLeadData, NormalizedLead, IngestResult } from './base';
import { Lead } from '../../types';

// Website form submission data structure
export interface WebsiteFormSubmission {
  name: string;
  phone: string;
  email?: string;
  city: string;
  service?: string;
  message?: string;
  // Metadata
  form_id?: string;
  timestamp?: string;
  ip_address?: string;
  user_agent?: string;
}

// Connector config for website forms
export interface WebsiteFormConfig extends ConnectorConfig {
  formIds?: string[];
  allowedOrigins?: string[];
}

/**
 * Production Website Form Connector
 * Handles form submissions from jmaxxproservices.com
 */
export class WebsiteFormConnector extends BaseConnector {
  declare protected config: WebsiteFormConfig;

  constructor(config: WebsiteFormConfig) {
    super({
      ...config,
      id: 'website',
      name: 'Website Forms',
      type: 'website',
    });
  }

  async fetch(options?: { page?: number; limit?: number }): Promise<FetchResult> {
    // Website forms push leads via webhook, not pull
    return {
      success: true,
      leads: [],
      totalAvailable: 0,
      hasMore: false,
    };
  }

  normalize(rawLead: RawLeadData): NormalizedLead {
    const data = rawLead as unknown as WebsiteFormSubmission;

    return {
      external_id: `web-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      external_url: 'https://jmaxxproservices.com',
      source: 'website',
      title: this.generateTitle(data),
      description: data.message || null,
      city: data.city || null,
      canton: null, // Will be inferred from city if possible
      service_type: data.service || null,
      contact_name: data.name || null,
      phone: this.normalizeSwissPhone(data.phone),
      email: data.email || null,
      priority: 'high', // Website leads have higher intent
      price_mentioned: null,
      raw_data: rawLead,
    };
  }

  /**
   * Generate a descriptive title for the lead
   */
  private generateTitle(data: WebsiteFormSubmission): string {
    const parts: string[] = [];

    if (data.service) {
      parts.push(data.service);
    } else {
      parts.push('Website inquiry');
    }

    if (data.city) {
      parts.push(`in ${data.city}`);
    }

    if (data.name) {
      parts.push(`from ${data.name}`);
    }

    return parts.join(' ') || 'Website Form Submission';
  }

  /**
   * Normalize Swiss phone numbers to +41 format
   */
  protected normalizeSwissPhone(phone?: string): string | null {
    if (!phone) return null;

    // Remove all non-digit characters except + and leading zeros
    let cleaned = phone.replace(/[^\d+]/g, '').trim();

    // If empty after cleaning, return null
    if (!cleaned || cleaned.length < 4) return null;

    // Already in international format with +41
    if (cleaned.startsWith('+41')) {
      // Validate length (Swiss mobile: +41 7X XXX XX XX, landline: +41 X XXX XX XX)
      const digits = cleaned.replace('+', '');
      if (digits.length === 11 || digits.length === 12) {
        return cleaned;
      }
      return null;
    }

    // With 0041 prefix
    if (cleaned.startsWith('0041')) {
      const rest = cleaned.slice(4);
      // Remove leading zero or 7 after 0041
      const normalized = '+41' + (rest.startsWith('0') ? rest.slice(1) : rest);
      if (normalized.length >= 12 && normalized.length <= 13) {
        return normalized;
      }
      return null;
    }

    // With leading 0 (national format like 079 123 45 67)
    if (cleaned.startsWith('0')) {
      // Swiss numbers are typically 10-11 digits with leading 0
      const digits = cleaned.slice(1); // Remove leading 0
      const normalized = '+41' + digits;
      if (normalized.length >= 12 && normalized.length <= 13) {
        return normalized;
      }
    }

    // Without any prefix, assume Swiss number
    if (cleaned.length === 9 || cleaned.length === 10) {
      // Swiss mobile: 79 123 45 67 (9 digits after country)
      const normalized = '+41' + (cleaned.length === 9 ? cleaned : cleaned);
      if (normalized.length === 12 || normalized.length === 13) {
        return normalized;
      }
    }

    // If it starts with +, leave it as is (international non-Swiss)
    if (phone.includes('+')) {
      return phone.replace(/[^\d+]/g, '');
    }

    return null;
  }

  /**
   * Check for duplicate submissions within time window
   */
  async checkDuplicate(
    email?: string,
    phone?: string,
    windowMinutes: number = 10
  ): Promise<{ isDuplicate: boolean; existingLeadId?: string }> {
    if (!email && !phone) {
      return { isDuplicate: false };
    }

    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    // Check by email
    if (email) {
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('email', email.toLowerCase())
        .gte('created_at', windowStart.toISOString())
        .maybeSingle();

      if (existing) {
        return { isDuplicate: true, existingLeadId: existing.id };
      }
    }

    // Check by phone
    if (phone) {
      const normalizedPhone = this.normalizeSwissPhone(phone);
      if (normalizedPhone) {
        const { data: existing } = await supabase
          .from('leads')
          .select('id')
          .eq('phone', normalizedPhone)
          .gte('created_at', windowStart.toISOString())
          .maybeSingle();

        if (existing) {
          return { isDuplicate: true, existingLeadId: existing.id };
        }
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Process a form submission through the full pipeline
   * This is the main entry point for webhook processing
   */
  async ingestFromWebhook(submission: WebsiteFormSubmission): Promise<IngestResult> {
    const startTime = Date.now();
    const result: IngestResult = {
      connectorId: this.id,
      connectorName: this.name,
      fetched: 1,
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
      // Normalize the submission
      const normalized = this.normalize({
        id: `webhook-${Date.now()}`,
        ...submission,
      });

      // Validate
      const validation = await this.validate(normalized);
      if (!validation.valid) {
        result.invalid++;
        result.errors.push({
          external_id: normalized.external_id,
          error: validation.errors.join(', '),
        });
        return result;
      }

      // Check for duplicates within 10 minutes
      const duplicateCheck = await this.checkDuplicate(
        submission.email,
        submission.phone,
        10
      );

      if (duplicateCheck.isDuplicate) {
        result.duplicates++;
        result.errors.push({
          external_id: normalized.external_id,
          error: 'Duplicate submission within 10 minutes',
        });

        // Log duplicate event
        if (duplicateCheck.existingLeadId) {
          await supabase.from('lead_events').insert({
            lead_id: duplicateCheck.existingLeadId,
            event_type: 'duplicate_submission',
            event_data: {
              source: 'website',
              phone: normalized.phone,
              email: normalized.email,
              submitted_at: new Date().toISOString(),
            },
          });
        }

        return result;
      }

      // Infer canton from city if possible
      const canton = await this.inferCanton(normalized.city);

      // Insert the lead
      const { data: newLead, error } = await supabase
        .from('leads')
        .insert({
          ...normalized,
          canton,
          status: 'new',
          score: 50,
          classification: 'medium',
        })
        .select()
        .single();

      if (error || !newLead) {
        result.errors.push({
          external_id: normalized.external_id,
          error: error?.message || 'Insert failed',
        });
        return result;
      }

      // Run scoring pipeline
      await this.scoreLead(newLead, normalized);

      // Generate WhatsApp action data
      await this.generateWhatsAppAction(newLead);

      // Log creation event
      await supabase.from('lead_events').insert({
        lead_id: newLead.id,
        event_type: 'created',
        event_data: {
          connector: 'website',
          source: 'jmaxxproservices.com',
          form_data: {
            name: submission.name,
            service: submission.service,
            city: submission.city,
          },
          raw_submission: submission,
        },
      });

      // Refetch to get updated classification
      const { data: refreshedLead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', newLead.id)
        .single();

      const finalLead = refreshedLead || newLead;

      // Check for HOT classification
      if (finalLead.classification === 'hot') {
        result.hotDetected++;

        // Generate alert
        await this.generateAlert(finalLead);

        // Create notification
        await supabase.from('notifications').insert({
          type: 'hot_lead',
          title: 'HOT Lead from Website!',
          message: `${finalLead.title} - Score: ${finalLead.score}`,
          priority: 'high',
          data: {
            lead_id: finalLead.id,
            score: finalLead.score,
            source: 'website',
          },
        });
      }

      result.created++;
      result.leads.push(finalLead);

      // Log success
      console.log(`[WebsiteConnector] Lead created: ${finalLead.id} (${finalLead.classification})`);
    } catch (err) {
      result.errors.push({
        external_id: 'webhook',
        error: (err as Error).message,
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Infer canton from city using geolocation or known data
   */
  private async inferCanton(city: string | null): Promise<string | null> {
    if (!city) return null;

    // Known Swiss cities to canton mapping
    const cityToCanton: Record<string, string> = {
      zurich: 'ZH', 'zürich': 'ZH',
      geneva: 'GE', genève: 'GE', geneve: 'GE',
      basel: 'BS', bale: 'BS', bâle: 'BS',
      lausanne: 'VD',
      bern: 'BE', berne: 'BE',
      luzern: 'LU', lucerne: 'LU',
      stgallen: 'SG', 'st. gallen': 'SG',
      lugano: 'TI',
      winterthur: 'ZH',
      biel: 'BE', bienne: 'BE', 'biel/bienne': 'BE',
      thun: 'BE',
      köniz: 'BE',
      'la chaux-de-fonds': 'NE',
      fribourg: 'FR', freiburg: 'FR',
      schaffhausen: 'SH',
      chur: 'GR',
      neuchtel: 'NE', 'neuchâtel': 'NE',
      uster: 'ZH',
      emmen: 'LU',
      zug: 'ZG',
      yverdon: 'VD',
      davo: 'VD', davos: 'GR',
      kriens: 'LU',
      renens: 'VD',
      bulle: 'FR',
      allschwil: 'BL',
      montreux: 'VD',
      baden: 'AG',
      olten: 'SO',
      wetzikon: 'ZH',
      frauenfeld: 'TG',
      aarau: 'AG',
      bellinzona: 'TI',
      nyon: 'VD',
      vernier: 'GE',
      meyrin: 'GE',
      carouge: 'GE',
      spreitenbach: 'AG',
      dietikon: 'ZH',
      baar: 'ZG',
      cham: 'ZG',
      adliswil: 'ZH',
      ammerswil: 'AG',
      opfikon: 'ZH',
      wallisellen: 'ZH',
      regensdorf: 'ZH',
      steffisburg: 'BE',
      langenthal: 'BE',
      solothurn: 'SO',
      rheinfelden: 'AG',
      muttenz: 'BL',
      lyssach: 'BE',
      giswil: 'OW', sarnen: 'OW',
      altdorf: 'UR',
      hergiswil: 'NW', stans: 'NW',
      grenchen: 'SO',
      vevey: 'VD',
      martigny: 'VS', sion: 'VS', brig: 'VS', visp: 'VS',
    };

    const normalized = city.toLowerCase().trim();

    // Direct match
    if (cityToCanton[normalized]) {
      return cityToCanton[normalized];
    }

    // Partial match
    for (const [cityName, canton] of Object.entries(cityToCanton)) {
      if (normalized.includes(cityName) || cityName.includes(normalized)) {
        return canton;
      }
    }

    return null;
  }

  /**
   * Generate WhatsApp quick action for the lead
   */
  private async generateWhatsAppAction(lead: Lead): Promise<void> {
    if (!lead.phone) return;

    // Create a suggested message based on service type
    const serviceMessage = lead.service_type
      ? `besoin de ${lead.service_type}`
      : 'votre demande';

    const message = encodeURIComponent(
      `Bonjour ${lead.contact_name || ''}, Je vous contacte concernant ${serviceMessage} soumise via notre site web. Quand seriez-vous disponible pour en discuter?`
    );

    const phone = lead.phone.replace(/[^0-9]/g, '');

    // Store WhatsApp action in lead events for quick access
    await supabase.from('lead_events').insert({
      lead_id: lead.id,
      event_type: 'whatsapp_action_ready',
      event_data: {
        phone,
        message: decodeURIComponent(message),
        whatsapp_url: `https://wa.me/${phone}?text=${message}`,
      },
    });
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    // Test by checking database connection
    try {
      const { error } = await supabase.from('leads').select('id').limit(1);
      if (error) {
        return { success: false, message: `Database error: ${error.message}` };
      }
      return { success: true, message: 'Website form connector ready - webhook endpoint active' };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }
}

/**
 * Factory function to create the website form connector
 */
export function createWebsiteFormConnector(config?: Partial<WebsiteFormConfig>): WebsiteFormConnector {
  return new WebsiteFormConnector({
    id: 'website',
    name: 'Website Forms',
    type: 'website',
    enabled: true,
    ...config,
  });
}

export default WebsiteFormConnector;
