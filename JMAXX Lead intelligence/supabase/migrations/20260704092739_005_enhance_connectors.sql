/*
# JMAXX Lead Intelligence - Enhanced Connector Management

## Overview
Updates connector configuration for the new architecture:
- Better metadata support
- Connector health tracking
- Webhook endpoints
*/

-- Add connector health and webhook support
ALTER TABLE scheduled_ingestions 
  ADD COLUMN IF NOT EXISTS health_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS webhook_secret text;

-- Create connector_health_logs for monitoring
CREATE TABLE IF NOT EXISTS connector_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid REFERENCES scheduled_ingestions(id) ON DELETE CASCADE,
  status text NOT NULL,
  response_time_ms integer,
  error_message text,
  checked_at timestamptz DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_connector_health_connector ON connector_health_logs(connector_id);
CREATE INDEX IF NOT EXISTS idx_connector_health_checked ON connector_health_logs(checked_at DESC);

-- Enable RLS
ALTER TABLE connector_health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_connector_health" ON connector_health_logs FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Ensure default connectors exist
INSERT INTO scheduled_ingestions (connector_type, connector_name, config, schedule_cron, is_active)
VALUES 
  ('anibis', 'Anibis Services', '{"services": ["cleaning", "moving", "clearance"], "max_results": 50}', '*/30 * * * *', true),
  ('homegate', 'Homegate Properties', '{"max_results": 30}', '0 * * * *', false),
  ('tutti', 'Tutti.ch Marketplace', '{"max_results": 30}', '0 * * * *', false)
ON CONFLICT DO NOTHING;

-- Update existing Anibis entry if missing
UPDATE scheduled_ingestions 
SET config = '{"services": ["cleaning", "moving", "clearance"], "max_results": 50}'
WHERE connector_type = 'anibis' AND config = '{}';