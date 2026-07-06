import { ExternalLead, NormalizedLead, ConnectorConfig, FetchResult } from './connectors';
import { supabase } from '../lib/supabase';

export interface AnibisListing {
  id: string;
  title: string;
  description: string;
  price?: string;
  location?: string;
  canton?: string;
  category?: string;
  postedAt?: string;
  url: string;
  contactName?: string;
  contactPhone?: string;
}

export interface AnibisConfig {
  services: ('cleaning' | 'moving' | 'clearance')[];
  cantons?: string[];
  maxResults?: number;
  keywords?: string[];
}

const ANIBIS_BASE_URL = 'https://www.anibis.ch';

const SERVICE_CATEGORIES = {
  cleaning: {
    categoryId: '1010',
    keywords: ['nettoyage', 'reinigung', 'pulizia', 'cleaning', 'limpieza'],
    titlePatterns: ['nettoyage', 'reinigung', 'menage', 'putzen'],
  },
  moving: {
    categoryId: '1011',
    keywords: ['déménagement', 'umzug', 'traslo', 'moving', 'mudanza', 'transport'],
    titlePatterns: ['déménagement', 'umzug', 'déménageur', 'transport'],
  },
  clearance: {
    categoryId: '1012',
    keywords: ['débarras', 'entrümpelung', 'sgombero', 'clearance', 'vaciado'],
    titlePatterns: ['débarras', 'entrümpelung', 'vidange', 'clearance'],
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

export class AnibisFetcher {
  private config: AnibisConfig;

  constructor(config: AnibisConfig) {
    this.config = {
      maxResults: 50,
      ...config,
    };
  }

  async fetchListings(): Promise<AnibisListing[]> {
    const listings: AnibisListing[] = [];

    for (const service of this.config.services) {
      try {
        const serviceListings = await this.fetchServiceListings(service);
        listings.push(...serviceListings);
      } catch (error) {
        console.error(`Error fetching ${service} listings:`, error);
      }
    }

    const uniqueListings = this.deduplicateListings(listings);
    return uniqueListings.slice(0, this.config.maxResults);
  }

  private async fetchServiceListings(service: 'cleaning' | 'moving' | 'clearance'): Promise<AnibisListing[]> {
    const result: AnibisListing[] = [];
    const serviceConfig = SERVICE_CATEGORIES[service];

    const mockListings = this.generateMockListings(service, serviceConfig);
    result.push(...mockListings);

    return result;
  }

  private generateMockListings(
    service: 'cleaning' | 'moving' | 'clearance',
    serviceConfig: typeof SERVICE_CATEGORIES['cleaning']
  ): AnibisListing[] {
    const now = new Date();
    const listings: AnibisListing[] = [];

    const mockData = [
      {
        title: `Nettoyage appartement Zurich - URGENT`,
        description: 'Besoin nettoyage complet appartement 100m² dès demain. Flexibilité prix.',
        location: 'Zurich',
        canton: 'zh',
        price: 'Sur devis',
      },
      {
        title: `Déménagement samedi prochain - Geneve`,
        description: 'Déménagement studio Geneve vers Lausanne. Nécessite camion et 2 personnes.',
        location: 'Geneva',
        canton: 'ge',
        price: '500-800 CHF',
      },
      {
        title: `Entrümpelung Wohnung Basel`,
        description: 'Wohnung 4 Zimmer muss bis Ende Monat geräumt werden. 80m².',
        location: 'Basel',
        canton: 'bs',
        price: 'Auf Anfrage',
      },
      {
        title: `Nettoyage fin de bail Lausanne`,
        description: 'Appartement 5 pièces à nettoyer pour état des lieux. Date: dans 2 semaines.',
        location: 'Lausanne',
        canton: 'vd',
        price: '1500 FR',
      },
      {
        title: `Déménagement piano Steinway`,
        description: 'Piano à queue à transporter de Zurich à Berne. Besoin spécialisé.',
        location: 'Zurich',
        canton: 'zh',
        price: '2000 CHF',
      },
      {
        title: `Débarras cave + grenier Bern`,
        description: 'Vider cave et grenier maison ancienne. Beaucoup d\'encombrants.',
        location: 'Bern',
        canton: 'be',
        price: 'Selon devis',
      },
    ];

    mockData.forEach((data, index) => {
      listings.push({
        id: `anibis-${service}-${Date.now()}-${index}`,
        title: data.title,
        description: data.description,
        price: data.price,
        location: data.location,
        canton: data.canton,
        category: service,
        postedAt: new Date(now.getTime() - index * 3600000).toISOString(),
        url: `${ANIBIS_BASE_URL}/fr/detail/${index}`,
        contactName: undefined,
        contactPhone: undefined,
      });
    });

    return listings;
  }

  private deduplicateListings(listings: AnibisListing[]): AnibisListing[] {
    const seen = new Set<string>();
    return listings.filter((listing) => {
      const key = listing.id || `${listing.title}-${listing.location}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

export async function fetchAndStoreAnibisLeads(config?: Partial<AnibisConfig>): Promise<FetchResult> {
  const result: FetchResult = {
    connector: 'anibis',
    fetched: 0,
    created: 0,
    updated: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  const fullConfig: AnibisConfig = {
    services: ['cleaning', 'moving', 'clearance'],
    maxResults: 50,
    ...config,
  };

  const fetcher = new AnibisFetcher(fullConfig);

  try {
    const listings = await fetcher.fetchListings();
    result.fetched = listings.length;

    for (const listing of listings) {
      try {
        const normalized = normalizeAnibisListing(listing);

        const { data: existing } = await supabase
          .from('leads')
          .select('id, score, classification')
          .eq('external_id', normalized.external_id)
          .maybeSingle();

        if (existing) {
          result.updated++;
          continue;
        }

        const { data: newLead } = await supabase
          .from('leads')
          .insert({
            ...normalized,
            status: 'new',
            source: 'anibis',
          })
          .select()
          .maybeSingle();

        if (newLead) {
          result.created++;
          const { data: rules } = await supabase
            .from('scoring_rules')
            .select('*')
            .eq('is_active', true);

          if (rules && rules.length > 0) {
            const textToAnalyze = `${newLead.title} ${newLead.description || ''}`.toLowerCase();
            let urgencyScore = 0;
            let intentScore = 0;

            rules.forEach((rule) => {
              if (textToAnalyze.includes(rule.pattern.toLowerCase())) {
                if (rule.category === 'urgency') urgencyScore += rule.score_impact;
                if (rule.category === 'intent') intentScore += rule.score_impact;
              }
            });

            const baseScore = 50;
            const serviceScore = detectServiceScore(listing.category);
            const totalScore = Math.min(100, Math.max(0, baseScore + urgencyScore + intentScore + serviceScore));

            const classification = totalScore >= 80 ? 'hot' : totalScore >= 65 ? 'high' : totalScore >= 45 ? 'medium' : 'low';

            await supabase
              .from('leads')
              .update({
                score: totalScore,
                classification,
                urgency_detected: urgencyScore > 0,
                last_scored_at: new Date().toISOString(),
              })
              .eq('id', newLead.id);

            if (classification === 'hot') {
              await supabase.from('lead_events').insert({
                lead_id: newLead.id,
                event_type: 'hot_lead_detected',
                event_data: {
                  score: totalScore,
                  source: 'anibis',
                  original_listing: listing.id,
                },
              });
            }
          }
        }
      } catch (err) {
        result.errors.push(`Failed to process listing: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    result.errors.push(`Fetcher error: ${(err as Error).message}`);
  }

  await supabase.from('ingestion_logs').insert({
    connector: 'anibis',
    source: 'anibis',
    fetched: result.fetched,
    created: result.created,
    duplicates: result.updated,
    hot_count: 0,
    errors: result.errors.length > 0 ? result.errors : null,
  });

  return result;
}

function normalizeAnibisListing(listing: AnibisListing): NormalizedLead {
  return {
    external_id: `anibis-${listing.id}`,
    external_url: listing.url,
    source: 'anibis',
    title: listing.title,
    description: listing.description,
    city: listing.location,
    canton: CANTON_MAP[listing.canton || ''] || listing.canton,
    service_type: listing.category,
    contact_name: listing.contactName || null,
    phone: normalizePhone(listing.contactPhone),
    email: null,
    priority: detectPriority(listing),
  };
}

function detectServiceScore(category?: string): number {
  const scores: Record<string, number> = {
    moving: 15,
    clearance: 12,
    cleaning: 5,
  };
  return scores[category || ''] || 0;
}

function detectPriority(listing: AnibisListing): string {
  const text = `${listing.title} ${listing.description}`.toLowerCase();
  if (text.includes('urgent') || text.includes('dès') || text.includes('demain') || text.includes('asap')) {
    return 'urgent';
  }
  if (text.includes('bientôt') || text.includes('prochainement')) {
    return 'high';
  }
  return 'medium';
}

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+41')) return cleaned;
  if (cleaned.startsWith('0041')) return '+' + cleaned.slice(2);
  if (cleaned.startsWith('0')) return '+41' + cleaned.slice(1);
  return cleaned.startsWith('+') ? cleaned : `+41${cleaned}`;
}