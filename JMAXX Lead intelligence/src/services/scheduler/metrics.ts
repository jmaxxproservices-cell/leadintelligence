import { supabase } from '../../lib/supabase';

export interface MetricPoint {
  metric_name: string;
  metric_value: number;
  granularity: 'minute' | 'hour' | 'day';
  period_start: Date;
  connector_type?: string;
}

export interface SystemMetricsSummary {
  leadsPerMinute: number;
  leadsPerHour: number;
  leadsPerDay: number;
  successRate: number;
  failureRate: number;
  avgExecutionTime: number;
  hotLeadsRate: number;
  duplicateRate: number;
  totalConnectorsActive: number;
  totalExecutionsToday: number;
}

export interface ConnectorMetricsSummary {
  connector_type: string;
  executions: number;
  successes: number;
  failures: number;
  successRate: number;
  avgExecutionTime: number;
  totalLeadsFetched: number;
  totalLeadsCreated: number;
  totalHotLeads: number;
}

const METRIC_NAMES = {
  LEADS_FETCHED: 'leads_fetched',
  LEADS_CREATED: 'leads_created',
  LEADS_DUPLICATES: 'leads_duplicates',
  LEADS_INVALID: 'leads_invalid',
  HOT_LEADS_DETECTED: 'hot_leads_detected',
  EXECUTION_TIME: 'execution_time_ms',
  EXECUTION_SUCCESS: 'execution_success',
  EXECUTION_FAILURE: 'execution_failure',
  EXECUTION_COUNT: 'execution_count',
} as const;

class MetricsAggregationService {
  /**
   * Record a metric
   */
  async recordMetric(
    name: string,
    value: number,
    connectorType?: string,
    timestamp: Date = new Date()
  ): Promise<void> {
    // Record minute granularity
    const minuteStart = this.getMinuteStart(timestamp);

    await supabase.from('system_metrics').upsert(
      {
        metric_name: name,
        metric_value: value,
        granularity: 'minute',
        period_start: minuteStart.toISOString(),
        period_end: new Date(minuteStart.getTime() + 60000).toISOString(),
        connector_type: connectorType || null,
      },
      {
        onConflict: 'metric_name,granularity,period_start,connector_type',
      }
    );
  }

  /**
   * Record execution metrics
   */
  async recordExecutionMetrics(
    connectorType: string,
    metrics: {
      fetched: number;
      created: number;
      duplicates: number;
      invalid: number;
      hotDetected: number;
      durationMs: number;
      success: boolean;
    }
  ): Promise<void> {
    const now = new Date();

    // Record individual metrics
    await Promise.all([
      this.recordMetric(METRIC_NAMES.LEADS_FETCHED, metrics.fetched, connectorType, now),
      this.recordMetric(METRIC_NAMES.LEADS_CREATED, metrics.created, connectorType, now),
      this.recordMetric(METRIC_NAMES.LEADS_DUPLICATES, metrics.duplicates, connectorType, now),
      this.recordMetric(METRIC_NAMES.LEADS_INVALID, metrics.invalid, connectorType, now),
      this.recordMetric(METRIC_NAMES.HOT_LEADS_DETECTED, metrics.hotDetected, connectorType, now),
      this.recordMetric(METRIC_NAMES.EXECUTION_TIME, metrics.durationMs, connectorType, now),
      this.recordMetric(METRIC_NAMES.EXECUTION_COUNT, 1, connectorType, now),
      metrics.success
        ? this.recordMetric(METRIC_NAMES.EXECUTION_SUCCESS, 1, connectorType, now)
        : this.recordMetric(METRIC_NAMES.EXECUTION_FAILURE, 1, connectorType, now),
    ]);
  }

  /**
   * Aggregate minute metrics into hour metrics
   */
  async aggregateToHour(date?: Date): Promise<void> {
    const hourStart = this.getHourStart(date || new Date());
    const hourEnd = new Date(hourStart.getTime() + 3600000);

    const { data: minuteMetrics } = await supabase
      .from('system_metrics')
      .select('*')
      .eq('granularity', 'minute')
      .gte('period_start', hourStart.toISOString())
      .lt('period_start', hourEnd.toISOString());

    if (!minuteMetrics || minuteMetrics.length === 0) return;

    // Group by metric_name and connector_type
    const grouped = this.groupMetrics(minuteMetrics);

    for (const [key, values] of Object.entries(grouped)) {
      const metricName = values[0].metric_name;
      const connectorType = values[0].connector_type;

      // Sum or average depending on metric
      const aggregatedValue =
        metricName === METRIC_NAMES.EXECUTION_TIME
          ? values.reduce((sum, v) => sum + Number(v.metric_value), 0) / values.length
          : values.reduce((sum, v) => sum + Number(v.metric_value), 0);

      await supabase.from('system_metrics').upsert({
        metric_name: metricName,
        metric_value: aggregatedValue,
        granularity: 'hour',
        period_start: hourStart.toISOString(),
        period_end: hourEnd.toISOString(),
        connector_type: connectorType,
      });
    }
  }

  /**
   * Get system metrics summary
   */
  async getSystemSummary(): Promise<SystemMetricsSummary> {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 3600000);
    const lastDay = new Date(now.getTime() - 86400000);

    // Get recent metrics
    const { data: hourMetrics } = await supabase
      .from('system_metrics')
      .select('*')
      .eq('granularity', 'minute')
      .gte('period_start', lastHour.toISOString());

