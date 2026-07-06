/*
# JMAXX Lead Intelligence - Production Hardening

## Overview
Adds reliability layer for production use:
- Job locks for concurrent execution prevention
- Execution queue for controlled processing
- System-wide metrics aggregation
- Error classification

## New Tables

### job_locks
- Prevents concurrent execution of same connector
- TTL-based expiration for stale locks
- Lock state tracking

### execution_queue
- Internal queue for job execution
- Priority-based scheduling
- Retry state management

### system_metrics
- Aggregated metrics over time
- Hourly and daily aggregations
- Performance tracking

### error_classifications
- Categorizes errors (transient vs permanent)
- Recovery strategies
*/

-- Job locks table
CREATE TABLE IF NOT EXISTS job_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id text NOT NULL UNIQUE,
  execution_id uuid,
  locked_at timestamptz DEFAULT now(),
  locked_by text DEFAULT 'scheduler',
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'
);

-- Execution queue table
CREATE TABLE IF NOT EXISTS execution_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id text NOT NULL,
  connector_name text NOT NULL,
  connector_type text NOT NULL,
  priority integer DEFAULT 5,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  scheduled_for timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  error_type text,
  error_message text,
  is_transient_error boolean,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- System metrics table (aggregated)
CREATE TABLE IF NOT EXISTS system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  granularity text NOT NULL CHECK (granularity IN ('minute', 'hour', 'day')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  connector_type text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(metric_name, granularity, period_start, connector_type)
);

-- Error classifications table
CREATE TABLE IF NOT EXISTS error_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_pattern text NOT NULL,
  error_type text NOT NULL CHECK (error_type IN ('transient', 'permanent', 'configuration', 'rate_limit', 'network', 'timeout', 'unknown')),
  severity integer DEFAULT 3,
  recovery_strategy text,
  recovery_action text,
  retry_allowed boolean DEFAULT true,
  retry_delay_seconds integer DEFAULT 60,
  max_retries integer DEFAULT 3,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_locks_connector ON job_locks(connector_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_job_locks_expires ON job_locks(expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_execution_queue_status ON execution_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_execution_queue_priority ON execution_queue(priority, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_system_metrics_period ON system_metrics(granularity, period_start);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name, period_start);

-- Enable RLS
ALTER TABLE job_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_job_locks" ON job_locks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_execution_queue" ON execution_queue FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_system_metrics" ON system_metrics FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_error_classifications" ON error_classifications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Insert default error classifications
INSERT INTO error_classifications (error_pattern, error_type, severity, recovery_strategy, retry_allowed, retry_delay_seconds, max_retries) VALUES
  ('ECONNREFUSED', 'network', 2, 'Retry with backoff', true, 30, 5),
  ('ETIMEDOUT', 'timeout', 2, 'Retry with longer timeout', true, 60, 3),
  ('ENOTFOUND', 'network', 2, 'Retry with backoff', true, 30, 3),
  ('rate limit', 'rate_limit', 3, 'Wait and retry', true, 300, 2),
  ('429', 'rate_limit', 3, 'Wait and retry', true, 300, 2),
  ('503', 'transient', 2, 'Retry with backoff', true, 60, 3),
  ('502', 'transient', 2, 'Retry with backoff', true, 60, 3),
  ('401', 'configuration', 4, 'Check credentials', false, 0, 0),
  ('403', 'configuration', 4, 'Check permissions', false, 0, 0),
  ('404', 'permanent', 3, 'Resource not found', false, 0, 0),
  ('validation', 'permanent', 3, 'Fix data format', false, 0, 0),
  ('duplicate', 'permanent', 2, 'Skip duplicate', false, 0, 0)
ON CONFLICT DO NOTHING;