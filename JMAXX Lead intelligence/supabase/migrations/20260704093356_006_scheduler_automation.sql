/*
# JMAXX Lead Intelligence - Scheduler & Automation

## Overview
Adds tables for:
- Scheduler jobs configuration
- Execution history tracking
- System health monitoring
- Error logging

## New Tables

### scheduler_jobs
- Stores automated job configuration
- Supports cron schedules
- Tracks execution state

### execution_history
- Full audit trail of all executions
- Performance metrics
- Error details

### system_health
- Overall system status
- Uptime tracking
- Component health

### error_logs
- Centralized error logging
- Stack traces and context
*/

-- Scheduler jobs table
CREATE TABLE IF NOT EXISTS scheduler_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id text NOT NULL,
  connector_name text NOT NULL,
  connector_type text NOT NULL,
  schedule_cron text NOT NULL DEFAULT '0 */30 * * * *',
  is_enabled boolean DEFAULT true,
  max_retries integer DEFAULT 3,
  retry_delay_seconds integer DEFAULT 60,
  timeout_seconds integer DEFAULT 300,
  last_execution_id uuid,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_status text DEFAULT 'pending',
  consecutive_failures integer DEFAULT 0,
  total_runs integer DEFAULT 0,
  total_successes integer DEFAULT 0,
  total_failures integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(connector_id)
);

-- Execution history table
CREATE TABLE IF NOT EXISTS execution_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES scheduler_jobs(id) ON DELETE CASCADE,
  connector_id text NOT NULL,
  connector_name text NOT NULL,
  connector_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'timeout', 'retrying')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  leads_fetched integer DEFAULT 0,
  leads_created integer DEFAULT 0,
  leads_duplicates integer DEFAULT 0,
  leads_invalid integer DEFAULT 0,
  hot_leads_detected integer DEFAULT 0,
  retries_attempted integer DEFAULT 0,
  error_message text,
  error_stack text,
  metadata jsonb DEFAULT '{}'
);

-- System health table
CREATE TABLE IF NOT EXISTS system_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('healthy', 'degraded', 'down', 'unknown')),
  last_check timestamptz DEFAULT now(),
  last_success timestamptz,
  last_failure timestamptz,
  uptime_seconds bigint DEFAULT 0,
  total_checks integer DEFAULT 0,
  successful_checks integer DEFAULT 0,
  failed_checks integer DEFAULT 0,
  response_time_ms integer,
  error_message text,
  metadata jsonb DEFAULT '{}'
);

-- Error logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  message text NOT NULL,
  stack_trace text,
  context jsonb DEFAULT '{}',
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_next_run ON scheduler_jobs(next_run_at) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_execution_history_started ON execution_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_history_connector ON execution_history(connector_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_component ON error_logs(component);

-- Enable RLS
ALTER TABLE scheduler_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_scheduler_jobs" ON scheduler_jobs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_execution_history" ON execution_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_system_health" ON system_health FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_error_logs" ON error_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Initialize system health components
INSERT INTO system_health (component, status, last_check)
VALUES 
  ('scheduler', 'healthy', now()),
  ('connectors', 'healthy', now()),
  ('database', 'healthy', now()),
  ('scoring_engine', 'healthy', now()),
  ('priority_engine', 'healthy', now())
ON CONFLICT (component) DO NOTHING;

-- Initialize scheduler jobs from existing connectors
INSERT INTO scheduler_jobs (connector_id, connector_name, connector_type, schedule_cron, is_enabled)
SELECT 
  id::text,
  connector_name,
  connector_type,
  COALESCE(schedule_cron, '*/30 * * * *'),
  is_active
FROM scheduled_ingestions
ON CONFLICT (connector_id) DO NOTHING;