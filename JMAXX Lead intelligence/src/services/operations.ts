import { supabase } from '../lib/supabase';

export interface OperationsMetrics {
  // Lead counts by classification
  hotCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;

  // Today's metrics
  detectedToday: number;
  contactedToday: number;
  quotedToday: number;
  wonToday: number;
  lostToday: number;

  // Revenue
  estimatedPipeline: number;
  confirmedRevenue: number;

  // System status
  activeConnectors: number;
  lastSync: string | null;
  nextSync: string | null;
  systemHealth: 'healthy' | 'degraded' | 'down';
}

export interface LeadFilter {
  city?: string;
  canton?: string;
  source?: string;
  priority?: 'hot' | 'high' | 'medium' | 'low';
  classification?: 'hot' | 'high' | 'medium' | 'low';
}

export interface QuickLead {
  id: string;
  title: string;
  city: string | null;
  canton: string | null;
  source: string;
  classification: string;
  score: number;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  estimated_value: number | null;
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  type: string;
  description: string;
  lead_id: string | null;
  lead_title: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

class OperationsService {
  /**
   * Get main operations metrics
   */
  async getMetrics(filters?: LeadFilter): Promise<OperationsMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Build base query with filters
    const buildQuery = (baseQuery: any) => {
      let query = baseQuery;
      if (filters?.city) query = query.eq('city', filters.city);
      if (filters?.canton) query = query.eq('canton', filters.canton);
      if (filters?.source) query = query.eq('source', filters.source);
      if (filters?.classification) query = query.eq('classification', filters.classification);
      return query;
    };

    // Get lead counts by classification
    const [hotResult, highResult, mediumResult, lowResult] = await Promise.all([
      buildQuery(supabase.from('leads').select('id', { count: 'exact', head: true }).eq('classification', 'hot').neq('status', 'lost')),
      buildQuery(supabase.from('leads').select('id', { count: 'exact', head: true }).eq('classification', 'high').neq('status', 'lost')),
      buildQuery(supabase.from('leads').select('id', { count: 'exact', head: true }).eq('classification', 'medium').neq('status', 'lost')),
      buildQuery(supabase.from('leads').select('id', { count: 'exact', head: true }).eq('classification', 'low').neq('status', 'lost')),
    ]);

    // Get today's metrics
    const [detectedToday, contactedToday, quotedToday, wonToday, lostToday] = await Promise.all([
      buildQuery(supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', todayISO)),
      supabase.from('lead_events').select('id', { count: 'exact', head: true }).eq('event_type', 'contact_attempt').gte('created_at', todayISO),
      supabase.from('lead_events').select('id', { count: 'exact', head: true }).eq('event_type', 'quote_sent').gte('created_at', todayISO),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'won').gte('closed_at', todayISO),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'lost').gte('closed_at', todayISO),
    ]);

    // Get revenue metrics
    const { data: revenueData } = await supabase
      .from('leads')
      .select('estimated_value, confirmed_value, status')
      .neq('status', 'lost');

    let estimatedPipeline = 0;
    let confirmedRevenue = 0;

    if (revenueData) {
      for (const lead of revenueData) {
        if (lead.estimated_value) {
          estimatedPipeline += Number(lead.estimated_value);
        }
        if (lead.status === 'won' && lead.confirmed_value) {
          confirmedRevenue += Number(lead.confirmed_value);
        }
      }
    }

    // Get system status
    const { data: healthData } = await supabase
      .from('system_health')
      .select('component, status')
      .eq('component', 'scheduler')
      .single();

    const { data: lastExecution } = await supabase
      .from('execution_history')
      .select('started_at, status')
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    const { data: nextJob } = await supabase
      .from('scheduler_jobs')
      .select('next_run_at')
      .eq('is_enabled', true)
      .order('next_run_at', { ascending: true })
      .limit(1)
      .single();

    const { count: activeConnectors } = await supabase
      .from('scheduler_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('is_enabled', true);

    return {
      hotCount: hotResult.count || 0,
      highCount: highResult.count || 0,
      mediumCount: mediumResult.count || 0,
      lowCount: lowResult.count || 0,
      detectedToday: detectedToday.count || 0,
      contactedToday: contactedToday.count || 0,
      quotedToday: quotedToday.count || 0,
      wonToday: wonToday.count || 0,
      lostToday: lostToday.count || 0,
      estimatedPipeline,
      confirmedRevenue,
      activeConnectors: activeConnectors || 0,
      lastSync: lastExecution?.started_at || null,
      nextSync: nextJob?.next_run_at || null,
      systemHealth: (healthData?.status as OperationsMetrics['systemHealth']) || 'unknown',
    };
  }

