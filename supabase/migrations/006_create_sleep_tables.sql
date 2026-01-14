-- Main sleep entries table
CREATE TABLE sleep_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sleep_date DATE NOT NULL UNIQUE,
  sleep_score INTEGER NOT NULL CHECK (sleep_score >= 0 AND sleep_score <= 100),
  duration_score INTEGER NOT NULL CHECK (duration_score >= 0 AND duration_score <= 50),
  bedtime_score INTEGER NOT NULL CHECK (bedtime_score >= 0 AND bedtime_score <= 30),
  interruption_score INTEGER NOT NULL CHECK (interruption_score >= 0 AND interruption_score <= 20),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User preferences for personalized scoring
CREATE TABLE sleep_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_bedtime TIME DEFAULT '22:30:00',
  target_wake_time TIME DEFAULT '06:30:00',
  target_duration_minutes INTEGER DEFAULT 480,
  bedtime_window_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
