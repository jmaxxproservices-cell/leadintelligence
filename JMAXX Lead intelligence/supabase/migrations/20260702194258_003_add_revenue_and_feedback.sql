/*
# JMAXX Lead Intelligence - Revenue & Feedback Layer

## Overview
Extends the system with revenue tracking and feedback loop:
- Revenue tracking for won leads
- Feedback system for scoring validation
- Analytics data for performance metrics

## Changes to leads table
- `revenue` (numeric): Revenue amount when lead is won
- `revenue_currency` (text): Currency code (default CHF)
- `closed_at` (timestamptz): When lead was won/lost
- `time_to_close_days` (integer): Days from creation to close

## New Tables

### scoring_feedback
- Tracks prediction accuracy
- Links lead outcome to initial score/classification
- Enables future ML improvements

### revenue_history
- Audit trail for revenue updates
- Tracks changes over time
*/

-- Add new check constraint for simplified status
ALTER TABLE leads ADD CONSTRAINT leads_status_check 
  CHECK (status IN ('new', 'contacted', 'quoted', 'won', 'lost'));

-- Add revenue fields to leads
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS revenue numeric(12, 2),
  ADD COLUMN IF NOT EXISTS revenue_currency text DEFAULT 'CHF',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS time_to_close_days integer;

-- Create scoring_feedback table
CREATE TABLE IF NOT EXISTS scoring_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  initial_score integer NOT NULL,
  initial_classification text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('won', 'lost')),
  revenue numeric(12, 2),
  is_accurate boolean,
  false_positive boolean DEFAULT false,
  false_negative boolean DEFAULT false,
  feedback_notes text,
  created_at timestamptz DEFAULT now()
);

-- Create revenue_history table
CREATE TABLE IF NOT EXISTS revenue_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  old_revenue numeric(12, 2),
  new_revenue numeric(12, 2),
  old_status text,
  new_status text,
  changed_by text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_revenue ON leads(revenue) WHERE revenue IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_closed_at ON leads(closed_at);
CREATE INDEX IF NOT EXISTS idx_scoring_feedback_lead ON scoring_feedback(lead_id);
CREATE INDEX IF NOT EXISTS idx_revenue_history_lead ON revenue_history(lead_id);

-- Enable RLS
ALTER TABLE scoring_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_history ENABLE ROW LEVEL SECURITY;

-- Policies for scoring_feedback (single-tenant)
DROP POLICY IF EXISTS "anon_scoring_feedback" ON scoring_feedback;
CREATE POLICY "anon_scoring_feedback" ON scoring_feedback FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Policies for revenue_history (single-tenant)
DROP POLICY IF EXISTS "anon_revenue_history" ON revenue_history;
CREATE POLICY "anon_revenue_history" ON revenue_history FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Trigger to auto-calculate time_to_close_days
CREATE OR REPLACE FUNCTION calculate_time_to_close()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('won', 'lost') AND OLD.status NOT IN ('won', 'lost') THEN
    NEW.closed_at = COALESCE(NEW.closed_at, now());
    NEW.time_to_close_days = EXTRACT(DAY FROM (NEW.closed_at - NEW.created_at))::integer;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_time_to_close ON leads;
CREATE TRIGGER trg_calculate_time_to_close
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION calculate_time_to_close();