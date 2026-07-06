// Scoring Engine
export { calculateLeadScore, updateLeadScore, recalculateAllScores, getClassification, getScoringRules, createScoringRule, updateScoringRule, CLASSIFICATION_THRESHOLDS } from './scoringEngine';
export type { ScoreBreakdown, ScoringRule, Classification } from './scoringEngine';

// Event System
export { eventSystem, processNewLead, markLeadAsHot, recordContactAttempt } from './eventSystem';
export type { LeadEventType, LeadEvent, EventPayload } from './eventSystem';

// Action Layer
export { generateWhatsAppMessage, generateEmailTemplate, generateQuoteData, sendWhatsAppMessage, sendEmail } from './actionLayer';
export type { WhatsAppMessage, EmailTemplate, MessageTemplate } from './actionLayer';

// Analytics
export { getAnalyticsMetrics, getRevenueByMonth, getPerformanceTrends } from './analytics';

// Revenue
export { updateLeadRevenue, closeLeadAsWon, closeLeadAsLost, getRevenueHistory, getScoringFeedback, reopenLead } from './revenue';
export type { RevenueUpdate, CloseLeadResult } from './revenue';

// Priority Engine
export { getPriorityActions as getPriorityActionsList, getHotLeadAlerts, getActionMetrics, createActionSession, markNotificationRead } from './priorityEngine';
export type { PriorityActionItem, AlertNotification } from './priorityEngine';

// Connectors
export * from './connectors';

// Ingestion
export {
  runAllConnectors,
  runConnector,
  importManualLead,
  processWebsiteWebhook,
  getConnectorsStatus,
  testConnector,
  setConnectorEnabled,
} from './connectors/ingestion';

// Scheduler
export {
  schedulerService,
  jobLockService,
  executionQueueService,
  errorClassificationService,
  metricsAggregationService,
} from './scheduler';
export type {
  SchedulerJob,
  ExecutionRecord,
  SystemHealthStatus,
  ErrorLogEntry,
  JobLock,
  LockResult,
  QueuedJob,
  QueueStats,
  ErrorType,
  ErrorClassification,
  ClassifiedError,
  SystemMetricsSummary,
  ConnectorMetricsSummary,
} from './scheduler';

// Legacy exports
export { BaseConnector, AnibisConnector, HomegateConnector, TuttiConnector, connectorRegistry } from './connectors';
export type { NormalizedLead, FetchResult, IngestResult, ConnectorConfig } from './connectors';
