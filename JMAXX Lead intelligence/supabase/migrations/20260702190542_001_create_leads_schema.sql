/*
# JMAXX Lead Intelligence - Core Schema

## Overview
Creates the foundational tables for lead management:
- `leads`: Main entity for capturing and tracking business opportunities
- `activities`: Timeline of actions and events for each lead
- `activity_types`: Enum for activity categorization

## Tables

### leads
- `id` (uuid, PK): Unique identifier
- `source` (text): Origin of the lead (e.g., "anibis", "tutti", "manual")
- `title` (text): Lead title/subject
- `description` (text): Detailed description
- `city` (text): City location
- `canton` (text): Swiss canton
- `service_type` (text): Type of service requested
- `priority` (text): "low", "medium", "high", "urgent"
- `score` (integer): Lead quality score (0-100)
- `status` (text): Pipeline status (new, in_review, contacted, quote_sent, won, lost)
- `contact_name` (text): Contact person name
- `phone` (text): Contact phone
- `email` (text): Contact email
- `notes` (text): Internal notes
- `external_id` (text): ID from external source (for deduplication)
- `external_url` (text): Link to original listing
- `created_at` (timestamptz): Creation timestamp
- `updated_at` (timestamptz): Last update timestamp

### activities
- `id` (uuid, PK): Unique identifier
- `lead_id` (uuid, FK): Reference to lead
- `type` (text): Activity type
- `title` (text): Activity title
- `description` (text): Activity details
- `metadata` (jsonb): Additional structured data
- `created_at` (timestamptz): When activity was logged

## Security
- RLS enabled on all tables
- Single-tenant app (no auth): Policies allow anon + authenticated full access
- Prepared for future multi-tenant migration
*/

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'manual',
  title text NOT NULL,
  description text,
  city text,
  canton text,
  service_type text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  score integer DEFAULT 50 CHECK (score >= 0 AND score <= 100),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'contacted', 'quote_sent', 'won', 'lost')),
  contact_name text,
  phone text,
  email text,
  notes text,
  external_id text,
  external_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint on external_id per source for deduplication
  CONSTRAINT unique_external_lead UNIQUE (source, external_id)
);

-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Lead policies (single-tenant, no auth required yet)
DROP POLICY IF EXISTS "anon_select_leads" ON leads;
CREATE POLICY "anon_select_leads" ON leads FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_leads" ON leads;
CREATE POLICY "anon_insert_leads" ON leads FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_leads" ON leads;
CREATE POLICY "anon_update_leads" ON leads FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_leads" ON leads;
CREATE POLICY "anon_delete_leads" ON leads FOR DELETE
  TO anon, authenticated USING (true);

-- Activity policies (single-tenant, no auth required yet)
DROP POLICY IF EXISTS "anon_select_activities" ON activities;
CREATE POLICY "anon_select_activities" ON activities FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_activities" ON activities;
CREATE POLICY "anon_insert_activities" ON activities FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_activities" ON activities;
CREATE POLICY "anon_update_activities" ON activities FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_activities" ON activities;
CREATE POLICY "anon_delete_activities" ON activities FOR DELETE
  TO anon, authenticated USING (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for leads table
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();