import { BaseConnector, ConnectorConfig, IngestResult } from './base';
import { AnibisConnector, createAnibisConnector } from './anibis';
import { HomegateConnector, createHomegateConnector } from './homegate';
import { TuttiConnector, createTuttiConnector } from './tutti';
import {
  ManualImportConnector,
  createManualImportConnector,
  ReferralConnector,
  createReferralConnector,
} from './facebook';
import { WebsiteFormConnector, createWebsiteFormConnector } from './website';
import { supabase } from '../../lib/supabase';

// Connector type map
export type ConnectorType =
  | 'anibis'
  | 'homegate'
  | 'tutti'
  | 'facebook'
  | 'manual'
  | 'website'
  | 'referral'
  | 'api';

// Connector factory function type
export type ConnectorFactory = (config: ConnectorConfig) => BaseConnector;

// Registry for all available connectors
class ConnectorRegistry {
  private connectors: Map<string, BaseConnector> = new Map();
  private factories: Map<string, ConnectorFactory> = new Map();
  private initialized: boolean = false;

  constructor() {
    // Register built-in connector factories
    this.registerFactory('anibis', (config) => createAnibisConnector(config));
    this.registerFactory('homegate', (config) => createHomegateConnector(config));
    this.registerFactory('tutti', (config) => createTuttiConnector(config));
    this.registerFactory('manual', (config) => createManualImportConnector(config));
    this.registerFactory('website', (config) => createWebsiteFormConnector(config));
    this.registerFactory('referral', (config) => createReferralConnector(config));
  }

  // Register a custom connector factory
  registerFactory(type: string, factory: ConnectorFactory): void {
    this.factories.set(type.toLowerCase(), factory);
  }

  // Get a connector by ID
  get(connectorId: string): BaseConnector | undefined {
    return this.connectors.get(connectorId);
  }

  // Get all registered connectors
  getAll(): BaseConnector[] {
    return Array.from(this.connectors.values());
  }

  // Get enabled connectors
  getEnabled(): BaseConnector[] {
    return this.getAll().filter((c) => {
      const config = c['config'] as ConnectorConfig;
      return config.enabled !== false;
    });
  }

  // Create a connector from config
  create(config: ConnectorConfig): BaseConnector | null {
    const factory = this.factories.get(config.type.toLowerCase());
    if (!factory) {
      console.error(`No factory registered for connector type: ${config.type}`);
      return null;
    }

    const connector = factory(config);
    this.connectors.set(config.id, connector);
    return connector;
  }

  // Initialize connectors from database
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const { data: configs } = await supabase
        .from('scheduled_ingestions')
        .select('*');

      if (configs) {
        for (const config of configs) {
          this.create({
            id: config.id,
            name: config.connector_name,
            type: config.connector_type,
            enabled: config.is_active,
            maxResults: (config.config as Record<string, unknown>)?.max_results as number,
            schedule: config.schedule_cron,
            lastRun: config.last_run_at,
            metadata: config.config as Record<string, unknown>,
          });
        }
      }

      // Always ensure manual and referral connectors exist
      if (!this.connectors.has('manual')) {
        this.create({
          id: 'manual',
          name: 'Manual Import',
          type: 'manual',
          enabled: true,
        });
      }

      if (!this.connectors.has('referral')) {
        this.create({
          id: 'referral',
          name: 'Partner Referrals',
          type: 'referral',
          enabled: true,
        });
      }

      if (!this.connectors.has('website')) {
        this.create({
          id: 'website',
          name: 'Website Forms',
          type: 'website',
          enabled: true,
        });
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize connectors:', error);

      // Create default connectors even if DB fails
      this.create({ id: 'manual', name: 'Manual Import', type: 'manual', enabled: true });
      this.create({ id: 'referral', name: 'Partner Referrals', type: 'referral', enabled: true });
      this.create({ id: 'website', name: 'Website Forms', type: 'website', enabled: true });

      this.initialized = true;
    }
  }

  // Run ingestion for a specific connector
  async runIngestion(
    connectorId: string,
    options?: {
      skipDuplicates?: boolean;
      autoScore?: boolean;
      generateAlerts?: boolean;
    }
  ): Promise<IngestResult | null> {
    const connector = this.get(connectorId);
    if (!connector) {
      console.error(`Connector not found: ${connectorId}`);
      return null;
    }

    return connector.ingest(options);
  }

  // Run ingestion for all enabled connectors
  async runAllIngestions(options?: {
    skipDuplicates?: boolean;
    autoScore?: boolean;
    generateAlerts?: boolean;
  }): Promise<IngestResult[]> {
    const results: IngestResult[] = [];
    const enabledConnectors = this.getEnabled();

    for (const connector of enabledConnectors) {
      // Skip push-based connectors
      if (connector['type'] === 'manual' || connector['type'] === 'website' || connector['type'] === 'referral') {
        continue;
      }

      try {
        const result = await connector.ingest(options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to run ingestion for ${connector.name}:`, error);
      }
    }

    return results;
  }

  // Test a connector
  async testConnector(connectorId: string): Promise<{ success: boolean; message: string }> {
    const connector = this.get(connectorId);
    if (!connector) {
      return { success: false, message: `Connector not found: ${connectorId}` };
    }

    return connector.testConnection();
  }

  // Get connector status
  async getConnectorStatus(): Promise<
    Array<{
      id: string;
      name: string;
      type: string;
      enabled: boolean;
      lastRun: string | null;
      status: 'active' | 'inactive' | 'error';
    }>
  > {
    await this.initialize();

    return this.getAll().map((connector) => ({
      id: connector.id,
      name: connector.name,
      type: connector.type,
      enabled: (connector['config'] as ConnectorConfig).enabled !== false,
      lastRun: (connector['config'] as ConnectorConfig).lastRun || null,
      status: (connector['config'] as ConnectorConfig).enabled !== false ? 'active' : 'inactive',
    }));
  }

  // Clear all connectors (for testing)
  clear(): void {
    this.connectors.clear();
    this.initialized = false;
  }
}

// Singleton instance
export const connectorRegistry = new ConnectorRegistry();

// Export types and classes
export {
  BaseConnector,
  AnibisConnector,
  HomegateConnector,
  TuttiConnector,
  ManualImportConnector,
  WebsiteFormConnector,
  ReferralConnector,
  createAnibisConnector,
  createHomegateConnector,
  createTuttiConnector,
  createManualImportConnector,
  createWebsiteFormConnector,
  createReferralConnector,
};

export type {
  ConnectorConfig,
  NormalizedLead,
  RawLeadData,
  FetchResult,
  IngestResult,
  ValidationResult,
};
