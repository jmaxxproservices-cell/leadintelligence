import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../components/layout';
import { Card, Button, Badge, Select, SearchInput } from '../components/ui';
import { LeadCard } from '../components/leads';
import { LeadForm } from '../components/leads';
import { useLeads, useLeadMutations } from '../hooks/useLeads';
import { STATUS_LABELS, PRIORITY_LABELS, CLASSIFICATION_LABELS, Lead, LeadClassification } from '../types';
import { Filter, Download, LayoutGrid, List, Flame } from 'lucide-react';
import { cn } from '../utils';

export function LeadsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    source: searchParams.get('source') || '',
    classification: searchParams.get('classification') || '',
    search: '',
  });

  const { leads, loading, refetch } = useLeads({
    status: filters.status as any || undefined,
    priority: filters.priority || undefined,
    source: filters.source || undefined,
    search: filters.search || undefined,
  });

  const { create } = useLeadMutations();

  useEffect(() => {
    const status = searchParams.get('status');
    const classification = searchParams.get('classification');
    if (status && status !== filters.status) {
      setFilters((prev) => ({ ...prev, status }));
    }
    if (classification && classification !== filters.classification) {
      setFilters((prev) => ({ ...prev, classification }));
    }
  }, [searchParams]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (value) {
      searchParams.set(key, value);
    } else {
      searchParams.delete(key);
    }
    setSearchParams(searchParams);
  };

  const handleCreateLead = async (leadData: Partial<Lead>) => {
    await create(leadData);
    refetch();
  };

  const filteredLeads = leads.filter((lead) => {
    if (filters.status && lead.status !== filters.status) return false;
    if (filters.priority && lead.priority !== filters.priority) return false;
    if (filters.source && lead.source !== filters.source) return false;
    if (filters.classification && lead.classification !== filters.classification) return false;
    return true;
  });

  const hotCount = filteredLeads.filter(l => l.classification === 'hot').length;

  return (
    <div>
      <Header
        title="Leads"
        subtitle={`${filteredLeads.length} oportunidades`}
        action={{
          label: 'Nuevo Lead',
          onClick: () => setShowForm(true),
        }}
      />

      <div className="p-6">
        {/* Quick filters for hot leads */}
        {hotCount > 0 && (
          <div className="mb-4">
            <button
              onClick={() => handleFilterChange('classification', filters.classification === 'hot' ? '' : 'hot')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                filters.classification === 'hot'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
              )}
            >
              <Flame className="w-4 h-4" />
              {hotCount} Leads HOT
            </button>
          </div>
        )}

        <Card className="mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-gray-500">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>

            <Select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]}
              className="w-48"
            />

            <Select
              value={filters.classification}
              onChange={(e) => handleFilterChange('classification', e.target.value)}
              options={[
                { value: '', label: 'Todas clasificaciones' },
                ...Object.entries(CLASSIFICATION_LABELS).map(([value, label]) => ({ value, label })),
              ]}
              className="w-48"
            />

            <Select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              options={[{ value: '', label: 'Todas las prioridades' }, ...Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))]}
              className="w-44"
            />

            <Select
              value={filters.source}
              onChange={(e) => handleFilterChange('source', e.target.value)}
              options={[
                { value: '', label: 'Todas las fuentes' },
                { value: 'manual', label: 'Manual' },
                { value: 'anibis', label: 'Anibis' },
                { value: 'tutti', label: 'Tutti' },
                { value: 'homegate', label: 'Homegate' },
                { value: 'referral', label: 'Referido' },
                { value: 'website', label: 'Web' },
              ]}
              className="w-40"
            />

            <div className="flex-1" />

            <SearchInput
              className="w-64"
              onSearch={(value) => setFilters((prev) => ({ ...prev, search: value }))}
            />

            <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-100' : ''}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-100' : ''}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Cargando leads...</div>
        ) : filteredLeads.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No hay leads que mostrar</p>
              <Button onClick={() => setShowForm(true)}>Crear primer lead</Button>
            </div>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onClick={() => navigate(`/leads/${lead.id}`)}
              />
            ))}
          </div>
        ) : (
          <Card padding="none">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Lead</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contacto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Clasificación</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className={cn(
                      'hover:bg-gray-50 cursor-pointer',
                      lead.classification === 'hot' && 'bg-red-50'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{lead.title}</p>
                        {lead.classification === 'hot' && <Flame className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                      <p className="text-xs text-gray-500">{lead.source}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700">{lead.contact_name || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      {lead.classification ? (
                        <Badge
                          variant={lead.classification === 'hot' ? 'danger' : lead.classification === 'high' ? 'warning' : 'info'}
                        >
                          {CLASSIFICATION_LABELS[lead.classification as LeadClassification]}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="default">{STATUS_LABELS[lead.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'font-bold text-sm',
                        lead.score >= 80 ? 'text-green-600' :
                        lead.score >= 60 ? 'text-yellow-600' :
                        lead.score >= 40 ? 'text-orange-600' : 'text-red-600'
                      )}>
                        {lead.score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-500">
                        {new Date(lead.created_at).toLocaleDateString('es-CH')}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <LeadForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreateLead}
      />
    </div>
  );
}
