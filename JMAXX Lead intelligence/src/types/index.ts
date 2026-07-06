export type LeadStatus = 'new' | 'contacted' | 'quoted' | 'won' | 'lost';
export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent';
export type LeadSource = 'anibis' | 'tutti' | 'homegate' | 'manual' | 'referral' | 'website' | 'other';
export type LeadClassification = 'low' | 'medium' | 'high' | 'hot';

export interface ScoreBreakdown {
  base: number;
  urgency: number;
  intent: number;
  service: number;
  geographic: number;
  total: number;
  matched_rules: Array<{
    category: string;
    name: string;
    impact: number;
  }>;
  detected_signals: string[];
}

export interface Lead {
  id: string;
  source: LeadSource | string;
  title: string;
  description: string | null;
  city: string | null;
  canton: string | null;
  service_type: string | null;
  priority: LeadPriority;
  score: number;
  status: LeadStatus;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  external_id: string | null;
  external_url: string | null;
  created_at: string;
  updated_at: string;

  // Intelligence fields
  classification: LeadClassification | null;
  score_breakdown: ScoreBreakdown | null;
  last_scored_at: string | null;
  urgency_detected: boolean;
  intent_signals: string[];

  // Revenue fields
  revenue: number | null;
  revenue_currency: string;
  closed_at: string | null;
  time_to_close_days: number | null;
}

export interface Activity {
  id: string;
  lead_id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type ActivityType =
  | 'created'
  | 'status_changed'
  | 'note_added'
  | 'called'
  | 'emailed'
  | 'whatsapp'
  | 'quote_created'
  | 'meeting_scheduled'
  | 'priority_changed'
  | 'score_updated'
  | 'lead_created'
  | 'score_calculated'
  | 'lead_classified'
  | 'marked_hot'
  | 'revenue_updated'
  | 'lead_won'
  | 'lead_lost';

export interface ScoringFeedback {
  id: string;
  lead_id: string;
  initial_score: number;
  initial_classification: string;
  outcome: 'won' | 'lost';
  revenue: number | null;
  is_accurate: boolean | null;
  false_positive: boolean;
  false_negative: boolean;
  feedback_notes: string | null;
  created_at: string;
}

export interface RevenueHistory {
  id: string;
  lead_id: string;
  old_revenue: number | null;
  new_revenue: number | null;
  old_status: string | null;
  new_status: string | null;
  changed_by: string;
  created_at: string;
}

export interface AnalyticsMetrics {
  totalRevenue: number;
  wonDeals: number;
  lostDeals: number;
  conversionRate: number;
  avgTimeToClose: number;
  avgDealSize: number;
  revenueBySource: Record<string, number>;
  conversionByClassification: Record<LeadClassification, { won: number; total: number; rate: number }>;
  classificationAccuracy: {
    accurate: number;
    falsePositives: number;
    falseNegatives: number;
  };
}

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  quoted: 'Presupuestado',
  won: 'Ganado',
  lost: 'Perdido',
};

export const PRIORITY_LABELS: Record<LeadPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

export const CLASSIFICATION_LABELS: Record<LeadClassification, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  hot: 'HOT',
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-500',
  contacted: 'bg-purple-500',
  quoted: 'bg-orange-500',
  won: 'bg-green-500',
  lost: 'bg-red-500',
};

export const PRIORITY_COLORS: Record<LeadPriority, string> = {
  low: 'text-gray-500',
  medium: 'text-blue-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
};

export const CLASSIFICATION_COLORS: Record<LeadClassification, string> = {
  low: 'bg-gray-100 text-gray-600 border-gray-200',
  medium: 'bg-blue-50 text-blue-600 border-blue-200',
  high: 'bg-orange-50 text-orange-600 border-orange-200',
  hot: 'bg-red-500 text-white border-red-600 animate-pulse',
};

export const STATUS_DESCRIPTIONS: Record<LeadStatus, string> = {
  new: 'Lead recién creado, pendiente de contacto inicial',
  contacted: 'Se ha contactado con el cliente',
  quoted: 'Presupuesto enviado, esperando respuesta',
  won: 'Lead convertido en venta exitosa',
  lost: 'Lead perdido, no se concretó la venta',
};

export const PIPELINE_COLUMNS: LeadStatus[] = ['new', 'contacted', 'quoted', 'won', 'lost'];

export const SWISS_CANTONS = [
  'Aargau', 'Appenzell Ausserrhoden', 'Appenzell Innerrhoden', 'Basel-Landschaft',
  'Basel-Stadt', 'Bern', 'Fribourg', 'Geneva', 'Glarus', 'Graubünden',
  'Jura', 'Lucerne', 'Neuchâtel', 'Nidwalden', 'Obwalden', 'Schaffhausen',
  'Schwyz', 'Solothurn', 'St. Gallen', 'Thurgau', 'Ticino', 'Uri',
  'Valais', 'Vaud', 'Zug', 'Zurich'
];
