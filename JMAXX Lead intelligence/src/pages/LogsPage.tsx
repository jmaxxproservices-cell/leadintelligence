import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { Card, Badge, Select } from '../components/ui';
import { formatRelativeDate, cn } from '../utils';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
} from 'lucide-react';

interface LogEntry {
  id: string;
  type: 'api' | 'webhook' | 'scraper' | 'system';
  action: string;
  status: 'success' | 'error' | 'pending';
  details: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const mockLogs: LogEntry[] = [
  {
    id: '1',
    type: 'api',
    action: 'POST /api/v1/leads',
    status: 'success',
    details: 'Lead creado exitosamente',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    metadata: { lead_id: 'abc-123', source: 'manual' },
  },
  {
    id: '2',
    type: 'system',
    action: 'Score calculation',
    status: 'success',
    details: 'Score actualizado para 5 leads',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: '3',
    type: 'webhook',
    action: 'Anibis webhook received',
    status: 'pending',
    details: 'Procesando nuevo lead de Anibis',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '4',
    type: 'api',
    action: 'GET /api/v1/leads',
    status: 'success',
    details: 'Retornados 25 leads',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: '5',
    type: 'scraper',
    action: 'Anibis scraper',
    status: 'error',
    details: 'Error de conexión: timeout',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    metadata: { error_code: 'ETIMEDOUT' },
  },
];

export function LogsPage() {
  const [logs] = useState<LogEntry[]>(mockLogs);
  const [filter, setFilter] = useState('all');

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.type === filter;
  });

  return (
    <div>
      <Header
        title="Logs del Sistema"
        subtitle="Historial de eventos y operaciones"
      />

      <div className="p-6">
        <div className="mb-6">
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Todos los tipos' },
              { value: 'api', label: 'API' },
              { value: 'webhook', label: 'Webhooks' },
              { value: 'scraper', label: 'Scrapers' },
              { value: 'system', label: 'Sistema' },
            ]}
            className="w-48"
          />
        </div>

        <Card>
          <div className="divide-y divide-gray-100">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No hay logs que mostrar
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-gray-50">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                    log.status === 'success' && 'bg-green-100',
                    log.status === 'error' && 'bg-red-100',
                    log.status === 'pending' && 'bg-yellow-100'
                  )}>
                    <StatusIcon status={log.status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{log.action}</span>
                      <Badge variant={log.type === 'api' ? 'info' : log.type === 'webhook' ? 'purple' : log.type === 'scraper' ? 'warning' : 'default'} size="sm">
                        {log.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{log.details}</p>
                    {log.metadata && (
                      <div className="mt-2 text-xs text-gray-400 font-mono">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {formatRelativeDate(log.timestamp)}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Mostrando {filteredLogs.length} entradas</span>
            <button className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium">
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-600" />;
    case 'pending':
      return <Clock className="w-5 h-5 text-yellow-600" />;
    default:
      return <FileText className="w-5 h-5 text-gray-400" />;
  }
}
