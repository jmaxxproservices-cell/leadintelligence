import React, { useState } from 'react';
import { Header } from '../components/layout';
import { Card, Badge, Button, Input } from '../components/ui';
import {
  Code,
  Copy,
  Check,
  ChevronRight,
  Terminal,
  Link,
  Key,
  FileJson,
} from 'lucide-react';

export function ApiPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div>
      <Header
        title="API"
        subtitle="Documentación de la API REST para integraciones externas"
      />

      <div className="p-6 max-w-5xl">
        <Card className="mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Key className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">API Key</h3>
              <p className="text-sm text-gray-500 mb-3">
                Utiliza esta clave para autenticar las peticiones a la API
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={import.meta.env.VITE_SUPABASE_URL ? 'sk_live_***' : 'No configurada'}
                  disabled
                  className="font-mono"
                />
                <Button variant="secondary">Regenerar</Button>
              </div>
            </div>
          </div>
        </Card>

        <h2 className="text-lg font-semibold text-gray-900 mb-4">Endpoints disponibles</h2>

        <div className="space-y-4">
          {/* POST /api/leads */}
          <Card>
            <div className="flex items-start gap-4">
              <Badge variant="success">POST</Badge>
              <div className="flex-1">
                <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                  /api/v1/leads
                </code>
                <p className="text-sm text-gray-600 mt-2">
                  Crear un nuevo lead desde un sistema externo
                </p>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">REQUEST BODY</p>
                  <div className="relative">
                    <pre className="bg-gray-900 rounded-lg p-4 text-sm text-gray-100 overflow-x-auto">
{`{
  "source": "anibis",
  "title": "Renovación cocina Zurich",
  "description": "Cliente busca reformar cocina...",
  "city": "Zurich",
  "canton": "Zurich",
  "service_type": "renovation",
  "contact_name": "Juan Pérez",
  "phone": "+41 79 123 45 67",
  "email": "juan@ejemplo.com",
  "external_id": "ANB-12345",
  "external_url": "https://anibis.ch/..."
}`}
                    </pre>
                    <button
                      onClick={() => handleCopy(`{
  "source": "anibis",
  "title": "Renovación cocina Zurich",
  "description": "Cliente busca reformar cocina...",
  "city": "Zurich",
  "canton": "Zurich",
  "service_type": "renovation",
  "contact_name": "Juan Pérez",
  "phone": "+41 79 123 45 67",
  "email": "juan@ejemplo.com",
  "external_id": "ANB-12345",
  "external_url": "https://anibis.ch/..."
}`, 'post-body')}
                      className="absolute top-2 right-2 p-1 rounded bg-gray-800 text-gray-400 hover:text-white"
                    >
                      {copied === 'post-body' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">RESPONSE 201</p>
                  <pre className="bg-gray-900 rounded-lg p-4 text-sm text-green-400 overflow-x-auto">
{`{
  "success": true,
  "data": {
    "id": "uuid-here",
    "status": "new",
    "score": 50,
    "created_at": "2024-01-15T10:30:00Z"
  }
}`}
                  </pre>
                </div>
              </div>
            </div>
          </Card>

          {/* GET /api/leads */}
          <Card>
            <div className="flex items-start gap-4">
              <Badge variant="info">GET</Badge>
              <div className="flex-1">
                <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                  /api/v1/leads
                </code>
                <p className="text-sm text-gray-600 mt-2">
                  Obtener lista de leads con filtros opcionales
                </p>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">QUERY PARAMETERS</p>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
                    <div><code className="text-blue-600">status</code> - Filtrar por estado</div>
                    <div><code className="text-blue-600">source</code> - Filtrar por fuente</div>
                    <div><code className="text-blue-600">limit</code> - Límite de resultados (default: 50)</div>
                    <div><code className="text-blue-600">offset</code> - Desplazamiento para paginación</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* GET /api/leads/:id */}
          <Card>
            <div className="flex items-start gap-4">
              <Badge variant="info">GET</Badge>
              <div className="flex-1">
                <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                  /api/v1/leads/:id
                </code>
                <p className="text-sm text-gray-600 mt-2">
                  Obtener un lead específico por su ID
                </p>
              </div>
            </div>
          </Card>

          {/* PATCH /api/leads/:id */}
          <Card>
            <div className="flex items-start gap-4">
              <Badge variant="warning">PATCH</Badge>
              <div className="flex-1">
                <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                  /api/v1/leads/:id
                </code>
                <p className="text-sm text-gray-600 mt-2">
                  Actualizar campos de un lead existente
                </p>
              </div>
            </div>
          </Card>

          {/* POST /api/leads/:id/notes */}
          <Card>
            <div className="flex items-start gap-4">
              <Badge variant="success">POST</Badge>
              <div className="flex-1">
                <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                  /api/v1/leads/:id/notes
                </code>
                <p className="text-sm text-gray-600 mt-2">
                  Añadir una nota a un lead
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="mt-8 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-4">
            <div className="text-yellow-600">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-yellow-800 mb-1">Próximos pasos</h3>
              <p className="text-sm text-yellow-700">
                Esta API está preparada para recibir datos de conectores externos.
                En el Sprint 2 se implementará el primer conector (Anibis).
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
