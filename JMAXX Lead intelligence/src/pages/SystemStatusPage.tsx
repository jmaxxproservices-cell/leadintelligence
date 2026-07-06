import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { Card, Badge, Button } from '../components/ui';
import {
  schedulerService,
  metricsAggregationService,
  SystemMetricsSummary,
  ConnectorMetricsSummary,
} from '../services/scheduler';
import { SchedulerJob, ExecutionRecord, SystemHealthStatus, ErrorLogEntry } from '../services/scheduler';
import { formatRelativeDate, formatDate, cn } from '../utils';
import {
  Activity,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  RefreshCw,
  Database,
  Zap,
  Server,
  Play,
  Pause,
  Settings,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Bug,
  Lock,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

export function SystemStatusPage() {
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);
  const [health, setHealth] = useState<SystemHealthStatus[]>([]);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [metrics, setMetrics] = useState<SystemMetricsSummary | null>(null);
  const [connectorMetrics, setConnectorMetrics] = useState<ConnectorMetricsSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'jobs' | 'errors'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadData = async () => {
    setLoading(true);
    const [jobsData, healthData, executionsData, errorsData, metricsData, connectorMetricsData] = await Promise.all([
      schedulerService.getJobs(),
      schedulerService.getSystemHealth(),
      schedulerService.getExecutionHistory(20),
      schedulerService.getErrorLogs(50),
      metricsAggregationService.getSystemSummary(),
      metricsAggregationService.getConnectorMetrics(),
    ]);
    setJobs(jobsData);
    setHealth(healthData);
    setExecutions(executionsData);
    setErrors(errorsData);
    setMetrics(metricsData);
    setConnectorMetrics(connectorMetricsData);
    setLoading(false);
  };

  const handleTriggerJob = async (connectorId: string) => {
    await schedulerService.triggerJob(connectorId);
    setTimeout(loadData, 1000);
  };

  const handleToggleJob = async (connectorId: string, enabled: boolean) => {
    if (enabled) {
      await schedulerService.enableJob(connectorId);
    } else {
      await schedulerService.disableJob(connectorId);
    }
    loadData();
  };

  const handleResolveError = async (errorId: string) => {
    await schedulerService.resolveError(errorId);
    loadData();
  };

  const handleCleanupLocks = async () => {
    const count = await schedulerService.cleanupLocks();
    if (count > 0) {
      alert(`Cleaned ${count} stale locks`);
    }
    loadData();
  };

  const getHealthIcon = (status: SystemHealthStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'down':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getComponentIcon = (component: string) => {
    switch (component) {
      case 'scheduler':
        return <Server className="w-5 h-5" />;
      case 'connectors':
        return <Database className="w-5 h-5" />;
      case 'database':
        return <Database className="w-5 h-5" />;
      case 'scoring_engine':
        return <Zap className="w-5 h-5" />;
      case 'priority_engine':
        return <Activity className="w-5 h-5" />;
      default:
        return <Settings className="w-5 h-5" />;
    }
  };

  const statusCounts = {
    healthy: health.filter((h) => h.status === 'healthy').length,
    degraded: health.filter((h) => h.status === 'degraded').length,
    down: health.filter((h) => h.status === 'down').length,
  };

  const unresolvedErrors = errors.filter((e) => !e.resolved).length;

  return (
    <div className="p-6">
      <Header
        title="System Status"
        subtitle="Monitor scheduler, connectors, and reliability"
        action={{
          label: 'Refresh',
          onClick: loadData,
        }}
      />

      <div className="space-y-6">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              Auto-refresh (30s)
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleCleanupLocks} icon={<Lock className="w-4 h-4" />}>
              Cleanup Locks
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 pb-2">
          {(['overview', 'metrics', 'jobs', 'errors'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
                activeTab === tab
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'errors' && unresolvedErrors > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                  {unresolvedErrors}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Health Grid */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="text-center p-4">
                <div className="flex items-center justify-center mb-2">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-2xl font-bold text-green-600">{statusCounts.healthy}</p>
                <p className="text-sm text-gray-500">Healthy</p>
              </Card>

              <Card className="text-center p-4">
                <div className="flex items-center justify-center mb-2">
                  <AlertTriangle className="w-8 h-8 text-yellow-500" />
                </div>
                <p className="text-2xl font-bold text-yellow-600">{statusCounts.degraded}</p>
                <p className="text-sm text-gray-500">Degraded</p>
              </Card>

              <Card className="text-center p-4">
                <div className="flex items-center justify-center mb-2">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-2xl font-bold text-red-600">{statusCounts.down}</p>
                <p className="text-sm text-gray-500">Down</p>
              </Card>

              <Card className="text-center p-4">
                <div className="flex items-center justify-center mb-2">
                  <Bug className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-2xl font-bold text-gray-600">{unresolvedErrors}</p>
                <p className="text-sm text-gray-500">Errors</p>
              </Card>
            </div>

            {/* Component Health */}
            <Card>
              <h2 className="text-lg font-semibold mb-4">Component Health</h2>
              <div className="space-y-3">
                {health.map((component) => (
                  <div
                    key={component.component}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          component.status === 'healthy'
                            ? 'bg-green-100 text-green-600'
                            : component.status === 'degraded'
                            ? 'bg-yellow-100 text-yellow-600'
                            : 'bg-red-100 text-red-600'
                        )}
                      >
                        {getComponentIcon(component.component)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 capitalize">
                          {component.component.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-gray-500">
                          Last check: {formatRelativeDate(component.last_check)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {component.successful_checks}/{component.total_checks} checks
                        </p>
                        <p className="text-xs text-gray-500">
                          Uptime:{' '}
                          {component.uptime_seconds > 3600
                            ? `${Math.round(component.uptime_seconds / 3600)}h`
                            : `${Math.round(component.uptime_seconds / 60)}m`}
                        </p>
                      </div>
                      {getHealthIcon(component.status)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Recent Executions */}
            <Card>
              <h2 className="text-lg font-semibold mb-4">Recent Executions</h2>
              <div className="space-y-3">
                {executions.slice(0, 10).map((exec) => (
                  <div
                    key={exec.id}
                    className="p-4 bg-gray-50 rounded-lg cursor-pointer"
                    onClick={() => setExpandedExecution(expandedExecution === exec.id ? null : exec.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            exec.status === 'completed'
                              ? 'bg-green-100'
                              : exec.status === 'failed'
                              ? 'bg-red-100'
                              : 'bg-blue-100'
                          )}
                        >
                          {exec.status === 'completed' ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : exec.status === 'failed' ? (
                            <XCircle className="w-5 h-5 text-red-500" />
                          ) : (
                            <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{exec.connector_name}</p>
                          <p className="text-xs text-gray-500">{formatDate(exec.started_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {exec.leads_fetched} fetched, {exec.leads_created} created
                          </p>
                          <p className="text-xs text-gray-400">
                            {exec.duration_ms ? `${exec.duration_ms}ms` : 'Running...'}
                          </p>
                        </div>
                        {expandedExecution === exec.id ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {expandedExecution === exec.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-5 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Fetched</p>
                            <p className="font-medium">{exec.leads_fetched}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Created</p>
                            <p className="font-medium">{exec.leads_created}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Duplicates</p>
                            <p className="font-medium">{exec.leads_duplicates}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Invalid</p>
                            <p className="font-medium">{exec.leads_invalid}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">HOT</p>
                            <p className="font-medium text-red-600">{exec.hot_leads_detected}</p>
                          </div>
                        </div>
                        {exec.error_message && (
                          <div className="mt-4 p-3 bg-red-50 rounded text-sm text-red-700">
                            <p className="font-medium">Error:</p>
                            <p className="font-mono text-xs mt-1">{exec.error_message}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && metrics && (
          <>
            {/* System Metrics Summary */}
            <div className="grid grid-cols-5 gap-4">
              <Card className="text-center p-4">
                <TrendingUp className="w-6 h-6 mx-auto text-blue-500 mb-2" />
                <p className="text-2xl font-bold text-gray-900">{metrics.leadsPerMinute.toFixed(1)}</p>
                <p className="text-xs text-gray-500">Leads/min</p>
              </Card>
              <Card className="text-center p-4">
                <BarChart3 className="w-6 h-6 mx-auto text-blue-500 mb-2" />
                <p className="text-2xl font-bold text-gray-900">{metrics.leadsPerHour}</p>
                <p className="text-xs text-gray-500">Leads/hour</p>
              </Card>
              <Card className="text-center p-4">
                <CheckCircle className="w-6 h-6 mx-auto text-green-500 mb-2" />
                <p className="text-2xl font-bold text-green-600">{metrics.successRate}%</p>
                <p className="text-xs text-gray-500">Success rate</p>
              </Card>
              <Card className="text-center p-4">
                <XCircle className="w-6 h-6 mx-auto text-red-500 mb-2" />
                <p className="text-2xl font-bold text-red-600">{metrics.failureRate}%</p>
                <p className="text-xs text-gray-500">Failure rate</p>
              </Card>
              <Card className="text-center p-4">
                <Clock className="w-6 h-6 mx-auto text-purple-500 mb-2" />
                <p className="text-2xl font-bold text-gray-900">{metrics.avgExecutionTime}ms</p>
                <p className="text-xs text-gray-500">Avg execution</p>
              </Card>
            </div>

            {/* Additional Metrics */}
            <Card>
              <h2 className="text-lg font-semibold mb-4">Daily Performance</h2>
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Leads Today</p>
                  <p className="text-3xl font-bold text-gray-900">{metrics.leadsPerDay}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">HOT Leads</p>
                  <p className="text-3xl font-bold text-red-600">
                    {Math.round(metrics.leadsPerHour * (metrics.hotLeadsRate / 100)) || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Active Connectors</p>
                  <p className="text-3xl font-bold text-gray-900">{metrics.totalConnectorsActive}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Executions Today</p>
                  <p className="text-3xl font-bold text-gray-900">{metrics.totalExecutionsToday}</p>
                </div>
              </div>
            </Card>

            {/* Per-Connector Metrics */}
            <Card>
              <h2 className="text-lg font-semibold mb-4">Connector Performance</h2>
              <div className="space-y-3">
                {connectorMetrics.map((cm) => (
                  <div key={cm.connector_type} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900 capitalize">{cm.connector_type}</h3>
                      <Badge variant={cm.successRate >= 90 ? 'success' : cm.successRate >= 70 ? 'warning' : 'danger'}>
                        {cm.successRate}% success
                      </Badge>
                    </div>
                    <div className="grid grid-cols-6 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500">Executions</p>
                        <p className="font-medium">{cm.executions}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Successes</p>
                        <p className="font-medium text-green-600">{cm.successes}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Failures</p>
                        <p className="font-medium text-red-600">{cm.failures}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Avg Time</p>
                        <p className="font-medium">{cm.avgExecutionTime}ms</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Leads Created</p>
                        <p className="font-medium">{cm.totalLeadsCreated}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">HOT Leads</p>
                        <p className="font-medium text-red-600">{cm.totalHotLeads}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <Card>
            <h2 className="text-lg font-semibold mb-4">Scheduler Jobs</h2>
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.connector_id}
                  className={cn(
                    'p-4 rounded-lg border',
                    job.is_enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">{job.connector_name}</h3>
                        <Badge variant={job.is_enabled ? 'success' : 'default'}>
                          {job.is_enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <span className="text-xs text-gray-400 uppercase">{job.connector_type}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {job.next_run_at ? `Next: ${formatRelativeDate(job.next_run_at)}` : 'Not scheduled'}
                        </span>
                        <span>Success: {job.total_successes}</span>
                        <span>Failures: {job.total_failures}</span>
                        {job.consecutive_failures > 0 && (
                          <span className="text-red-600">Consecutive fails: {job.consecutive_failures}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleTriggerJob(job.connector_id)}
                        disabled={!job.is_enabled}
                        icon={<Play className="w-3 h-3" />}
                      >
                        Run
                      </Button>
                      <Button
                        size="sm"
                        variant={job.is_enabled ? 'ghost' : 'secondary'}
                        onClick={() => handleToggleJob(job.connector_id, !job.is_enabled)}
                        icon={job.is_enabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      >
                        {job.is_enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Errors Tab */}
        {activeTab === 'errors' && (
          <Card>
            <h2 className="text-lg font-semibold mb-4">Error Logs</h2>
            <div className="space-y-3">
              {errors.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No errors recorded</p>
              ) : (
                errors.map((error) => (
                  <div
                    key={error.id}
                    className={cn(
                      'p-4 rounded-lg border',
                      error.resolved ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={
                              error.severity === 'critical'
                                ? 'danger'
                                : error.severity === 'error'
                                ? 'danger'
                                : 'warning'
                            }
                            size="sm"
                          >
                            {error.severity}
                          </Badge>
                          <span className="text-xs text-gray-500">{error.component}</span>
                          {error.resolved && (
                            <Badge variant="success" size="sm">
                              Resolved
                            </Badge>
                          )}
                        </div>
                        <p className={cn('text-sm', error.resolved ? 'text-gray-500' : 'text-gray-900')}>
                          {error.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{formatRelativeDate(error.created_at)}</p>
                      </div>
                      {!error.resolved && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResolveError(error.id)}
                          icon={<CheckCircle className="w-3 h-3" />}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