  /**
   * Get quick leads list
   */
  async getQuickLeads(
    classification?: 'hot' | 'high' | 'medium' | 'low',
    limit: number = 10
  ): Promise<QuickLead[]> {
    let query = supabase
      .from('leads')
      .select('id, title, city, canton, source, classification, score, contact_name, phone, email, estimated_value, created_at')
      .neq('status', 'lost')
      .order('score', { ascending: false })
      .limit(limit);

    if (classification) {
      query = query.eq('classification', classification);
    }

    const { data } = await query;
    return (data as QuickLead[]) || [];
  }

  /**
   * Get recent activity timeline
   */
  async getRecentActivity(limit: number = 20): Promise<ActivityEvent[]> {
    const { data: events } = await supabase
      .from('lead_events')
      .select(`
        id,
        event_type,
        event_data,
        created_at,
        lead_id,
        leads (id, title)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!events) return [];

    return events.map((e) => ({
      id: e.id,
      type: e.event_type,
      description: this.formatEventDescription(e.event_type, e.event_data),
      lead_id: e.lead_id,
      lead_title: (e.leads as any)?.title || null,
      created_at: e.created_at,
      metadata: (e.event_data as Record<string, unknown>) || {},
    }));
  }

  /**
   * Get available filter options
   */
  async getFilterOptions(): Promise<{
    cities: string[];
    cantons: string[];
    sources: string[];
  }> {
    const { data: cities } = await supabase
      .from('leads')
      .select('city')
      .not('city', 'is', null)
      .order('city');

    const { data: cantons } = await supabase
      .from('leads')
      .select('canton')
      .not('canton', 'is', null)
      .order('canton');

    const { data: sources } = await supabase
      .from('leads')
      .select('source')
      .not('source', 'is', null)
      .order('source');

    const unique = <T>(arr: (T | null)[]): T[] =>
      [...new Set(arr.filter((v): v is T => v !== null))];

    return {
      cities: unique((cities || []).map((c) => c.city)),
      cantons: unique((cantons || []).map((c) => c.canton)),
      sources: unique((sources || []).map((s) => s.source)),
    };
  }

  /**
   * Format event description
   */
  private formatEventDescription(type: string, data: Record<string, unknown> | null): string {
    const eventData = data || {};

    switch (type) {
      case 'hot_lead_detected':
        return 'HOT lead detected';
      case 'contact_attempt':
        return `Contact attempt via ${eventData.method || 'unknown'}`;
      case 'quote_sent':
        return `Quote sent: CHF ${eventData.amount || 'N/A'}`;
      case 'status_change':
        return `Status changed to ${eventData.new_status || 'unknown'}`;
      case 'note_added':
        return `Note added: ${(eventData.note as string)?.slice(0, 50) || ''}...`;
      case 'score_updated':
        return `Score updated: ${eventData.old_score} → ${eventData.new_score}`;
      case 'created':
        return 'New lead created';
      case 'won':
        return `Won! Revenue: CHF ${eventData.value || 'N/A'}`;
      case 'lost':
        return `Lost: ${eventData.reason || 'No reason'}`;
      default:
        return type.replace(/_/g, ' ');
    }
  }

  /**
   * Quick search leads
   */
  async searchLeads(query: string, limit: number = 10): Promise<QuickLead[]> {
    const { data } = await supabase
      .from('leads')
      .select('id, title, city, canton, source, classification, score, contact_name, phone, email, estimated_value, created_at')
      .or(`title.ilike.%${query}%,contact_name.ilike.%${query}%,phone.ilike.%${query}%,city.ilike.%${query}%`)
      .neq('status', 'lost')
      .order('score', { ascending: false })
      .limit(limit);

    return (data as QuickLead[]) || [];
  }

  /**
   * Get connector status summary
   */
  async getConnectorStatus(): Promise<{
    name: string;
    type: string;
    enabled: boolean;
    lastRun: string | null;
    nextRun: string | null;
    status: 'healthy' | 'degraded' | 'error';
  }[]> {
    const { data: jobs } = await supabase
      .from('scheduler_jobs')
      .select('connector_name, connector_type, is_enabled, last_run_at, next_run_at, last_status')
      .order('connector_name');

    return (jobs || []).map((j) => ({
      name: j.connector_name,
      type: j.connector_type,
      enabled: j.is_enabled,
      lastRun: j.last_run_at,
      nextRun: j.next_run_at,
      status: j.last_status === 'completed' ? 'healthy' : j.last_status === 'failed' ? 'error' : 'degraded',
    }));
  }
}

export const operationsService = new OperationsService();
