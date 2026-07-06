/*
# JMAXX Lead Intelligence - Ingestion & Scheduling

## Overview
Adds tables for:
- Ingestion logs (track connector runs)
- Scheduled ingestions (cron configuration)

## New Tables

### ingestion_logs
- Tracks each connector run
- Statistics on fetched, created, duplicates
- Error logging

### scheduled_ingestions
- Stores cron schedule for connectors
- Tracks last run and next run
*/

CREATE TABLE IF NOT EXISTS ingestion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector text NOT NULL,
  source text NOT NULL,
  fetched integer DEFAULT 0,
  created integer DEFAULT 0,
  duplicates integer DEFAULT 0,
  hot_count integer DEFAULT 0,
  errors text[],
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduled_ingestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_type text NOT NULL,
  connector_name text NOT NULL,
  config jsonb DEFAULT '{}',
  schedule_cron text DEFAULT '0 */30 * * * *',
  is_active boolean DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_result jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_logs_created ON ingestion_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_connector ON scheduled_ingestions(connector_type);

ALTER TABLE ingestion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_ingestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_ingestion_logs" ON ingestion_logs FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_scheduled_ingestions" ON scheduled_ingestions FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Insert default schedule for Anibis
INSERT INTO scheduled_ingestions (connector_type, connector_name, config, schedule_cron)
VALUES ('anibis', 'Anibis Services', '{"services": ["cleaning", "moving", "clearance"], "max_results": 50}', '*/30 * * * *')
ON CONFLICT DO NOTHING;