import { Lead, LeadStatus, LeadPriority, LeadSource } from '../types';

export interface ExternalLead {
  id: string;
  source: LeadSource | string;
  title: string;
  description?: string;
  city?: string;
  canton?: string;
  serviceType?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  url?: string;
  publishedAt?: string;
  price?: string;
  raw?: Record<string, unknown>;
}

export interface NormalizedLead extends Partial<Lead> {
  external_id: string;
  external_url: string;
}

export interface ConnectorConfig {
  id: string;
  name: string;
  connector_type: string;
  config: Record<string, unknown>;
  is_active: boolean;
  last_sync_at: string | null;
}

export interface FetchResult {
  connector: string;
  fetched: number;
  created: number;
  updated: number;
  errors: string[];
  timestamp: string;
}

export interface ILeadConnector {
  name: string;
  source: LeadSource | string;

  fetchLeads(): Promise<ExternalLead[]>;
  normalize(raw: ExternalLead): NormalizedLead;
  validate(normalized: NormalizedLead): boolean;
}

export abstract class BaseConnector implements ILeadConnector {
  abstract name: string;
  abstract source: LeadSource | string;
  protected config: ConnectorConfig;

  constructor(config: ConnectorConfig) {
    this.config = config;
  }

  abstract fetchLeads(): Promise<ExternalLead[]>;

  normalize(raw: ExternalLead): NormalizedLead {
    return {
      external_id: raw.id,
      external_url: raw.url || '',
      source: raw.source,
      title: raw.title,
      description: raw.description,
      city: raw.city?.trim(),
      canton: raw.canton?.trim(),
      service_type: this.detectServiceType(raw),
      contact_name: raw.contactName,
      phone: this.normalizePhone(raw.phone),
      email: raw.email?.toLowerCase(),
      status: 'new' as LeadStatus,
      priority: this.detectPriority(raw) as LeadPriority,
    };
  }

  validate(normalized: NormalizedLead): boolean {
    if (!normalized.title || normalized.title.length < 3) {
      return false;
    }
    if (!normalized.external_id) {
      return false;
    }
    return true;
  }

  protected detectServiceType(raw: ExternalLead): string {
    const text = [raw.title, raw.description, raw.serviceType]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const patterns: Record<string, string[]> = {
      renovation: ['renov', 'reform', 'moderniz', 'actualiz'],
      construction: ['constr', 'edificio', 'obra', 'ampliar'],
      painting: ['pint', 'pintur', 'lac'],
      plumbing: ['fontan', 'tuber', 'agua', 'desagüe', 'fuga'],
      electrical: ['electric', 'instalaci', 'iluminación'],
      heating: ['calefacción', 'bomb', 'calor', 'calefactor'],
      solar: ['solar', 'fotovolt', 'paneles'],
      cleaning: ['limpi', 'netej', 'cleaning'],
    };

    for (const [type, keywords] of Object.entries(patterns)) {
      if (keywords.some(kw => text.includes(kw))) {
        return type;
      }
    }

    return 'other';
  }

  protected detectPriority(raw: ExternalLead): string {
    const text = [raw.title, raw.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const urgentKeywords = ['urgente', 'urgent', 'asap', 'inmediato', 'hoy', 'ahora', 'fuga', 'inunda'];

    if (urgentKeywords.some(kw => text.includes(kw))) {
      return 'urgent';
    }

    return 'medium';
  }

  protected normalizePhone(phone?: string): string | undefined {
    if (!phone) return undefined;

    const cleaned = phone.replace(/[^0-9+]/g, '');

    if (cleaned.startsWith('+41')) {
      return cleaned;
    }

    if (cleaned.startsWith('0041')) {
      return '+' + cleaned.slice(2);
    }

    if (cleaned.startsWith('0')) {
      return '+41' + cleaned.slice(1);
    }

    return cleaned.startsWith('+') ? cleaned : `+41${cleaned}`;
  }
}

export class AnibisConnector extends BaseConnector {
  name = 'Anibis';
  source: LeadSource = 'anibis';

  async fetchLeads(): Promise<ExternalLead[]> {
    return [];
  }

  normalize(raw: ExternalLead): NormalizedLead {
    const base = super.normalize(raw);

    return {
      ...base,
      canton: this.mapAnibisCanton(raw.raw?.canton as string),
    };
  }

  private mapAnibisCanton(canton?: string): string | undefined {
    if (!canton) return undefined;

    const mapping: Record<string, string> = {
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

    return mapping[canton.toLowerCase()] || canton;
  }
}

export class TuttiConnector extends BaseConnector {
  name = 'Tutti.ch';
  source: LeadSource = 'tutti';

  async fetchLeads(): Promise<ExternalLead[]> {
    return [];
  }
}

export class HomegateConnector extends BaseConnector {
  name = 'Homegate';
  source: LeadSource = 'homegate';

  async fetchLeads(): Promise<ExternalLead[]> {
    return [];
  }
}

export const connectorRegistry: Map<string, typeof BaseConnector> = new Map([
  ['anibis', AnibisConnector],
  ['tutti', TuttiConnector],
  ['homegate', HomegateConnector],
]);

export function getConnector(type: string, config: ConnectorConfig): ILeadConnector | null {
  const ConnectorClass = connectorRegistry.get(type);
  if (!ConnectorClass) return null;

  return new ConnectorClass(config);
}
