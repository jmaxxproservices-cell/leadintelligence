import { BaseConnector, ConnectorConfig, FetchResult, RawLeadData, NormalizedLead } from './base';

interface HomegateRawLead extends RawLeadData {
  id: string;
  title: string;
  description?: string;
  propertyType?: string;
  location?: string;
  canton?: string;
  price?: string;
  postedAt?: string;
  url: string;
  contactName?: string;
  contactPhone?: string;
}

interface HomegateConnectorConfig extends ConnectorConfig {
  propertyTypes?: ('apartment' | 'house' | 'renovation')[];
  regions?: string[];
}

export class HomegateConnector extends BaseConnector {
  declare protected config: HomegateConnectorConfig;

  constructor(config: HomegateConnectorConfig) {
    super(config);
  }

  async fetch(options?: { page?: number; limit?: number }): Promise<FetchResult> {
    const limit = options?.limit || this.config.maxResults || 50;

    // Placeholder - in production would call Homegate API
    const leads = this.generateSampleListings(limit);

    return {
      success: true,
      leads,
      totalAvailable: leads.length,
      hasMore: false,
    };
  }

  private generateSampleListings(count: number): HomegateRawLead[] {
    const now = new Date();
    const samples: HomegateRawLead[] = [];

    const templates = [
      { title: 'Rénovation appartement Zurich', city: 'Zurich', canton: 'zh' },
      { title: 'Transformation villa Genève', city: 'Geneva', canton: 'ge' },
      { title: 'Sanierung Einfamilienhaus Bern', city: 'Bern', canton: 'be' },
    ];

    templates.slice(0, count).forEach((template, index) => {
      samples.push({
        id: `homegate-${Date.now()}-${index}`,
        title: template.title,
        description: `Projet de rénovation à ${template.city}`,
        location: template.city,
        canton: template.canton,
        propertyType: 'apartment',
        postedAt: new Date(now.getTime() - index * 86400000).toISOString(),
        url: `https://www.homegate.ch/detail/${index}`,
      });
    });

    return samples;
  }

  normalize(rawLead: RawLeadData): NormalizedLead {
    const lead = rawLead as HomegateRawLead;

    return {
      external_id: `homegate-${lead.id}`,
      external_url: lead.url,
      source: 'homegate',
      title: lead.title,
      description: lead.description || null,
      city: lead.location || null,
      canton: lead.canton?.toUpperCase() || null,
      service_type: 'renovation',
      contact_name: lead.contactName || null,
      phone: this.normalizePhone(lead.contactPhone),
      email: null,
      priority: this.detectPriority(lead),
      price_mentioned: null,
      raw_data: {
        propertyType: lead.propertyType,
        postedAt: lead.postedAt,
      },
    };
  }

  private detectPriority(lead: HomegateRawLead): 'low' | 'medium' | 'high' | 'urgent' {
    const text = `${lead.title} ${lead.description || ''}`.toLowerCase();

    if (text.includes('urgent') || text.includes('schnell')) {
      return 'urgent';
    }

    return 'medium';
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Homegate connector configured (requires API access)' };
  }
}

export function createHomegateConnector(config: Partial<HomegateConnectorConfig>): HomegateConnector {
  return new HomegateConnector({
    id: config.id || 'homegate',
    name: config.name || 'Homegate',
    type: 'homegate',
    enabled: config.enabled ?? false,
    maxResults: config.maxResults || 50,
    ...config,
  });
}
