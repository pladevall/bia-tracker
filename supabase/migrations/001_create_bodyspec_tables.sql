-- Migration: Create Bodyspec integration tables
-- Description: Adds tables for storing Bodyspec API connections and DEXA scan data

-- Table: bodyspec_connections
-- Stores user's Bodyspec API tokens and connection metadata
CREATE TABLE IF NOT EXISTS bodyspec_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,  -- For future auth integration - nullable for now
  access_token TEXT NOT NULL,  -- Will be encrypted at application layer
  token_name TEXT NOT NULL,  -- User-friendly name (e.g., "John's Bodyspec")
  last_sync TIMESTAMP WITH TIME ZONE,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('connected', 'error', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: bodyspec_scans
-- Stores DEXA scan results from Bodyspec
CREATE TABLE IF NOT EXISTS bodyspec_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES bodyspec_connections(id) ON DELETE CASCADE,
  scan_date DATE NOT NULL,
  appointment_id TEXT,  -- Bodyspec appointment ID for deduplication
  data JSONB NOT NULL,  -- Full scan data in JSON format
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(connection_id, appointment_id)  -- Prevent duplicate scans
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bodyspec_connections_user_id ON bodyspec_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_bodyspec_connections_sync_status ON bodyspec_connections(sync_status);
CREATE INDEX IF NOT EXISTS idx_bodyspec_scans_connection_id ON bodyspec_scans(connection_id);
CREATE INDEX IF NOT EXISTS idx_bodyspec_scans_scan_date ON bodyspec_scans(scan_date DESC);
CREATE INDEX IF NOT EXISTS idx_bodyspec_scans_appointment_id ON bodyspec_scans(appointment_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_bodyspec_connections_updated_at
  BEFORE UPDATE ON bodyspec_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bodyspec_scans_updated_at
  BEFORE UPDATE ON bodyspec_scans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - Currently permissive, will be tightened with auth
ALTER TABLE bodyspec_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE bodyspec_scans ENABLE ROW LEVEL SECURITY;

-- Temporary policy: Allow all operations (will be restricted once user auth is implemented)
CREATE POLICY "Allow all access to bodyspec_connections" ON bodyspec_connections
  FOR ALL USING (true);

CREATE POLICY "Allow all access to bodyspec_scans" ON bodyspec_scans
  FOR ALL USING (true);

-- Comment documentation
COMMENT ON TABLE bodyspec_connections IS 'Stores Bodyspec API connection credentials and metadata';
COMMENT ON TABLE bodyspec_scans IS 'Stores DEXA scan results fetched from Bodyspec API';
COMMENT ON COLUMN bodyspec_connections.access_token IS 'Bodyspec API Bearer token (encrypted at app layer)';
COMMENT ON COLUMN bodyspec_scans.data IS 'Full DEXA scan data in JSONB format for flexible querying';
