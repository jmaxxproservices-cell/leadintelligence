import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { LeadDetail } from '../components/leads';
import { useLead } from '../hooks/useLeads';
import { getActivities } from '../services/leads';
import { Activity } from '../types';
import { Loader2 } from 'lucide-react';

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lead, loading, error, update } = useLead(id!);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      if (id) {
        setActivitiesLoading(true);
        const result = await getActivities(id);
        setActivities(result.data || []);
        setActivitiesLoading(false);
      }
    }
    fetchActivities();
  }, [id]);

  const handleRefresh = async () => {
    setActivitiesLoading(true);
    const result = await getActivities(id!);
    setActivities(result.data || []);
    setActivitiesLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-6">
        <Header title="Lead no encontrado" />
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">{error || 'El lead solicitado no existe'}</p>
          <button
            onClick={() => navigate('/leads')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Volver a leads
          </button>
        </div>
      </div>
    );
  }

  return <LeadDetail lead={lead} activities={activities} onRefresh={handleRefresh} />;
}
