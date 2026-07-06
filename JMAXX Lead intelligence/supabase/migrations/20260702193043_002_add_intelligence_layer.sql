/*
# JMAXX Lead Intelligence - Intelligence Layer Schema

## Overview
Extends the leads table with intelligence fields and creates tables for:
- Scoring rules configuration
- Events/audit trail
- Connector configurations

## Changes to leads table
- `classification` (text): Auto-classification (low, medium, high, hot)
- `score_breakdown` (jsonb): Detailed scoring breakdown by category
- `last_scored_at` (timestamptz): When score was last calculated
- `urgency_detected` (boolean): Whether urgency keywords were detected
- `intent_signals` (text[]): Array of detected intent signals

## New Tables

### scoring_rules
- Configurable rules for scoring leads
- Pattern matching for keywords, service types, locations

### lead_events
- Internal event flow tracking
- Supports the event-driven architecture

### connector_configs
- Placeholder for future connector configurations
*/

-- Add intelligence fields to leads
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS classification text CHECK (classification IN ('low', 'medium', 'high', 'hot')),
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_scored_at timestamptz,
  ADD COLUMN IF NOT EXISTS urgency_detected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS intent_signals text[] DEFAULT '{}';

-- Create scoring_rules table
CREATE TABLE IF NOT EXISTS scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  name text NOT NULL,
  pattern text NOT NULL,
  score_impact integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create lead_events table
CREATE TABLE IF NOT EXISTS lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}',
  source text DEFAULT 'system',
  created_at timestamptz DEFAULT now()
);

-- Create connector_configs table
CREATE TABLE IF NOT EXISTS connector_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  connector_type text NOT NULL,
  config jsonb DEFAULT '{}',
  is_active boolean DEFAULT false,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_classification ON leads(classification);
CREATE INDEX IF NOT EXISTS idx_leads_urgency ON leads(urgency_detected);
CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_type ON lead_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lead_events_created ON lead_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scoring_rules_category ON scoring_rules(category);

-- Enable RLS on new tables
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_configs ENABLE ROW LEVEL SECURITY;

-- Policies for scoring_rules (single-tenant)
DROP POLICY IF EXISTS "anon_scoring_rules" ON scoring_rules;
CREATE POLICY "anon_scoring_rules" ON scoring_rules FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Policies for lead_events (single-tenant)
DROP POLICY IF EXISTS "anon_lead_events" ON lead_events;
CREATE POLICY "anon_lead_events" ON lead_events FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Policies for connector_configs (single-tenant)
DROP POLICY IF EXISTS "anon_connector_configs" ON connector_configs;
CREATE POLICY "anon_connector_configs" ON connector_configs FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Insert default scoring rules
INSERT INTO scoring_rules (category, name, pattern, score_impact, priority, metadata) VALUES
-- Urgency keywords
('urgency', 'Urgent keyword: urgente', 'urgente', 25, 100, '{"match_type": "keyword"}'),
('urgency', 'Urgent keyword: urgent', 'urgent', 25, 100, '{"match_type": "keyword"}'),
('urgency', 'Urgent keyword: ASAP', 'asap', 20, 100, '{"match_type": "keyword"}'),
('urgency', 'Urgent keyword: immediately', 'inmediatamente', 20, 100, '{"match_type": "keyword"}'),
('urgency', 'Urgent keyword: now', 'ahora', 15, 100, '{"match_type": "keyword"}'),
('urgency', 'Time frame: today', 'hoy', 15, 90, '{"match_type": "keyword"}'),
('urgency', 'Time frame: tomorrow', 'mañana', 12, 90, '{"match_type": "keyword"}'),
('urgency', 'Time frame: this week', 'esta semana', 10, 90, '{"match_type": "keyword"}'),
('urgency', 'Problem: flood', 'inunda', 30, 95, '{"match_type": "keyword"}'),
('urgency', 'Problem: leak', 'fuga', 25, 95, '{"match_type": "keyword"}'),
('urgency', 'Problem: broken', 'roto', 20, 95, '{"match_type": "keyword"}'),

-- Intent signals
('intent', 'Budget mentioned', 'presupuesto', 10, 80, '{"match_type": "keyword"}'),
('intent', 'Budget mentioned', 'budget', 10, 80, '{"match_type": "keyword"}'),
('intent', 'Looking for', 'busco', 5, 70, '{"match_type": "keyword"}'),
('intent', 'Need quotes', 'cotización', 10, 80, '{"match_type": "keyword"}'),
('intent', 'Decision maker: we need', 'necesitamos', 8, 75, '{"match_type": "keyword"}'),
('intent', 'Ready to proceed', 'proceder', 15, 85, '{"match_type": "keyword"}'),
('intent', 'Timeframe: next month', 'próximo mes', 8, 70, '{"match_type": "keyword"}'),

-- Service type scoring
('service', 'High value: renovation', 'renovación', 15, 60, '{"match_type": "service_type"}'),
('service', 'High value: construction', 'construcción', 20, 60, '{"match_type": "service_type"}'),
('service', 'High value: solar', 'solar', 18, 60, '{"match_type": "service_type"}'),
('service', 'Medium value: heating', 'calefacción', 12, 60, '{"match_type": "service_type"}'),
('service', 'Medium value: bathroom', 'baño', 10, 60, '{"match_type": "service_type"}'),
('service', 'Medium value: kitchen', 'cocina', 10, 60, '{"match_type": "service_type"}'),
('service', 'Low value: cleaning', 'limpieza', 3, 60, '{"match_type": "service_type"}'),

-- Geographic bonuses (Swiss major cities)
('geographic', 'Zurich city', 'zurich', 10, 50, '{"match_type": "city", "canton": "Zurich"}'),
('geographic', 'Geneva city', 'geneva', 8, 50, '{"match_type": "city", "canton": "Geneva"}'),
('geographic', 'Basel city', 'basel', 8, 50, '{"match_type": "city", "canton": "Basel-Stadt"}'),
('geographic', 'Bern city', 'bern', 7, 50, '{"match_type": "city", "canton": "Bern"}'),
('geographic', 'Lausanne city', 'lausanne', 7, 50, '{"match_type": "city", "canton": "Vaud"}'),
('geographic', 'Lucerne city', 'lucerne', 5, 50, '{"match_type": "city", "canton": "Lucerne"}')

ON CONFLICT DO NOTHING;