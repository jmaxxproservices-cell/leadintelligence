import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Card, Badge, Button, Select, Input } from '../components/ui';
import { operationsService, OperationsMetrics, QuickLead, ActivityEvent, LeadFilter } from '../services/operations';
import { formatRelativeDate, formatDate, cn } from '../utils';
import { Modal } from '../components/ui/Modal';
import {
  Flame,
  TrendingUp,
  Minus,
  ArrowDown,
  Eye,
  Phone,
  Mail,
  MessageCircle,
  FileText,
  RefreshCw,
  MapPin,
  Building,
  Globe,
  Filter,
  Search,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Server,
  Zap,
  Send,
  X,
} from 'lucide-react';

export function OperationsDashboardPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<OperationsMetrics | null>(null);
  const [hotLeads, setHotLeads] = useState<QuickLead[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);
  const [connectorStatus, setConnectorStatus] = useState<any[]>([]);
  const [filterOptions, setFilterOptions] = useState<{ cities: string[]; cantons: string[]; sources: string[] }>({
    cities: [],
    cantons: [],
    sources: [],
  });
  const [filters, setFilters] = useState<LeadFilter>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<QuickLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showQuickAction, setShowQuickAction] = useState<{
    type: 'whatsapp' | 'call' | 'email' | 'quote' | null;
    lead: QuickLead | null;
  }>({ type: null, lead: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [metricsData, hotData, activityData, connectorData, filterData] = await Promise.all([
      operationsService.getMetrics(filters),
      operationsService.getQuickLeads('hot', 5),
      operationsService.getRecentActivity(15),
      operationsService.getConnectorStatus(),
      operationsService.getFilterOptions(),
    ]);

    setMetrics(metricsData);
    setHotLeads(hotData);
    setRecentActivity(activityData);
    setConnectorStatus(connectorData);
    setFilterOptions(filterData);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const results = await operationsService.searchLeads(searchQuery);
      setSearchResults(results);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleOpenLead = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  const handleWhatsApp = (lead: QuickLead) => {
    if (lead.phone) {
      const phone = lead.phone.replace(/[^0-9]/g, '');
      const message = encodeURIComponent(`Bonjour, je vous contacte concernant votre annonce "${lead.title}".`);
      window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    }
  };

  const handleCall = (lead: QuickLead) => {
    if (lead.phone) {
      window.open(`tel:${lead.phone}`, '_self');
    }
  };

  const handleEmail = (lead: QuickLead) => {
    if (lead.email) {
      const subject = encodeURIComponent(`Re: ${lead.title}`);
      window.open(`mailto:${lead.email}?subject=${subject}`, '_blank');
    }
  };

  const handleCreateQuote = (lead: QuickLead) => {
    navigate(`/leads/${lead.id}?action=quote`);
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'hot_lead_detected':
        return <Flame className="w-4 h-4 text-red-500" />;
      case 'contact_attempt':
        return <Phone className="w-4 h-4 text-blue-500" />;
      case 'quote_sent':
        return <FileText className="w-4 h-4 text-purple-500" />;
      case 'status_change':
        return <TrendingUp className="w-4 h-4 text-orange-500" />;
      case 'won':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'lost':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = filters.city || filters.canton || filters.source || filters.classification;

  return (
    <div className="p-6">
      <Header
        title="Operations"
        subtitle="Daily business operations dashboard"
        action={{
          label: 'Refresh',
          onClick: loadData,
        }}
      />

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search leads by name, phone, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-auto">
                {searchResults.map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => {
                      handleOpenLead(lead.id);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{lead.title}</p>
                        <p className="text-sm text-gray-500">
                          {lead.contact_name && `${lead.contact_name} • `}
                          {lead.city}
                        </p>
                      </div>
                      <Badge variant={lead.classification === 'hot' ? 'danger' : 'default'}>
                        {lead.classification}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            variant={showFilters ? 'primary' : 'secondary'}
            onClick={() => setShowFilters(!showFilters)}
            icon={<Filter className="w-4 h-4" />}
          >
            Filters {hasActiveFilters && `(${Object.values(filters).filter(Boolean).length})`}
          </Button>
        </div>

        {showFilters && (
          <Card className="p-4">
            <div className="grid grid-cols-5 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">City</label>
                <Select
                  value={filters.city || ''}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value || undefined })}
                  options={[
                    { value: '', label: 'All cities' },
                    ...filterOptions.cities.map((c) => ({ value: c, label: c })),
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Canton</label>
                <Select
                  value={filters.canton || ''}
                  onChange={(e) => setFilters({ ...filters, canton: e.target.value || undefined })}
                  options={[
                    { value: '', label: 'All cantons' },
                    ...filterOptions.cantons.map((c) => ({ value: c, label: c })),
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Source</label>
                <Select
                  value={filters.source || ''}
                  onChange={(e) => setFilters({ ...filters, source: e.target.value || undefined })}
                  options={[
                    { value: '', label: 'All sources' },
                    ...filterOptions.sources.map((s) => ({ value: s, label: s })),
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Priority</label>
                <Select
                  value={filters.classification || ''}
                  onChange={(e) => setFilters({ ...filters, classification: e.target.value as LeadFilter['classification'] || undefined })}
                  options={[
                    { value: '', label: 'All priorities' },
                    { value: 'hot', label: 'HOT' },
                    { value: 'high', label: 'HIGH' },
                    { value: 'medium', label: 'MEDIUM' },
                    { value: 'low', label: 'LOW' },
                  ]}
                />
              </div>
              <div className="flex items-end">
                <Button variant="ghost" onClick={clearFilters} disabled={!hasActiveFilters}>
                  Clear filters
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {loading && !metrics ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* Priority Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/leads?classification=hot')}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                  <Flame className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-red-600">{metrics?.hotCount || 0}</p>
                  <p className="text-sm text-gray-500">HOT leads</p>
                </div>
              </div>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/leads?classification=high')}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-orange-600">{metrics?.highCount || 0}</p>
                  <p className="text-sm text-gray-500">HIGH</p>
                </div>
              </div>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/leads?classification=medium')}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Minus className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-blue-600">{metrics?.mediumCount || 0}</p>
                  <p className="text-sm text-gray-500">MEDIUM</p>
                </div>
              </div>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/leads?classification=low')}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                  <ArrowDown className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-600">{metrics?.lowCount || 0}</p>
                  <p className="text-sm text-gray-500">LOW</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Today's Metrics */}
          <Card>
            <h2 className="text-lg font-semibold mb-4">Today's Activity</h2>
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{metrics?.detectedToday || 0}</p>
                <p className="text-xs text-gray-500">Detected</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{metrics?.contactedToday || 0}</p>
                <p className="text-xs text-gray-500">Contacted</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">{metrics?.quotedToday || 0}</p>
                <p className="text-xs text-gray-500">Quoted</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{metrics?.wonToday || 0}</p>
                <p className="text-xs text-gray-500">Won</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{metrics?.lostToday || 0}</p>
                <p className="text-xs text-gray-500">Lost</p>
              </div>
            </div>
          </Card>

          {/* Revenue and System Status */}
          <div className="grid grid-cols-3 gap-6">
            {/* Revenue */}
            <Card>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                Revenue
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Estimated Pipeline</p>
                  <p className="text-3xl font-bold text-gray-900">
                    CHF {((metrics?.estimatedPipeline || 0) / 1000).toFixed(1)}k
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Confirmed Revenue</p>
                  <p className="text-3xl font-bold text-green-600">
                    CHF {((metrics?.confirmedRevenue || 0) / 1000).toFixed(1)}k
                  </p>
                </div>
              </div>
            </Card>

            {/* System Status */}
            <Card>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-500" />
                System Status
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Health</span>
                  <Badge
                    variant={
                      metrics?.systemHealth === 'healthy'
                        ? 'success'
                        : metrics?.systemHealth === 'degraded'
                        ? 'warning'
                        : 'danger'
                    }
                  >
                    {metrics?.systemHealth || 'unknown'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Active Connectors</span>
                  <span className="font-medium">{metrics?.activeConnectors || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Last Sync</span>
                  <span className="text-sm">
                    {metrics?.lastSync ? formatRelativeDate(metrics.lastSync) : 'Never'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Next Sync</span>
                  <span className="text-sm">
                    {metrics?.nextSync ? formatRelativeDate(metrics.nextSync) : 'Not scheduled'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Connector Health */}
            <Card>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Connectors
              </h2>
              <div className="space-y-2">
                {connectorStatus.slice(0, 4).map((conn) => (
                  <div key={conn.name} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{conn.name}</span>
                    <div className="flex items-center gap-2">
                      {conn.enabled ? (
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full',
                            conn.status === 'healthy'
                              ? 'bg-green-500'
                              : conn.status === 'error'
                              ? 'bg-red-500'
                              : 'bg-yellow-500'
                          )}
                        />
                      ) : (
                        <span className="text-xs text-gray-400">Off</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full"
                onClick={() => navigate('/system')}
              >
                View all
              </Button>
            </Card>
          </div>

          {/* HOT Leads and Activity */}
          <div className="grid grid-cols-2 gap-6">
            {/* HOT Leads */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Flame className="w-5 h-5 text-red-500" />
                  HOT Leads
                </h2>
                <Button variant="ghost" size="sm" onClick={() => navigate('/leads?classification=hot')}>
                  View all
                </Button>
              </div>
              <div className="space-y-3">
                {hotLeads.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No HOT leads</p>
                ) : (
                  hotLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-3 bg-red-50 rounded-lg border border-red-100"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{lead.title}</p>
                          <p className="text-xs text-gray-500">
                            {lead.city && `${lead.city} • `}
                            {lead.contact_name || 'No contact'}
                          </p>
                        </div>
                        <Badge variant="danger">{lead.score}</Badge>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleOpenLead(lead.id)}
                          icon={<Eye className="w-3 h-3" />}
                        >
                          Open
                        </Button>
                        {lead.phone && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleWhatsApp(lead)}
                              icon={<MessageCircle className="w-3 h-3" />}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCall(lead)}
                              icon={<Phone className="w-3 h-3" />}
                            />
                          </>
                        )}
                        {lead.email && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEmail(lead)}
                            icon={<Mail className="w-3 h-3" />}
                          />
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCreateQuote(lead)}
                          icon={<FileText className="w-3 h-3" />}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Recent Activity */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-500" />
                  Recent Activity
                </h2>
                <Button variant="ghost" size="sm" onClick={() => navigate('/activities')}>
                  View all
                </Button>
              </div>
              <div className="space-y-3 max-h-80 overflow-auto">
                {recentActivity.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No recent activity</p>
                ) : (
                  recentActivity.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      onClick={() => event.lead_id && handleOpenLead(event.lead_id)}
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {getEventIcon(event.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{event.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {event.lead_title && (
                            <span className="text-xs text-gray-500 truncate">{event.lead_title}</span>
                          )}
                          <span className="text-xs text-gray-400">
                            {formatRelativeDate(event.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Quick Actions Section */}
          <Card>
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-4 gap-4">
              <Button
                variant="secondary"
                className="h-20 flex-col"
                onClick={() => navigate('/leads?classification=hot')}
              >
                <Flame className="w-6 h-6 text-red-500 mb-1" />
                <span>View HOT Leads</span>
              </Button>
              <Button
                variant="secondary"
                className="h-20 flex-col"
                onClick={() => navigate('/actions')}
              >
                <Zap className="w-6 h-6 text-yellow-500 mb-1" />
                <span>Priority Actions</span>
              </Button>
              <Button
                variant="secondary"
                className="h-20 flex-col"
                onClick={() => navigate('/pipeline')}
              >
                <TrendingUp className="w-6 h-6 text-blue-500 mb-1" />
                <span>Pipeline View</span>
              </Button>
              <Button
                variant="secondary"
                className="h-20 flex-col"
                onClick={() => navigate('/analytics')}
              >
                <Activity className="w-6 h-6 text-green-500 mb-1" />
                <span>Analytics</span>
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
