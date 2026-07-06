import { BaseConnector, ConnectorConfig, FetchResult, RawLeadData, NormalizedLead } from './base';

interface AnibisRawLead extends RawLeadData {
  id: string;
  title: string;
  description?: string;
  price?: string;
  location?: string;
  canton?: string;
  category?: string;
  postedAt?: string;
  url: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

interface AnibisConnectorConfig extends ConnectorConfig {
  services?: ('cleaning' | 'moving' | 'clearance')[];
  cantons?: string[];
  keywords?: string[];
}

const SERVICE_CONFIG = {
  cleaning: {
    keywords: ['nettoyage', 'reinigung', 'pulizia', 'cleaning', 'limpieza', 'menage'],
  },
  moving: {
    keywords: ['déménagement', 'umzug', 'traslo', 'moving', 'mudanza', 'transport'],
  },
  clearance: {
    keywords: ['débarras', 'entrümpelung', 'sgombero', 'clearance', 'vaciado'],
  },
};

const CANTON_MAP: Record<string, string> = {
  'zh': 'Zurich',
  'be': 'Bern',
  'lu': 'Lucerne',
  'ur': 'Uri',
  'sz': 'Schwyz',
  'ow': 'Obwalden',
  'nw': 'Nidwalden',
  'gl': 'Glarus',
  'zg': 'Zug',
  'fr': 'Fribourg',
  'so': 'Solothurn',
  'bs': 'Basel-Stadt',
  'bl': 'Basel-Landschaft',
  'sh': 'Schaffhausen',
  'ar': 'Appenzell Ausserrhoden',
  'ai': 'Appenzell Innerrhoden',
  'sg': 'St. Gallen',
  'gr': 'Graubünden',
  'ag': 'Aargau',
  'tg': 'Thurgau',
  'ti': 'Ticino',
  'vs': 'Valais',
  'vd': 'Vaud',
  'ne': 'Neuchâtel',
  'ge': 'Geneva',
  'ju': 'Jura',
};

export class AnibisConnector extends BaseConnector {
  declare protected config: AnibisConnectorConfig;

  constructor(config: AnibisConnectorConfig) {
    super(config);
  }

  async fetch(options?: { page?: number; limit?: number }): Promise<FetchResult> {
    const limit = options?.limit || this.config.maxResults || 50;
    const leads: AnibisRawLead[] = [];

    const services = this.config.services || ['cleaning', 'moving', 'clearance'];

    for (const service of services) {
      const serviceLeads = await this.fetchServiceListings(service, limit);
      leads.push(...serviceLeads);
    }

    // Deduplicate by ID
    const uniqueLeads = this.deduplicateListings(leads);

    return {
      success: true,
      leads: uniqueLeads.slice(0, limit),
      totalAvailable: uniqueLeads.length,
      hasMore: false,
    };
  }

  private async fetchServiceListings(
    service: 'cleaning' | 'moving' | 'clearance',
    limit: number
  ): Promise<AnibisRawLead[]> {
    // Placeholder for actual API/scraping implementation
    // Currently returns mock data for testing
    return this.generateSampleListings(service, limit);
  }

