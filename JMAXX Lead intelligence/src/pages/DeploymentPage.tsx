import React from 'react';
import { Card } from '../components/ui';
import { Server, Globe, Database, CheckCircle, ExternalLink, Copy } from 'lucide-react';

export function DeploymentPage() {
  const webhookUrl = 'https://ffnehjvnbdayzlwxttjh.supabase.co/functions/v1/website-form';
  const supabaseUrl = 'https://supabase.com/dashboard/project/ffnehjvnbdayzlwxttjh';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Production Deployment</h1>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle className="w-5 h-5" />
          <span className="font-semibold">Production Ready</span>
        </div>
        <p className="text-sm text-green-600 mt-1">
          Build successful. Database connected. Edge function deployed.
        </p>
      </div>

      <div className="grid gap-4">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Database className="w-6 h-6 text-blue-500 mt-1" />
            <div className="flex-1">
              <h2 className="font-semibold">Supabase Project</h2>
              <p className="text-sm text-gray-500 mt-1">Connected and operational</p>
              <div className="mt-2 bg-gray-100 p-2 rounded text-sm font-mono">
                https://ffnehjvnbdayzlwxttjh.supabase.co
              </div>
              <a
                href={supabaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:underline"
              >
                Open Dashboard <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">CONNECTED</span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Server className="w-6 h-6 text-purple-500 mt-1" />
            <div className="flex-1">
              <h2 className="font-semibold">Webhook Endpoint</h2>
              <p className="text-sm text-gray-500 mt-1">Ready to receive form submissions</p>
              <div className="mt-2 bg-gray-100 p-2 rounded text-sm font-mono flex items-center justify-between">
                <span className="truncate">{webhookUrl}</span>
                <button
                  onClick={() => copyToClipboard(webhookUrl)}
                  className="ml-2 text-gray-500 hover:text-gray-700"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded mt-2 inline-block">
                ACTIVE
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Globe className="w-6 h-6 text-orange-500 mt-1" />
            <div className="flex-1">
              <h2 className="font-semibold">Deploy to Production</h2>
              <p className="text-sm text-gray-500 mt-1">Choose a hosting platform:</p>

              <div className="mt-3 space-y-2">
                <div className="bg-gray-50 p-3 rounded">
                  <p className="font-medium text-sm">Vercel (Recommended)</p>
                  <code className="text-xs bg-gray-200 px-1 rounded">vercel --prod</code>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="font-medium text-sm">Netlify</p>
                  <code className="text-xs bg-gray-200 px-1 rounded">netlify deploy --prod</code>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-3">
                Environment variables are configured in .env
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-blue-50 border-blue-200">
          <h2 className="font-semibold text-blue-900">Domain Setup</h2>
          <p className="text-sm text-blue-700 mt-2">
            After deployment, configure DNS for crm.jmaxxproservices.com:
          </p>
          <div className="mt-3 bg-blue-100 p-3 rounded font-mono text-sm text-blue-800">
            <p>crm.jmaxxproservices.com CNAME cname.vercel-dns.com</p>
          </div>
        </Card>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-sm text-gray-700 mb-2">Quick Checklist</h3>
        <ul className="space-y-1 text-sm text-gray-600">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Build passes
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Database connected
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Edge function deployed
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Environment variables configured
          </li>
          <li className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
            Deploy to hosting
          </li>
          <li className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
            Configure custom domain
          </li>
          <li className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
            Connect Shopify form
          </li>
        </ul>
      </div>
    </div>
  );
}
