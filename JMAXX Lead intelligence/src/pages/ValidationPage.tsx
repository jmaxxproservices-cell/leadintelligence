import React, { useState } from 'react';
import { Card, Badge, Button } from '../components/ui';
import { productionValidationService, ValidationCategory, ValidationResult } from '../services/validation';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Activity,
  Server,
  Database,
  Phone,
  Zap,
  MessageCircle,
  Bell,
  BarChart3,
  FileText,
  Settings,
  Globe,
  Monitor,
} from 'lucide-react';
import { cn } from '../utils';

const categoryIcons: Record<string, React.ReactNode> = {
  'Database Connectivity': <Database className="w-5 h-5" />,
  'Form Submission': <Globe className="w-5 h-5" />,
  'Lead Processing': <Activity className="w-5 h-5" />,
  'Duplicate Detection': <FileText className="w-5 h-5" />,
  'Phone Normalization': <Phone className="w-5 h-5" />,
  'Scoring Engine': <Zap className="w-5 h-5" />,
  'Classification': <BarChart3 className="w-5 h-5" />,
  'HOT Alert System': <Bell className="w-5 h-5" />,
  'WhatsApp Actions': <MessageCircle className="w-5 h-5" />,
  'Event Logging': <FileText className="w-5 h-5" />,
  'System Health': <Server className="w-5 h-5" />,
  'Operations Dashboard': <Monitor className="w-5 h-5" />,
};

export function ValidationPage() {
  const [categories, setCategories] = useState<ValidationCategory[]>([]);
  const [overall, setOverall] = useState<{
    status: 'pass' | 'fail' | 'warning';
    totalTests: number;
    passed: number;
    failed: number;
    warnings: number;
    passRate: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runValidation = async () => {
    setLoading(true);
    try {
      const results = await productionValidationService.runAllTests();
      setCategories(results);
      setOverall(productionValidationService.getOverallStatus(results));
      setLastRun(new Date().toISOString());
    } catch (error) {
      console.error('Validation failed:', error);
    }
    setLoading(false);
  };

  const toggleCategory = (name: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedCategories(newExpanded);
  };

  const expandAll = () => {
    setExpandedCategories(new Set(categories.map(c => c.name)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  const getStatusIcon = (status: ValidationResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'pending':
        return <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />;
      default:
        return <div className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass':
        return 'bg-green-50 border-green-200';
      case 'fail':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Validation</h1>
          <p className="text-sm text-gray-500 mt-1">
            End-to-end pipeline validation and health check
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={expandAll}
            disabled={categories.length === 0}
          >
            Expand All
          </Button>
          <Button
            variant="secondary"
            onClick={collapseAll}
            disabled={categories.length === 0}
          >
            Collapse All
          </Button>
          <Button
            onClick={runValidation}
            disabled={loading}
            icon={loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          >
            {loading ? 'Running...' : 'Run Validation'}
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      {overall && (
        <Card className={cn(
          'mb-6 p-6',
          getStatusColor(overall.status)
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center',
                overall.status === 'pass' ? 'bg-green-100' :
                overall.status === 'fail' ? 'bg-red-100' : 'bg-yellow-100'
              )}>
                <span className="text-2xl font-bold">
                  {overall.passRate}%
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">
                    {overall.status === 'pass' ? 'ALL SYSTEMS OPERATIONAL' :
                     overall.status === 'fail' ? 'SYSTEM FAILURES DETECTED' :
                     'WARNINGS PRESENT'}
                  </h2>
                  <Badge
                    variant={overall.status === 'pass' ? 'success' :
                            overall.status === 'fail' ? 'danger' : 'warning'}
                  >
                    {overall.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {overall.passed} passed, {overall.failed} failed, {overall.warnings} warnings
                </p>
              </div>
            </div>
            {lastRun && (
              <p className="text-xs text-gray-400">
                Last run: {new Date(lastRun).toLocaleString()}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {categories.length === 0 && !loading && (
        <Card className="p-12 text-center">
          <div className="text-gray-400 mb-4">
            <Settings className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No validation run yet
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Click "Run Validation" to check all components
          </p>
          <Button onClick={runValidation}>
            Run Validation
          </Button>
        </Card>
      )}

      {/* Categories */}
      <div className="space-y-4">
        {categories.map((category) => (
          <Card key={category.name} className="overflow-hidden">
            <button
              onClick={() => toggleCategory(category.name)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="text-gray-500">
                  {categoryIcons[category.name] || <Settings className="w-5 h-5" />}
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">{category.name}</h3>
                  <p className="text-sm text-gray-500">
                    {category.passed} passed, {category.failed} failed, {category.warnings} warnings
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  {category.failed > 0 && (
                    <Badge variant="danger">{category.failed} FAILED</Badge>
                  )}
                  {category.warnings > 0 && (
                    <Badge variant="warning">{category.warnings}</Badge>
                  )}
                  {category.failed === 0 && category.warnings === 0 && (
                    <Badge variant="success">PASS</Badge>
                  )}
                </div>
                {expandedCategories.has(category.name) ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {expandedCategories.has(category.name) && (
              <div className="border-t border-gray-100">
                {category.tests.map((test) => (
                  <div
                    key={test.id}
                    className={cn(
                      'px-4 py-3 flex items-center justify-between',
                      test.status === 'pass' ? 'bg-green-50/50' :
                      test.status === 'fail' ? 'bg-red-50/50' :
                      test.status === 'warning' ? 'bg-yellow-50/50' : 'bg-gray-50/50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(test.status)}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {test.test}
                        </p>
                        <p className="text-xs text-gray-500">
                          {test.message}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          test.status === 'pass' ? 'success' :
                          test.status === 'fail' ? 'danger' : 'warning'
                        }
                        size="sm"
                      >
                        {test.status.toUpperCase()}
                      </Badge>
                      {test.duration && (
                        <p className="text-xs text-gray-400 mt-1">
                          {test.duration}ms
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Quick Test Submission */}
      <Card className="mt-6 p-4 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Quick Test Submission</h3>
        <p className="text-sm text-blue-700 mb-3">
          Submit a test lead to verify the complete pipeline:
        </p>
        <pre className="bg-blue-900 text-blue-100 p-3 rounded-lg text-xs overflow-auto">
{`curl -X POST ${window.location.origin}/functions/v1/website-form \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Validation Test",
    "phone": "079 123 45 67",
    "email": "test@validation.local",
    "city": "Zurich",
    "service": "Test Service",
    "message": "Production validation test"
  }'`}
        </pre>
      </Card>
    </div>
  );
}
