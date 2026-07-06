import React from 'react';
import { Lead, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, CLASSIFICATION_LABELS, CLASSIFICATION_COLORS, LeadClassification } from '../../types';
import { Card, Badge } from '../ui';
import { getScoreColor, getInitials, formatRelativeDate, cn } from '../../utils';
import { MapPin, Phone, Mail, ExternalLink, Flame } from 'lucide-react';

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  compact?: boolean;
}

export function LeadCard({ lead, onClick, compact = false }: LeadCardProps) {
  const classification = lead.classification as LeadClassification | null;

  return (
    <Card hover={!!onClick} onClick={onClick} padding="none" className="group">
      <div className={cn('p-4', compact && 'p-3')}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">{lead.title}</h3>
              {lead.external_url && (
                <a
                  href={lead.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {classification === 'hot' && (
                <Flame className="w-4 h-4 text-red-500 animate-pulse" />
              )}
            </div>
            <p className="text-sm text-gray-500 line-clamp-2">{lead.description || 'Sin descripción'}</p>
          </div>
          <div className="ml-3 flex-shrink-0 flex flex-col items-end gap-1">
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold', getScoreColor(lead.score))}>
              {lead.score}
            </div>
            {classification && (
              <span className={cn(
                'text-xs font-bold px-2 py-0.5 rounded border',
                CLASSIFICATION_COLORS[classification]
              )}>
                {CLASSIFICATION_LABELS[classification]}
              </span>
            )}
          </div>
        </div>

        {!compact && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge variant="default">{lead.source}</Badge>
            <span className={cn('text-xs font-medium', `text-${lead.priority === 'urgent' ? 'red' : lead.priority === 'high' ? 'orange' : lead.priority === 'medium' ? 'blue' : 'gray'}-500`)}>
              {PRIORITY_LABELS[lead.priority]}
            </span>
            {lead.city && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="w-3 h-3" />
                {lead.city}
              </span>
            )}
            {lead.urgency_detected && (
              <Badge variant="danger" size="sm">URGENTE</Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {lead.contact_name ? (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                  {getInitials(lead.contact_name)}
                </div>
                <span className="text-sm text-gray-700 truncate max-w-[120px]">
                  {lead.contact_name}
                </span>
              </div>
            ) : (
              <span className="text-sm text-gray-400">Sin contacto</span>
            )}
          </div>
          <span className="text-xs text-gray-400">{formatRelativeDate(lead.created_at)}</span>
        </div>
      </div>
    </Card>
  );
}

export function LeadCardCompact({ lead, onClick }: LeadCardProps) {
  const classification = lead.classification as LeadClassification | null;

  return (
    <div
      onClick={onClick}
      className="p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer transition-all duration-200 hover:shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">{lead.title}</p>
            {classification === 'hot' && (
              <Flame className="w-3.5 h-3.5 text-red-500" />
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{lead.contact_name || 'Sin contacto'}</p>
        </div>
        <div className="flex items-center gap-2">
          {classification && (
            <span className={cn(
              'text-xs font-bold px-2 py-0.5 rounded',
              CLASSIFICATION_COLORS[classification]
            )}>
              {CLASSIFICATION_LABELS[classification]}
            </span>
          )}
          <Badge variant="default" size="sm">{lead.source}</Badge>
        </div>
      </div>
    </div>
  );
}
