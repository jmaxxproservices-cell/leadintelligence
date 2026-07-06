// Base classes and types
export { BaseConnector } from './base';
export type {
  ConnectorConfig,
  NormalizedLead,
  RawLeadData,
  FetchResult,
  IngestResult,
  ValidationResult,
} from './base';

// Individual connectors
export { AnibisConnector, createAnibisConnector } from './anibis';
export { HomegateConnector, createHomegateConnector } from './homegate';
export { TuttiConnector, createTuttiConnector } from './tutti';
export {
  ManualImportConnector,
  ReferralConnector,
  createManualImportConnector,
  createReferralConnector,
} from './facebook';

export { WebsiteFormConnector, createWebsiteFormConnector } from './website';
export type { WebsiteFormConfig, WebsiteFormSubmission } from './website';

// Registry and orchestration
export { connectorRegistry, ConnectorType, ConnectorFactory } from './registry';
