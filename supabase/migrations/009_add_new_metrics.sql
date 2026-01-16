-- Migration 009: Add new sleep metrics and exercise types
-- Added to support more granular sleep analysis and lifting classification

-- Add new interruption metrics to sleep_entries if they don't exist as columns
-- (Usually these are stored in the JSONB 'data' field, but columns are faster for queries)
ALTER TABLE sleep_entries 
ADD COLUMN IF NOT EXISTS wake_ups_count INTEGER,
ADD COLUMN IF NOT EXISTS interruptions_duration_minutes INTEGER;

-- Add comment to the table metadata
COMMENT ON COLUMN sleep_entries.wake_ups_count IS 'Number of wake-ups or interruptions during the sleep period';
COMMENT ON COLUMN sleep_entries.interruptions_duration_minutes IS 'Total duration of interruptions in minutes';
