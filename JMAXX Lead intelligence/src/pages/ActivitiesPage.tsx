import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Card, Badge } from '../components/ui';
import { useLeads } from '../hooks/useLeads';
import { Activity, Lead } from '../types';
import { formatRelativeDate, cn } from '../utils';
import { supabase } from '../lib/supabase';
import {
  Star,
  ChevronDown,
  Edit3,
  Phone,
  Mail,
  MessageCircle,
  FileText,
  Calendar,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

export function ActivitiesPage() {
  const navigate = useNavigate();
  const { leads } = useLeads();
  const [activities, setActivities] = useState<(Activity & { lead?: Lead })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      setLoading(true);
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        const activitiesWithLeads = data.map((activity) => ({
          ...activity,
          lead: leads.find((l) => l.id === activity.lead_id),
        }));
        setActivities(activitiesWithLeads);
      }
      setLoading(false);
    }

    if (leads.length > 0) {
      fetchActivities();
    }
  }, [leads]);

  return (
    <div>
      <Header
        title="Actividades"
        subtitle="Historial de acciones del sistema"
      />

      <div className="p-6">
        <Card>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Cargando actividades...</div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No hay actividades registradas
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                    getActivityBgColor(activity.type)
                  )}>
                    <ActivityIcon type={activity.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{activity.title}</span>
                      <Badge variant="default" size="sm">{activity.type}</Badge>
                    </div>
                    {activity.description && (
                      <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatRelativeDate(activity.created_at)}
                      </span>
                      {activity.lead && (
                        <button
                          onClick={() => navigate(`/leads/${activity.lead_id}`)}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                        >
                          {activity.lead.title}
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    created: <Star className="w-5 h-5 text-blue-600" />,
    status_changed: <ChevronDown className="w-5 h-5 text-purple-600" />,
    note_added: <Edit3 className="w-5 h-5 text-orange-600" />,
    called: <Phone className="w-5 h-5 text-green-600" />,
    emailed: <Mail className="w-5 h-5 text-blue-600" />,
    whatsapp: <MessageCircle className="w-5 h-5 text-green-600" />,
    quote_created: <FileText className="w-5 h-5 text-orange-600" />,
    priority_changed: <AlertCircle className="w-5 h-5 text-red-600" />,
  };

  return icons[type] || <AlertCircle className="w-5 h-5 text-gray-400" />;
}

function getActivityBgColor(type: string): string {
  const colors: Record<string, string> = {
    created: 'bg-blue-50',
    status_changed: 'bg-purple-50',
    note_added: 'bg-orange-50',
    called: 'bg-green-50',
    emailed: 'bg-blue-50',
    whatsapp: 'bg-green-50',
    quote_created: 'bg-orange-50',
    priority_changed: 'bg-red-50',
  };

  return colors[type] || 'bg-gray-50';
}
