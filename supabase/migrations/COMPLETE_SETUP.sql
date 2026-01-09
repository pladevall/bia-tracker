-- =====================================
-- COMPLETE DATABASE SETUP FOR BIA TRACKER
-- Run this entire script in Supabase SQL Editor
-- =====================================

-- 1. BIA Entries Table (for BIA measurements)
-- =====================================

CREATE TABLE IF NOT EXISTS bia_entries (
  id UUID PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bia_entries_date ON bia_entries(date DESC);

ALTER TABLE bia_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to bia_entries" ON bia_entries
  FOR ALL USING (true);

COMMENT ON TABLE bia_entries IS 'Stores BIA measurement data parsed from uploaded images';

-- 2. Bodyspec Integration Tables (for DEXA scans)
-- =====================================

CREATE TABLE IF NOT EXISTS bodyspec_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  access_token TEXT NOT NULL,
  token_name TEXT NOT NULL,
  last_sync TIMESTAMP WITH TIME ZONE,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('connected', 'error', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bodyspec_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES bodyspec_connections(id) ON DELETE CASCADE,
  scan_date DATE NOT NULL,
  appointment_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(connection_id, appointment_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bodyspec_connections_user_id ON bodyspec_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_bodyspec_connections_sync_status ON bodyspec_connections(sync_status);
CREATE INDEX IF NOT EXISTS idx_bodyspec_scans_connection_id ON bodyspec_scans(connection_id);
CREATE INDEX IF NOT EXISTS idx_bodyspec_scans_scan_date ON bodyspec_scans(scan_date DESC);
CREATE INDEX IF NOT EXISTS idx_bodyspec_scans_appointment_id ON bodyspec_scans(appointment_id);

-- Auto-update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_bodyspec_connections_updated_at
  BEFORE UPDATE ON bodyspec_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bodyspec_scans_updated_at
  BEFORE UPDATE ON bodyspec_scans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE bodyspec_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE bodyspec_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to bodyspec_connections" ON bodyspec_connections
  FOR ALL USING (true);

CREATE POLICY "Allow all access to bodyspec_scans" ON bodyspec_scans
  FOR ALL USING (true);

-- Comments
COMMENT ON TABLE bodyspec_connections IS 'Stores Bodyspec API connection credentials and metadata';
COMMENT ON TABLE bodyspec_scans IS 'Stores DEXA scan results fetched from Bodyspec API';

-- =====================================
-- SETUP COMPLETE!
-- You can now use the BIA Tracker with Bodyspec integration
-- =====================================
