import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Card, Badge, Button } from '../components/ui';
import { createActionSession, getHotLeadAlerts, markNotificationRead } from '../services/priorityEngine';
import { markLeadContacted } from '../services/ingestion';
import { PriorityActionItem, AlertNotification } from '../services/priorityEngine';
import { CLASSIFICATION_LABELS } from '../types';
import { formatRelativeDate, cn } from '../utils';
import {
  Flame,
  Sparkles,
  Clock,
  Phone,
  MessageCircle,
  Mail,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Zap,
  Target,
} from 'lucide-react';

export function ActionCenterPage() {
  const navigate = useNavigate();
  const [actions, setActions] = useState<PriorityActionItem[]>([]);
  const [hotAlerts, setHotAlerts] = useState<AlertNotification[]>([]);
  const [metrics, setMetrics] = useState<{
    pendingActions: number;
    hotPending: number;
    highPending: number;
    avgResponseTime: number;
    responseRate: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const session = await createActionSession();
    setActions(session.actions);
    setHotAlerts(session.hotAlerts);
    setMetrics(session.metrics);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleWhatsApp = async (leadId: string, link: string) => {
    window.open(link, '_blank');
    await markLeadContacted(leadId, 'whatsapp');
    loadData();
  };

  const handleMarkRead = async (notificationId: string) => {
    await markNotificationRead(notificationId);
    setHotAlerts((prev) => prev.filter((a) => a.id !== notificationId));
  };

  if (loading) {
    return (
      <div>
        <Header title="Centro de Acciones" subtitle="Prioriza y actúa" />
        <div className="p-6 text-center py-12 text-gray-500">Cargando acciones...</div>
      </div>
    );
  }

  const immediateActions = actions.filter((a) => a.urgency === 'immediate');
  const todayActions = actions.filter((a) => a.urgency === 'today');
  const weekActions = actions.filter((a) => a.urgency === 'week');
  const otherActions = actions.filter((a) => a.urgency === 'anytime');

  return (
    <div>
      <Header
        title="Centro de Acciones"
        subtitle="Actúa rápidamente en leads de alta prioridad"
        action={{
          label: 'Actualizar',
          onClick: loadData,
        }}
      />

      <div className="p-6">
        {/* Metrics Row */}
        {metrics && (
          <div className="grid grid-cols-5 gap-4 mb-6">
            <Card className="text-center py-4">
              <p className="text-3xl font-bold text-gray-900">{metrics.pendingActions}</p>
              <p className="text-sm text-gray-500">Pendientes</p>
            </Card>
            <Card className="text-center py-4 bg-red-50 border-red-200">
              <p className="text-3xl font-bold text-red-600">{metrics.hotPending}</p>
              <p className="text-sm text-red-500">HOT ahora</p>
            </Card>
            <Card className="text-center py-4 bg-orange-50 border-orange-200">
              <p className="text-3xl font-bold text-orange-600">{metrics.highPending}</p>
              <p className="text-sm text-orange-500">HIGH hoy</p>
            </Card>
            <Card className="text-center py-4">
              <p className="text-3xl font-bold text-blue-600">{metrics.avgResponseTime}min</p>
              <p className="text-sm text-gray-500">Tiempo respuesta</p>
            </Card>
            <Card className="text-center py-4">
              <p className="text-3xl font-bold text-green-600">{metrics.responseRate}%</p>
              <p className="text-sm text-gray-500">Tasa contacto</p>
            </Card>
          </div>
        )}

        {/* HOT Alerts */}
        {hotAlerts.length > 0 && (
          <Card className="mb-6 ring-2 ring-red-500 bg-red-50">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-6 h-6 text-red-500 animate-pulse" />
              <h2 className="text-lg font-bold text-red-700">Alertas HOT - Actuar AHORA</h2>
            </div>
            <div className="space-y-3">
              {hotAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-white p-4 rounded-lg border border-red-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{alert.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {formatRelativeDate(alert.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {alert.whatsappLink && (
                        <Button
                          size="sm"
                          onClick={() => handleWhatsApp(alert.leadId, alert.whatsappLink!)}
                          icon={<MessageCircle className="w-4 h-4" />}
                        >
                          WhatsApp
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/leads/${alert.leadId}`)}
                      >
                        Ver Lead
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkRead(alert.id)}
                        icon={<CheckCircle className="w-4 h-4" />}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Priority Actions */}
        <div className="grid grid-cols-4 gap-4">
          {/* IMMEDIATE - HOT */}
          <Card className="bg-red-50 border-red-200">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-red-200">
              <Flame className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-red-700">AHORA ({immediateActions.length})</h3>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {immediateActions.map((item) => (
                <ActionCard
                  key={item.lead.id}
                  item={item}
                  onWhatsApp={handleWhatsApp}
                  onView={() => navigate(`/leads/${item.lead.id}`)}
                />
              ))}
              {immediateActions.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin leads HOT</p>
              )}
            </div>
          </Card>

          {/* TODAY - HIGH */}
          <Card className="bg-orange-50 border-orange-200">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-orange-200">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold text-orange-700">HOY ({todayActions.length})</h3>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {todayActions.map((item) => (
                <ActionCard
                  key={item.lead.id}
                  item={item}
                  onWhatsApp={handleWhatsApp}
                  onView={() => navigate(`/leads/${item.lead.id}`)}
                />
              ))}
              {todayActions.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin leads HIGH</p>
              )}
            </div>
          </Card>

          {/* THIS WEEK */}
          <Card className="bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-blue-200">
              <Clock className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-blue-700">SEMANA ({weekActions.length})</h3>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {weekActions.map((item) => (
                <ActionCard
                  key={item.lead.id}
                  item={item}
                  onWhatsApp={handleWhatsApp}
                  onView={() => navigate(`/leads/${item.lead.id}`)}
                />
              ))}
              {weekActions.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin leads MEDIUM</p>
              )}
            </div>
          </Card>

          {/* LOW PRIORITY */}
          <Card className="bg-gray-50 border-gray-200">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200">
              <Target className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold text-gray-600">BAJA ({otherActions.length})</h3>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {otherActions.map((item) => (
                <ActionCard
                  key={item.lead.id}
                  item={item}
                  onWhatsApp={handleWhatsApp}
                  onView={() => navigate(`/leads/${item.lead.id}`)}
                />
              ))}
              {otherActions.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin leads LOW</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  item,
  onWhatsApp,
  onView,
}: {
  item: PriorityActionItem;
  onWhatsApp: (leadId: string, link: string) => void;
  onView: () => void;
}) {
  const classification = item.lead.classification as 'hot' | 'high' | 'medium' | 'low' | null;

  return (
    <div
      className="bg-white p-3 rounded-lg border border-gray-200 cursor-pointer hover:shadow-sm transition-shadow"
      onClick={onView}
    >
      <div className="flex items-start justify-between mb-1">
        <p className="font-medium text-sm text-gray-900 line-clamp-1 flex-1">{item.lead.title}</p>
        <span className={cn(
          'text-xs font-bold',
          classification === 'hot' ? 'text-red-500' :
          classification === 'high' ? 'text-orange-500' :
          classification === 'medium' ? 'text-blue-500' : 'text-gray-500'
        )}>
          {item.lead.score}
        </span>
      </div>
      <p className="text-xs text-gray-500 line-clamp-1">{item.lead.city || 'Sin ubicación'}</p>
      <div className="flex items-center gap-1 mt-2">
        {item.whatsappLink && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onWhatsApp(item.lead.id, item.whatsappLink!);
            }}
            className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
        )}
        {item.lead.phone && !item.whatsappLink && (
          <a
            href={`tel:${item.lead.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        )}
        {item.lead.email && (
          <a
            href={`mailto:${item.lead.email}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 bg-purple-100 text-purple-600 rounded hover:bg-purple-200 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
