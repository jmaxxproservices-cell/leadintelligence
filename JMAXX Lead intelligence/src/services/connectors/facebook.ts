import { BaseConnector, ConnectorConfig, FetchResult, RawLeadData, NormalizedLead } from './base';

// Manual import connector for web forms and direct entry
interface ManualImportConfig extends ConnectorConfig {}

export class ManualImportConnector extends BaseConnector {
  constructor(config: ConnectorConfig) {
    super(config);
  }

  async fetch(options?: { page?: number; limit?: number }): Promise<FetchResult> {
    return {
      success: true,
      leads: [],
      totalAvailable: 0,
      hasMore: false,
    };
  }

  normalize(rawLead: RawLeadData): NormalizedLead {
    return {
      external_id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      external_url: rawLead.url as string || '',
      source: 'manual',
      title: rawLead.title as string || 'Manual lead',
      description: rawLead.description as string || null,
      city: rawLead.city as string || null,
      canton: rawLead.canton as string || null,
      service_type: rawLead.service_type as string || null,
      contact_name: rawLead.contact_name as string || null,
      phone: this.normalizePhone(rawLead.phone as string),
      email: rawLead.email as string || null,
      priority: (rawLead.priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium',
      price_mentioned: null,
      raw_data: rawLead,
    };
  }

  async importLead(data: {
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
    const normalized = this.normalize({
      id: `manual-${Date.now()}`,
      ...data,
    });

    const validation = await this.validate(normalized);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    return { success: true, leadId: normalized.external_id };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Manual import connector ready' };
  }
}

export function createManualImportConnector(config?: Partial<ConnectorConfig>): ManualImportConnector {
  return new ManualImportConnector({
    id: 'manual',
    name: 'Manual Import',
    type: 'manual',
    enabled: true,
    ...config,
  });
}

// Referral connector (for partner referrals)
export class ReferralConnector extends BaseConnector {
  constructor(config: ConnectorConfig) {
    super(config);
  }

  async fetch(options?: { page?: number; limit?: number }): Promise<FetchResult> {
    return {
      success: true,
      leads: [],
      totalAvailable: 0,
      hasMore: false,
    };
  }

  normalize(rawLead: RawLeadData): NormalizedLead {
    return {
      external_id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      external_url: '',
      source: 'referral',
      title: rawLead.title as string || 'Referral lead',
      description: rawLead.description as string || null,
      city: rawLead.city as string || null,
      canton: rawLead.canton as string || null,
      service_type: rawLead.service_type as string || null,
      contact_name: rawLead.contact_name as string || null,
      phone: this.normalizePhone(rawLead.phone as string),
      email: rawLead.email as string || null,
      priority: 'high',
      price_mentioned: null,
      raw_data: rawLead,
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Referral connector ready' };
  }
}

export function createReferralConnector(config?: Partial<ConnectorConfig>): ReferralConnector {
  return new ReferralConnector({
    id: 'referral',
    name: 'Partner Referrals',
    type: 'referral',
    enabled: true,
    ...config,
  });
}

// Legacy exports for backwards compatibility
export { createWebsiteFormConnector } from './website';
export type { WebsiteFormConfig, WebsiteFormSubmission } from './website';
