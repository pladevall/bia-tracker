-- Migration: Add Strava activity metrics
-- Description: Adds heart rate, cadence, and elevation details to running_activities table

-- Add new columns to running_activities
ALTER TABLE running_activities
ADD COLUMN IF NOT EXISTS average_heartrate INTEGER,
ADD COLUMN IF NOT EXISTS max_heartrate INTEGER,
ADD COLUMN IF NOT EXISTS average_cadence DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS elev_high_feet DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS elev_low_feet DECIMAL(8,2);

-- Add comments for documentation
COMMENT ON COLUMN running_activities.average_heartrate IS 'Average heart rate in bpm during the activity';
COMMENT ON COLUMN running_activities.max_heartrate IS 'Maximum heart rate in bpm during the activity';
COMMENT ON COLUMN running_activities.average_cadence IS 'Average cadence in steps per minute (for running, Strava reports half-steps so multiply by 2)';
COMMENT ON COLUMN running_activities.elev_high_feet IS 'Highest elevation point in feet during the activity';
COMMENT ON COLUMN running_activities.elev_low_feet IS 'Lowest elevation point in feet during the activity';
