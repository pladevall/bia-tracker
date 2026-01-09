-- Migration: Create BIA entries table
-- Description: Table for storing BIA (Bioelectrical Impedance Analysis) measurement data

-- Table: bia_entries
-- Stores BIA measurement entries from uploaded images
CREATE TABLE IF NOT EXISTS bia_entries (
  id UUID PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_bia_entries_date ON bia_entries(date DESC);

-- Row Level Security (RLS)
ALTER TABLE bia_entries ENABLE ROW LEVEL SECURITY;

-- Temporary policy: Allow all operations (will be restricted once user auth is implemented)
CREATE POLICY "Allow all access to bia_entries" ON bia_entries
  FOR ALL USING (true);

-- Comment documentation
COMMENT ON TABLE bia_entries IS 'Stores BIA measurement data parsed from uploaded images';
COMMENT ON COLUMN bia_entries.data IS 'Full BIA measurement data in JSONB format';
