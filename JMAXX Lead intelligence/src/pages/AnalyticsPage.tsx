import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { Card, Badge } from '../components/ui';
import { getAnalyticsMetrics, getRevenueByMonth, getPerformanceTrends } from '../services/analytics';
import { getScoringFeedback } from '../services/revenue';
import { AnalyticsMetrics, CLASSIFICATION_LABELS, ScoringFeedback } from '../types';
import { cn } from '../utils';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  BarChart3,
  PieChart,
  AlertTriangle,
  Flame,
  Sparkles,
} from 'lucide-react';

export function AnalyticsPage() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<Array<{ month: string; revenue: number; count: number }>>([]);
  const [trends, setTrends] = useState<{ thisMonth: { won: number; revenue: number }; lastMonth: { won: number; revenue: number }; trend: number } | null>(null);
  const [feedback, setFeedback] = useState<ScoringFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      const [metricsData, monthlyData, trendsData, feedbackData] = await Promise.all([
        getAnalyticsMetrics(),
        getRevenueByMonth(),
        getPerformanceTrends(),
        getScoringFeedback(),
      ]);
      setMetrics(metricsData);
      setMonthlyRevenue(monthlyData);
      setTrends(trendsData);
      setFeedback(feedbackData);
      setLoading(false);
    }
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <Header title="Analíticas" subtitle="Métricas de rendimiento" />
        <div className="text-center py-12 text-gray-500">Cargando métricas...</div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Analíticas" subtitle="Métricas de rendimiento y revenue" />

      <div className="p-6 space-y-6">
        {/* Revenue Overview */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Revenue Total</p>
                <p className="text-3xl font-bold text-green-700">
                  CHF {metrics?.totalRevenue.toLocaleString() || 0}
                </p>
                {trends && (
                  <p className={cn(
                    'text-xs flex items-center gap-1 mt-1',
                    trends.trend >= 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {trends.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {trends.trend >= 0 ? '+' : ''}{trends.trend}% vs mes anterior
                  </p>
                )}
              </div>
              <DollarSign className="w-10 h-10 text-green-400" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Deals Ganados</p>
                <p className="text-3xl font-bold text-green-600">{metrics?.wonDeals || 0}</p>
                <p className="text-xs text-gray-400">Total convertidos</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-200" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Deals Perdidos</p>
                <p className="text-3xl font-bold text-red-600">{metrics?.lostDeals || 0}</p>
                <p className="text-xs text-gray-400">Total perdidos</p>
              </div>
              <XCircle className="w-10 h-10 text-red-200" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tasa Conversión</p>
                <p className="text-3xl font-bold text-blue-600">{metrics?.conversionRate.toFixed(1) || 0}%</p>
                <p className="text-xs text-gray-400">Ganados / Cerrados</p>
              </div>
              <Target className="w-10 h-10 text-blue-200" />
            </div>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-gray-500 mb-1">Tiempo promedio cierre</p>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              <span className="text-2xl font-bold">{metrics?.avgTimeToClose || 0}</span>
              <span className="text-gray-500">días</span>
            </div>
          </Card>

          <Card>
            <p className="text-sm text-gray-500 mb-1">Deal size promedio</p>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gray-400" />
              <span className="text-2xl font-bold">CHF {metrics?.avgDealSize.toLocaleString() || 0}</span>
            </div>
          </Card>

          <Card>
            <p className="text-sm text-gray-500 mb-1">Precisión del Scoring</p>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gray-400" />
              <span className="text-2xl font-bold">
                {metrics?.classificationAccuracy
                  ? Math.round((metrics.classificationAccuracy.accurate /
                      Math.max(1, metrics.classificationAccuracy.accurate +
                        metrics.classificationAccuracy.falsePositives +
                        metrics.classificationAccuracy.falseNegatives)) * 100)
                  : 0}%
              </span>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Conversion by Classification */}
          <Card>
            <h2 className="text-lg font-semibold mb-4">Conversión por Clasificación</h2>
            <div className="space-y-4">
              {(['hot', 'high', 'medium', 'low'] as const).map((classification) => {
                const stats = metrics?.conversionByClassification[classification];
                return (
                  <div key={classification} className="flex items-center gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-lg flex items-center justify-center',
                      classification === 'hot' ? 'bg-red-100' :
                      classification === 'high' ? 'bg-orange-100' :
                      classification === 'medium' ? 'bg-blue-100' : 'bg-gray-100'
                    )}>
                      {classification === 'hot' && <Flame className="w-6 h-6 text-red-500" />}
                      {classification === 'high' && <Sparkles className="w-6 h-6 text-orange-500" />}
                      {classification === 'medium' && <Target className="w-6 h-6 text-blue-500" />}
                      {classification === 'low' && <Target className="w-6 h-6 text-gray-500" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{CLASSIFICATION_LABELS[classification]}</span>
                        <span className={cn(
                          'font-bold',
                          (stats?.rate || 0) >= 50 ? 'text-green-600' : 'text-gray-600'
                        )}>
                          {stats?.rate || 0}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            classification === 'hot' ? 'bg-red-500' :
                            classification === 'high' ? 'bg-orange-500' :
                            classification === 'medium' ? 'bg-blue-500' : 'bg-gray-400'
                          )}
                          style={{ width: `${stats?.rate || 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {stats?.won || 0} ganados de {stats?.total || 0} cerrados
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Revenue by Source */}
          <Card>
            <h2 className="text-lg font-semibold mb-4">Revenue por Fuente</h2>
            <div className="space-y-3">
              {Object.entries(metrics?.revenueBySource || {}).map(([source, revenue]) => {
                const totalRevenue = metrics?.totalRevenue || 1;
                const percentage = (revenue / totalRevenue) * 100;
                return (
                  <div key={source}>
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="default">{source}</Badge>
                      <span className="font-semibold">CHF {revenue.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{percentage.toFixed(1)}% del total</p>
                  </div>
                );
              })}
              {Object.keys(metrics?.revenueBySource || {}).length === 0 && (
                <p className="text-gray-500 text-center py-8">Sin datos de revenue</p>
              )}
            </div>
          </Card>
        </div>

        {/* Monthly Revenue Trend */}
        {monthlyRevenue.length > 0 && (
          <Card>
            <h2 className="text-lg font-semibold mb-4">Revenue por Mes</h2>
            <div className="h-48 flex items-end gap-4">
              {monthlyRevenue.map((data) => {
                const maxRevenue = Math.max(...monthlyRevenue.map(d => d.revenue));
                const height = (data.revenue / maxRevenue) * 100;
                return (
                  <div key={data.month} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-blue-500 rounded-t-lg"
                      style={{ height: `${height}%` }}
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(data.month + '-01').toLocaleDateString('es-CH', { month: 'short' })}
                    </p>
                    <p className="text-xs font-medium">
                      CHF {(data.revenue / 1000).toFixed(1)}k
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Scoring Feedback Analysis */}
        {feedback.length > 0 && (
          <Card>
            <h2 className="text-lg font-semibold mb-4">Análisis de Precisión del Scoring</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{metrics?.classificationAccuracy.accurate}</p>
                <p className="text-sm text-gray-600">Predicciones correctas</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <AlertTriangle className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-orange-600">{metrics?.classificationAccuracy.falsePositives}</p>
                <p className="text-sm text-gray-600">Falsos positivos (HOT/ HIGH perdidos)</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <TrendingDown className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600">{metrics?.classificationAccuracy.falseNegatives}</p>
                <p className="text-sm text-gray-600">Falsos negativos (LOW/ MED ganados)</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