    const { data: dayMetrics } = await supabase
      .from('system_metrics')
      .select('*')
      .eq('granularity', 'minute')
      .gte('period_start', lastDay.toISOString());

    const { data: hourExecutions } = await supabase
      .from('execution_history')
      .select('*')
      .gte('started_at', lastHour.toISOString());

    // Calculate aggregates
    const hourCreated = this.sumMetric(hourMetrics, METRIC_NAMES.LEADS_CREATED);
    const hourHot = this.sumMetric(hourMetrics, METRIC_NAMES.HOT_LEADS_DETECTED);
    const hourSuccess = this.sumMetric(hourMetrics, METRIC_NAMES.EXECUTION_SUCCESS);
    const hourFailure = this.sumMetric(hourMetrics, METRIC_NAMES.EXECUTION_FAILURE);
    const hourExecTime = this.avgMetric(hourMetrics, METRIC_NAMES.EXECUTION_TIME);

    const dayCreated = this.sumMetric(dayMetrics, METRIC_NAMES.LEADS_CREATED);
    const daySuccess = this.sumMetric(dayMetrics, METRIC_NAMES.EXECUTION_SUCCESS);
    const dayFailure = this.sumMetric(dayMetrics, METRIC_NAMES.EXECUTION_FAILURE);

    const totalExec = hourSuccess + hourFailure;
    const successRate = totalExec > 0 ? (hourSuccess / totalExec) * 100 : 0;
    const failureRate = totalExec > 0 ? (hourFailure / totalExec) * 100 : 0;

    return {
      leadsPerMinute: hourCreated / 60,
      leadsPerHour: hourCreated,
      leadsPerDay: dayCreated,
      successRate: Math.round(successRate * 10) / 10,
      failureRate: Math.round(failureRate * 10) / 10,
      avgExecutionTime: Math.round(hourExecTime),
      hotLeadsRate: hourCreated > 0 ? (hourHot / hourCreated) * 100 : 0,
      duplicateRate: 0,
      totalConnectorsActive: new Set(hourExecutions?.map((e) => e.connector_type) || []).size,
      totalExecutionsToday: hourExecutions?.length || 0,
    };
  }

  /**
   * Get per-connector metrics
   */
  async getConnectorMetrics(): Promise<ConnectorMetricsSummary[]> {
    const lastDay = new Date(Date.now() - 86400000);

    const { data: executions } = await supabase
      .from('execution_history')
      .select('*')
      .gte('started_at', lastDay.toISOString());

    if (!executions || executions.length === 0) return [];

    // Group by connector type
    const grouped: Record<string, typeof executions> = {};

    for (const exec of executions) {
      const type = exec.connector_type || 'unknown';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(exec);
    }

    return Object.entries(grouped).map(([type, execs]) => {
      const successes = execs.filter((e) => e.status === 'completed').length;
      const failures = execs.filter((e) => e.status === 'failed').length;
      const total = execs.length;
      const avgTime =
        execs.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / (execs.length || 1);
      const totalFetched = execs.reduce((sum, e) => sum + (e.leads_fetched || 0), 0);
      const totalCreated = execs.reduce((sum, e) => sum + (e.leads_created || 0), 0);
      const totalHot = execs.reduce((sum, e) => sum + (e.hot_leads_detected || 0), 0);

      return {
        connector_type: type,
        executions: total,
        successes,
        failures,
        successRate: total > 0 ? Math.round((successes / total) * 1000) / 10 : 0,
        avgExecutionTime: Math.round(avgTime),
        totalLeadsFetched: totalFetched,
        totalLeadsCreated: totalCreated,
        totalHotLeads: totalHot,
      };
    });
  }

  /**
   * Get metric history
   */
  async getMetricHistory(
    name: string,
    granularity: 'minute' | 'hour' | 'day' = 'hour',
    hours: number = 24
  ): Promise<{ time: Date; value: number }[]> {
    const since = new Date(Date.now() - hours * 3600000);

    const { data: metrics } = await supabase
      .from('system_metrics')
      .select('*')
      .eq('metric_name', name)
      .eq('granularity', granularity)
      .gte('period_start', since.toISOString())
      .order('period_start', { ascending: true });

    return (metrics || []).map((m) => ({
      time: new Date(m.period_start),
      value: Number(m.metric_value),
    }));
  }

  // Helper methods
  private getMinuteStart(date: Date): Date {
    const d = new Date(date);
    d.setSeconds(0, 0);
    return d;
  }

  private getHourStart(date: Date): Date {
    const d = this.getMinuteStart(date);
    d.setMinutes(0);
    return d;
  }

  private groupMetrics(
    metrics: any[]
  ): Record<string, typeof metrics> {
    const grouped: Record<string, typeof metrics> = {};

    for (const m of metrics) {
      const key = `${m.metric_name}-${m.connector_type || 'all'}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    }

    return grouped;
  }

  private sumMetric(metrics: any[] | null, name: string): number {
    if (!metrics) return 0;
    return metrics
      .filter((m) => m.metric_name === name)
      .reduce((sum, m) => sum + Number(m.metric_value), 0);
  }

  private avgMetric(metrics: any[] | null, name: string): number {
    if (!metrics) return 0;
    const filtered = metrics.filter((m) => m.metric_name === name);
    if (filtered.length === 0) return 0;
    return filtered.reduce((sum, m) => sum + Number(m.metric_value), 0) / filtered.length;
  }
}

export const metricsAggregationService = new MetricsAggregationService();
