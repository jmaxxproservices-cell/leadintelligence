import { supabase } from '../lib/supabase';
import { AnalyticsMetrics, LeadClassification } from '../types';

export async function getAnalyticsMetrics(): Promise<AnalyticsMetrics> {
  const { data: leads } = await supabase
    .from('leads')
    .select('*');

  const { data: feedback } = await supabase
    .from('scoring_feedback')
    .select('*');

  return calculateMetrics(leads || [], feedback || []);
}

function calculateMetrics(
  leads: any[],
  feedback: any[]
): AnalyticsMetrics {
  const wonLeads = leads.filter(l => l.status === 'won');
  const lostLeads = leads.filter(l => l.status === 'lost');
  const closedLeads = [...wonLeads, ...lostLeads];

  const totalRevenue = wonLeads.reduce((sum, l) => sum + (l.revenue || 0), 0);
  const wonDeals = wonLeads.length;
  const lostDeals = lostLeads.length;

  const conversionRate = closedLeads.length > 0
    ? (wonDeals / closedLeads.length) * 100
    : 0;

  const avgTimeToClose = closedLeads.length > 0
    ? closedLeads.reduce((sum, l) => sum + (l.time_to_close_days || 0), 0) / closedLeads.length
    : 0;

  const avgDealSize = wonDeals > 0 ? totalRevenue / wonDeals : 0;

  const revenueBySource: Record<string, number> = {};
  wonLeads.forEach(lead => {
    const source = lead.source || 'other';
    revenueBySource[source] = (revenueBySource[source] || 0) + (lead.revenue || 0);
  });

  const classificationStats = calculateClassificationStats(leads);

  const accuracy = calculateAccuracyMetrics(feedback);

  return {
    totalRevenue,
    wonDeals,
    lostDeals,
    conversionRate,
    avgTimeToClose: Math.round(avgTimeToClose * 10) / 10,
    avgDealSize,
    revenueBySource,
    conversionByClassification: classificationStats,
    classificationAccuracy: accuracy,
  };
}

function calculateClassificationStats(leads: any[]): Record<LeadClassification, { won: number; total: number; rate: number }> {
  const classifications: LeadClassification[] = ['hot', 'high', 'medium', 'low'];
  const stats: Record<LeadClassification, { won: number; total: number; rate: number }> = {
    hot: { won: 0, total: 0, rate: 0 },
    high: { won: 0, total: 0, rate: 0 },
    medium: { won: 0, total: 0, rate: 0 },
    low: { won: 0, total: 0, rate: 0 },
  };

  leads.forEach(lead => {
    const classification = lead.classification as LeadClassification;
    if (classification && stats[classification]) {
      if (lead.status === 'won' || lead.status === 'lost') {
        stats[classification].total++;
        if (lead.status === 'won') {
          stats[classification].won++;
        }
      }
    }
  });

  classifications.forEach(c => {
    stats[c].rate = stats[c].total > 0
      ? Math.round((stats[c].won / stats[c].total) * 100)
      : 0;
  });

  return stats;
}

function calculateAccuracyMetrics(feedback: any[]): { accurate: number; falsePositives: number; falseNegatives: number } {
  return {
    accurate: feedback.filter(f => f.is_accurate === true).length,
    falsePositives: feedback.filter(f => f.false_positive === true).length,
    falseNegatives: feedback.filter(f => f.false_negative === true).length,
  };
}

export async function getRevenueByMonth(): Promise<Array<{ month: string; revenue: number; count: number }>> {
  const { data: wonLeads } = await supabase
    .from('leads')
    .select('revenue, closed_at')
    .eq('status', 'won')
    .not('closed_at', 'is', null)
    .order('closed_at', { ascending: true });

  if (!wonLeads) return [];

  const monthlyData: Record<string, { revenue: number; count: number }> = {};

  wonLeads.forEach(lead => {
    if (lead.closed_at && lead.revenue) {
      const month = new Date(lead.closed_at).toISOString().slice(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { revenue: 0, count: 0 };
      }
      monthlyData[month].revenue += lead.revenue;
      monthlyData[month].count++;
    }
  });

  return Object.entries(monthlyData).map(([month, data]) => ({
    month,
    revenue: data.revenue,
    count: data.count,
  }));
}

export async function getPerformanceTrends(): Promise<{
  thisMonth: { won: number; revenue: number };
  lastMonth: { won: number; revenue: number };
  trend: number;
}> {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const { data: thisMonthLeads } = await supabase
    .from('leads')
    .select('revenue')
    .eq('status', 'won')
    .gte('closed_at', thisMonthStart.toISOString());

  const { data: lastMonthLeads } = await supabase
    .from('leads')
    .select('revenue')
    .eq('status', 'won')
    .gte('closed_at', lastMonthStart.toISOString())
    .lte('closed_at', lastMonthEnd.toISOString());

  const thisMonthRevenue = (thisMonthLeads || []).reduce((sum, l) => sum + (l.revenue || 0), 0);
  const lastMonthRevenue = (lastMonthLeads || []).reduce((sum, l) => sum + (l.revenue || 0), 0);

  const trend = lastMonthRevenue > 0
    ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0;

  return {
    thisMonth: {
      won: (thisMonthLeads || []).length,
      revenue: thisMonthRevenue,
    },
    lastMonth: {
      won: (lastMonthLeads || []).length,
      revenue: lastMonthRevenue,
    },
    trend: Math.round(trend * 10) / 10,
  };
}
