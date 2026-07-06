import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Card, Button, Badge } from '../components/ui';
import {
  runAllConnectors,
  runConnector,
  getConnectorsStatus,
  testConnector,
  setConnectorEnabled,
} from '../services';
import {
  Globe,
  Key,
  Zap,
  Database,
  RefreshCw,
  Check,
  AlertCircle,
  Clock,
  Play,
  Settings,
  Pause,
  TestTube,
} from 'lucide-react';

interface ConnectorInfo {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  lastRun: string | null;
  status: 'active' | 'inactive' | 'error';
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    connector: string;
    fetched: number;
    created: number;
    duration: number;
  } | null>(null);

  useEffect(() => {
    loadConnectors();
  }, []);

  const loadConnectors = async () => {
    setLoading(true);
    const status = await getConnectorsStatus();
    setConnectors(status);
    setLoading(false);
  };

  const handleRunConnector = async (connectorId: string) => {
    setRunning(connectorId);
    setLastResult(null);

    try {
      const result = await runConnector(connectorId, {
        autoScore: true,
        generateAlerts: true,
      });

      if (result) {
        setLastResult({
          connector: result.connectorName,
          fetched: result.fetched,
          created: result.created,
          duration: result.duration,
        });
      }
    } catch (error) {
      console.error('Failed to run connector:', error);
    }

    setRunning(null);
    loadConnectors();
  };

  const handleRunAll = async () => {
    setRunning('all');
    setLastResult(null);

    try {
      const results = await runAllConnectors({
        autoScore: true,
        generateAlerts: true,
      });

      const totalFetched = results.reduce((sum, r) => sum + r.fetched, 0);
      const totalCreated = results.reduce((sum, r) => sum + r.created, 0);

      setLastResult({
        connector: 'All Connectors',
        fetched: totalFetched,
        created: totalCreated,
        duration: 0,
      });
    } catch (error) {
      console.error('Failed to run all connectors:', error);
    }

    setRunning(null);
    loadConnectors();
  };

  const handleToggleConnector = async (connectorId: string, enabled: boolean) => {
    await setConnectorEnabled(connectorId, enabled);
    loadConnectors();
  };

  const handleTestConnector = async (connectorId: string) => {
    const result = await testConnector(connectorId);
    alert(result.message);
  };

  const getConnectorIcon = (type: string) => {
    switch (type) {
      case 'anibis':
        return <Globe className="w-6 h-6" />;
      case 'homegate':
        return <Database className="w-6 h-6" />;
      case 'tutti':
        return <Globe className="w-6 h-6" />;
      case 'manual':
        return <Key className="w-6 h-6" />;
      case 'website':
        return <Globe className="w-6 h-6" />;
      case 'referral':
        return <Zap className="w-6 h-6" />;
      default:
        return <Globe className="w-6 h-6" />;
    }
  };

  return (
    <div>
      <Header title="Connectors" subtitle="Manage lead acquisition sources" />

      <div className="p-6 max-w-5xl">
        {/* Actions Bar */}
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Ingestion Control</h2>
              <p className="text-sm text-gray-500">Run connectors manually or view status</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={loadConnectors}
                icon={<RefreshCw className="w-4 h-4" />}
              >
                Refresh
              </Button>
              <Button
                onClick={handleRunAll}
                loading={running === 'all'}
                icon={<Play className="w-4 h-4" />}
              >
                Run All Active
              </Button>
            </div>
          </div>

          {lastResult && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>{lastResult.connector}</strong>: {lastResult.fetched} leads fetched,{' '}
                {lastResult.created} created
              </p>
            </div>
          )}
        </Card>

        {/* Connector List */}
        <div className="space-y-4">
          {loading ? (
            <Card>
              <div className="text-center py-8 text-gray-500">Loading connectors...</div>
            </Card>
          ) : (
            connectors.map((connector) => (
              <Card key={connector.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        connector.enabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {getConnectorIcon(connector.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{connector.name}</h3>
                        <span className="text-xs text-gray-400 uppercase">{connector.type}</span>
                      </div>
                      {connector.lastRun ? (
                        <p className="text-sm text-gray-500">
                          Last run: {new Date(connector.lastRun).toLocaleString('es-CH')}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400">Never run</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {connector.enabled ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="default">Inactive</Badge>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {connector.type !== 'manual' &&
                        connector.type !== 'website' &&
                        connector.type !== 'referral' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleRunConnector(connector.id)}
                            loading={running === connector.id}
                            icon={<Play className="w-4 h-4" />}
                          >
                            Run
                          </Button>
                        )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestConnector(connector.id)}
                        icon={<TestTube className="w-4 h-4" />}
                      >
                        Test
                      </Button>
                      <Button
                        variant={connector.enabled ? 'ghost' : 'secondary'}
                        size="sm"
                        onClick={() => handleToggleConnector(connector.id, !connector.enabled)}
                        icon={connector.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      >
                        {connector.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Architecture Info */}
        <Card className="mt-8 bg-gray-50">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Settings className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Connector Architecture</h3>
              <p className="text-sm text-gray-600 mb-3">
                Each connector implements the same interface: <code className="bg-gray-200 px-1 rounded">fetch()
                → normalize() → validate() → ingest()</code>
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-700">Available Connectors:</p>
                  <ul className="text-gray-600 mt-1 space-y-1">
                    <li>• <strong>Anibis</strong> - Services (cleaning, moving, clearance)</li>
                    <li>• <strong>Homegate</strong> - Properties (coming soon)</li>
                    <li>• <strong>Tutti.ch</strong> - Marketplace (coming soon)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Internal Sources:</p>
                  <ul className="text-gray-600 mt-1 space-y-1">
                    <li>• <strong>Manual</strong> - Direct lead entry</li>
                    <li>• <strong>Website</strong> - Form submissions</li>
                    <li>• <strong>Referral</strong> - Partner referrals</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
