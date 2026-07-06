import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { StatCard, Card, Badge } from '../components/ui';
import { LeadCardCompact } from '../components/leads';
import { useLeads, useLeadStats } from '../hooks/useLeads';
import { getAnalyticsMetrics } from '../services/analytics';
import { STATUS_LABELS, CLASSIFICATION_LABELS, LeadClassification, AnalyticsMetrics } from '../types';
import { Users, FileText, Send, CheckCircle, XCircle, Eye, TrendingUp, Flame, Sparkles, Target, DollarSign, BarChart3 } from 'lucide-react';
import { cn } from '../utils';

export function DashboardPage() {
  const navigate = useNavigate();
  const { leads, loading: leadsLoading } = useLeads({ limit: 10 });
  const { stats, loading: statsLoading } = useLeadStats();
  const [analytics, setAnalytics] = useState<AnalyticsMetrics | null>(null);

  useEffect(() => {
    async function loadAnalytics() {
      const data = await getAnalyticsMetrics();
      setAnalytics(data);
    }
    loadAnalytics();
  }, []);

  const handleStatClick = (status?: string) => {
    if (status) {
      navigate(`/leads?status=${status}`);
    } else {
      navigate('/leads');
    }
  };

  const hotLeads = leads.filter(l => l.classification === 'hot');

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle="Resumen de oportunidades comerciales"
      />

      <div className="p-6">
        {/* Revenue Overview */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Revenue & métricas</h2>
            <button
              onClick={() => navigate('/analytics')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <BarChart3 className="w-4 h-4" />
              Ver analíticas
            </button>
          </div>
          <div className="grid grid-cols-5 gap-4">
            <Card className="bg-gradient-to-br from-green-50 to-green-100 col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Revenue Total</p>
                  <p className="text-3xl font-bold text-green-700">
                    CHF {analytics?.totalRevenue.toLocaleString() || 0}
                  </p>
                </div>
                <DollarSign className="w-12 h-12 text-green-300" />
              </div>
            </Card>

            <Card>
              <div className="text-center">
                <p className="text-sm text-gray-500">Won</p>
                <p className="text-3xl font-bold text-green-600">{analytics?.wonDeals || 0}</p>
                <CheckCircle className="w-5 h-5 text-green-400 mx-auto mt-1" />
              </div>
            </Card>

            <Card>
              <div className="text-center">
                <p className="text-sm text-gray-500">Lost</p>
                <p className="text-3xl font-bold text-red-600">{analytics?.lostDeals || 0}</p>
                <XCircle className="w-5 h-5 text-red-400 mx-auto mt-1" />
              </div>
            </Card>

            <Card>
              <div className="text-center">
                <p className="text-sm text-gray-500">Conversión</p>
                <p className="text-3xl font-bold text-blue-600">{analytics?.conversionRate.toFixed(0) || 0}%</p>
                <Target className="w-5 h-5 text-blue-400 mx-auto mt-1" />
              </div>
            </Card>
          </div>
        </div>

        {/* Priority Classifications */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Clasificación de Leads</h2>
          <div className="grid grid-cols-4 gap-4">
            <ClassificationCard
              type="hot"
              count={stats?.hot || 0}
              icon={Flame}
              color="red"
              onClick={() => navigate('/leads?classification=hot')}
            />
            <ClassificationCard
              type="high"
              count={stats?.high || 0}
              icon={Sparkles}
              color="orange"
              onClick={() => navigate('/leads?classification=high')}
            />
            <ClassificationCard
              type="medium"
              count={stats?.medium || 0}
              icon={TrendingUp}
              color="blue"
              onClick={() => navigate('/leads?classification=medium')}
            />
            <ClassificationCard
              type="low"
              count={stats?.low || 0}
              icon={Target}
              color="gray"
              onClick={() => navigate('/leads?classification=low')}
            />
          </div>
        </div>

        {/* Pipeline Status */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <StatCard
            title="Nuevos"
            value={stats?.new || 0}
            icon={Users}
            color="blue"
            onClick={() => handleStatClick('new')}
          />
          <StatCard
            title="Contactados"
            value={stats?.contacted || 0}
            icon={Eye}
            color="purple"
            onClick={() => handleStatClick('contacted')}
          />
          <StatCard
            title="Presupuestados"
            value={stats?.quoted || 0}
            icon={Send}
            color="orange"
            onClick={() => handleStatClick('quoted')}
          />
          <StatCard
            title="Ganados"
            value={stats?.won || 0}
            icon={CheckCircle}
            color="green"
            onClick={() => handleStatClick('won')}
          />
          <StatCard
            title="Perdidos"
            value={stats?.lost || 0}
            icon={XCircle}
            color="red"
            onClick={() => handleStatClick('lost')}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Leads Recientes</h2>
                <button
                  onClick={() => navigate('/leads')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Ver todos
                </button>
              </div>
              <div className="space-y-3">
                {leadsLoading ? (
                  <div className="text-center py-8 text-gray-500">Cargando...</div>
                ) : leads.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay leads todavía. ¡Crea el primero!
                  </div>
                ) : (
                  leads.map((lead) => (
                    <LeadCardCompact
                      key={lead.id}
                      lead={lead}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    />
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Hot Leads Section */}
            {hotLeads.length > 0 && (
              <Card className="ring-2 ring-red-500 bg-red-50">
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="w-5 h-5 text-red-500" />
                  <h2 className="text-lg font-semibold text-red-700">Leads HOT</h2>
                </div>
                <div className="space-y-2">
                  {hotLeads.slice(0, 5).map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className="p-2 bg-white rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">{lead.title}</p>
                        <span className="text-xs font-bold text-red-500">{lead.score}</span>
                      </div>
                      <p className="text-xs text-gray-500">{lead.contact_name || 'Sin contacto'}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Overview</h2>
              <div className="space-y-3">
                {Object.entries(STATUS_LABELS).map(([status, label]) => {
                  const count = stats?.[status as keyof typeof stats] || 0;
                  const total = stats?.total || 0;
                  const percentage = total > 0 ? (count / total) * 100 : 0;

                  const colors: Record<string, string> = {
                    new: 'bg-blue-500',
                    contacted: 'bg-purple-500',
                    quoted: 'bg-orange-500',
                    won: 'bg-green-500',
                    lost: 'bg-red-500',
                  };

                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">{label}</span>
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', colors[status])}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Revenue by Source mini */}
            {analytics && Object.keys(analytics.revenueBySource).length > 0 && (
              <Card>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue por Fuente</h2>
                <div className="space-y-2">
                  {Object.entries(analytics.revenueBySource).map(([source, revenue]) => (
                    <div key={source} className="flex items-center justify-between">
                      <Badge variant="default">{source}</Badge>
                      <span className="text-sm font-semibold">CHF {revenue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClassificationCard({
  type,
  count,
  icon: Icon,
  color,
  onClick
}: {
  type: LeadClassification;
  count: number;
  icon: React.ElementType;
  color: 'red' | 'orange' | 'blue' | 'gray';
  onClick?: () => void;
}) {
  const configs = {
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', iconBg: 'bg-red-100' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', iconBg: 'bg-orange-100' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', iconBg: 'bg-blue-100' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', iconBg: 'bg-gray-100' },
  };

  const config = configs[color];

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 rounded-xl border transition-all duration-200 cursor-pointer',
        config.bg,
        config.border,
        'hover:shadow-md'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg', config.iconBg)}>
            <Icon className={cn('w-4 h-4', config.text)} />
          </div>
          <span className={cn('text-sm font-semibold', config.text)}>
            {CLASSIFICATION_LABELS[type]}
          </span>
        </div>
        <span className={cn('text-2xl font-bold', config.text)}>{count}</span>
      </div>
    </div>
  );
}