  private generateSampleListings(
    service: 'cleaning' | 'moving' | 'clearance',
    count: number
  ): AnibisRawLead[] {
    const now = new Date();
    const samples: AnibisRawLead[] = [];

    const templates = {
      cleaning: [
        { title: 'Nettoyage appartement Zurich - URGENT dès demain', city: 'Zurich', canton: 'zh' },
        { title: 'Nettoyage fin de bail Lausanne', city: 'Lausanne', canton: 'vd' },
        { title: 'Reinigung Wohnung Basel', city: 'Basel', canton: 'bs' },
        { title: 'Ménage complet villa Genève', city: 'Geneva', canton: 'ge' },
      ],
      moving: [
        { title: 'Déménagement piano Steinway - Urgent', city: 'Zurich', canton: 'zh' },
        { title: 'Déménagement studio Geneve samedi', city: 'Geneva', canton: 'ge' },
        { title: 'Umzug 4 Zimmer Wohnung Bern', city: 'Bern', canton: 'be' },
      ],
      clearance: [
        { title: 'Entrümpelung Wohnung Basel - bis Ende Monat', city: 'Basel', canton: 'bs' },
        { title: 'Débarras cave + grenier Bern', city: 'Bern', canton: 'be' },
        { title: 'Vidange appartement Zurich', city: 'Zurich', canton: 'zh' },
      ],
    };

    const serviceTemplates = templates[service] || templates.cleaning;

    serviceTemplates.slice(0, count).forEach((template, index) => {
      samples.push({
        id: `anibis-${service}-${Date.now()}-${index}`,
        title: template.title,
        description: `Annonce ${service} sur Anibis.ch. ${template.city}, Suisse.`,
        price: 'Sur devis',
        location: template.city,
        canton: template.canton,
        category: service,
        postedAt: new Date(now.getTime() - index * 3600000).toISOString(),
        url: `https://www.anibis.ch/fr/detail/${Date.now()}-${index}`,
      });
    });

    return samples;
  }

  private deduplicateListings(listings: AnibisRawLead[]): AnibisRawLead[] {
    const seen = new Set<string>();
    return listings.filter((listing) => {
      const key = listing.id || `${listing.title}-${listing.location}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  normalize(rawLead: RawLeadData): NormalizedLead {
    const anibisLead = rawLead as AnibisRawLead;

    return {
      external_id: `anibis-${anibisLead.id}`,
      external_url: anibisLead.url || `https://www.anibis.ch/fr/detail/${anibisLead.id}`,
      source: 'anibis',
      title: anibisLead.title,
      description: anibisLead.description || null,
      city: anibisLead.location || null,
      canton: CANTON_MAP[anibisLead.canton || ''] || anibisLead.canton?.toUpperCase() || null,
      service_type: anibisLead.category || null,
      contact_name: anibisLead.contactName || null,
      phone: this.normalizePhone(anibisLead.contactPhone),
      email: anibisLead.contactEmail || null,
      priority: this.detectPriority(anibisLead),
      price_mentioned: this.parsePrice(anibisLead.price),
      raw_data: {
        category: anibisLead.category,
        postedAt: anibisLead.postedAt,
        originalPrice: anibisLead.price,
      },
    };
  }

  private detectPriority(listing: AnibisRawLead): 'low' | 'medium' | 'high' | 'urgent' {
    const text = `${listing.title} ${listing.description || ''}`.toLowerCase();

    if (
      text.includes('urgent') ||
      text.includes('urgente') ||
      text.includes('dès demain') ||
      text.includes('asap') ||
      text.includes('immédiatement')
    ) {
      return 'urgent';
    }

    if (text.includes('samedi') || text.includes('dimanche') || text.includes('date fixe')) {
      return 'high';
    }

    if (text.includes('bientôt') || text.includes('prochainement')) {
      return 'high';
    }

    return 'medium';
  }

  private parsePrice(priceStr?: string): number | null {
    if (!priceStr) return null;
    const match = priceStr.match(/[\d\s]+/);
    if (match) {
      return parseInt(match[0].replace(/\s/g, ''), 10);
    }
    return null;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    // In production, this would test actual API connectivity
    return { success: true, message: 'Anibis connector ready' };
  }
}

// Factory function for creating Anibis connector
export function createAnibisConnector(config: Partial<AnibisConnectorConfig>): AnibisConnector {
  return new AnibisConnector({
    id: config.id || 'anibis',
    name: config.name || 'Anibis Services',
    type: 'anibis',
    enabled: config.enabled ?? true,
    maxResults: config.maxResults || 50,
    services: config.services || ['cleaning', 'moving', 'clearance'],
    ...config,
  });
}
