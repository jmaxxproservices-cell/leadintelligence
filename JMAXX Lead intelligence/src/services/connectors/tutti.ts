import { BaseConnector, ConnectorConfig, FetchResult, RawLeadData, NormalizedLead } from './base';

interface TuttiRawLead extends RawLeadData {
  id: string;
  title: string;
  description?: string;
  category?: string;
  location?: string;
  price?: string;
  postedAt?: string;
  url: string;
  contactName?: string;
  contactPhone?: string;
}

interface TuttiConnectorConfig extends ConnectorConfig {
  categories?: string[];
  locations?: string[];
}

export class TuttiConnector extends BaseConnector {
  declare protected config: TuttiConnectorConfig;

  constructor(config: TuttiConnectorConfig) {
    super(config);
  }

  async fetch(options?: { page?: number; limit?: number }): Promise<FetchResult> {
    const limit = options?.limit || this.config.maxResults || 50;

    // Placeholder - in production would call Tutti API
    const leads = this.generateSampleListings(limit);

    return {
      success: true,
      leads,
      totalAvailable: leads.length,
      hasMore: false,
    };
  }

  private generateSampleListings(count: number): TuttiRawLead[] {
    const now = new Date();
    const samples: TuttiRawLead[] = [];

    const templates = [
      { title: 'Nettoyage maison Luzern', city: 'Lucerne' },
      { title: 'Umzüge Luzern und Umgebung', city: 'Lucerne' },
    ];

    templates.slice(0, count).forEach((template, index) => {
      samples.push({
        id: `tutti-${Date.now()}-${index}`,
        title: template.title,
        description: `Service à ${template.city}`,
        location: template.city,
        price: 'Auf Anfrage',
        postedAt: new Date(now.getTime() - index * 86400000).toISOString(),
        url: `https://www.tutti.ch/detail/${index}`,
      });
    });

    return samples;
  }

  normalize(rawLead: RawLeadData): NormalizedLead {
    const lead = rawLead as TuttiRawLead;

    return {
      external_id: `tutti-${lead.id}`,
      external_url: lead.url,
      source: 'tutti',
      title: lead.title,
      description: lead.description || null,
      city: lead.location || null,
      canton: null,
      service_type: this.detectServiceType(lead),
      contact_name: lead.contactName || null,
      phone: this.normalizePhone(lead.contactPhone),
      email: null,
      priority: 'medium',
      price_mentioned: null,
      raw_data: {
        category: lead.category,
        postedAt: lead.postedAt,
      },
    };
  }

  private detectServiceType(lead: TuttiRawLead): string {
    const text = `${lead.title} ${lead.description || ''}`.toLowerCase();

    if (text.includes('nettoyage') || text.includes('reinigung')) return 'cleaning';
    if (text.includes('umzug') || text.includes('déménagement')) return 'moving';
    if (text.includes('entrümpelung') || text.includes('débarras')) return 'clearance';

    return 'other';
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Tutti connector configured (requires API access)' };
  }
}

export function createTuttiConnector(config: Partial<TuttiConnectorConfig>): TuttiConnector {
  return new TuttiConnector({
    id: config.id || 'tutti',
    name: config.name || 'Tutti.ch',
    type: 'tutti',
    enabled: config.enabled ?? false,
    maxResults: config.maxResults || 50,
    ...config,
  });
}
