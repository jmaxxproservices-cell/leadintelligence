import React, { useState } from 'react';
import { Lead, LeadStatus, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PIPELINE_COLUMNS } from '../../types';
import { Badge } from '../ui';
import { getScoreColor, getInitials, cn } from '../../utils';
import { MapPin, GripVertical } from 'lucide-react';

interface KanbanBoardProps {
  leads: Lead[];
  onStatusChange: (leadId: string, newStatus: LeadStatus) => Promise<void>;
}

interface KanbanColumnProps {
  status: LeadStatus;
  title: string;
  color: string;
  leads: Lead[];
  onStatusChange: (leadId: string, newStatus: LeadStatus) => Promise<void>;
}

function KanbanColumn({ status, title, color, leads, onStatusChange }: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const leadId = e.dataTransfer.getData('leadId');
    if (leadId) {
      await onStatusChange(leadId, status);
    }
  };

  return (
    <div
      className={cn(
        'flex-1 min-w-[250px] max-w-[300px] flex flex-col rounded-lg',
        dragOver && 'ring-2 ring-blue-500 ring-inset'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={cn('px-3 py-2 rounded-t-lg flex items-center justify-between', color, 'text-white')}>
        <span className="font-semibold text-sm">{title}</span>
        <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
          {leads.length}
        </span>
      </div>
      <div className="flex-1 bg-gray-50 rounded-b-lg p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
        {leads.map((lead) => (
          <KanbanCard key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 && (
          <div className="text-center text-sm text-gray-400 py-8">
            Sin leads
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanCard({ lead }: { lead: Lead }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('leadId', lead.id);
  };

  const isClosed = lead.status === 'won' || lead.status === 'lost';
  const revenue = lead.revenue;

  return (
    <div
      draggable={!isClosed}
      onDragStart={handleDragStart}
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-3 transition-shadow duration-200',
        isClosed ? 'opacity-70' : 'cursor-move hover:shadow-md'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900 text-sm line-clamp-2 flex-1">{lead.title}</h4>
        {!isClosed && <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 ml-2" />}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className={cn(
          'text-xs font-bold px-2 py-0.5 rounded',
          getScoreColor(lead.score)
        )}>
          {lead.score}
        </span>
        <span className={cn(
          'text-xs font-medium',
          lead.priority === 'urgent' ? 'text-red-500' :
          lead.priority === 'high' ? 'text-orange-500' :
          lead.priority === 'medium' ? 'text-blue-500' :
          'text-gray-400'
        )}>
          {PRIORITY_LABELS[lead.priority]}
        </span>
        {lead.classification === 'hot' && (
          <Badge variant="danger" size="sm">HOT</Badge>
        )}
      </div>

      {lead.city && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <MapPin className="w-3 h-3" />
          {lead.city}
        </div>
      )}

      {isClosed && revenue && (
        <div className="mt-2 text-sm font-semibold text-green-600">
          CHF {revenue.toLocaleString()}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        {lead.contact_name ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600">
              {getInitials(lead.contact_name)}
            </div>
            <span className="text-xs text-gray-600 truncate max-w-[80px]">
              {lead.contact_name}
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-400">Sin contacto</span>
        )}
        <Badge variant="default" size="sm">{lead.source}</Badge>
      </div>
    </div>
  );
}

export function KanbanBoard({ leads, onStatusChange }: KanbanBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 p-6">
      {PIPELINE_COLUMNS.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          title={STATUS_LABELS[status]}
          color={STATUS_COLORS[status]}
          leads={leads.filter((lead) => lead.status === status)}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}
