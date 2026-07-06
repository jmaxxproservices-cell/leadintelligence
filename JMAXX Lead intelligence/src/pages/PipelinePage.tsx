import React from 'react';
import { Header } from '../components/layout';
import { KanbanBoard } from '../components/pipeline';
import { useLeads, useLeadMutations } from '../hooks/useLeads';
import { LeadStatus } from '../types';
import { Loader2 } from 'lucide-react';

export function PipelinePage() {
  const { leads, loading, refetch } = useLeads();
  const { update } = useLeadMutations();

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    await update(leadId, { status: newStatus });
    refetch();
  };

  return (
    <div>
      <Header
        title="Pipeline"
        subtitle="Vista Kanban de oportunidades"
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <KanbanBoard leads={leads} onStatusChange={handleStatusChange} />
      )}
    </div>
  );
}
