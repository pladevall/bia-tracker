-- Make user_id nullable to support guest/anonymous events
alter table public.calendar_events alter column user_id drop not null;

-- Update RLS policies to be crystal clear for public usage
-- (The previous policies allowed true, but let's ensure no FK constraint issues)
-- We already have "Allow Public Insert" with check(true).
-- The FK constraint `calendar_events_user_id_fkey` only applies if user_id is NOT NULL. 
-- So by making it nullable, we can insert NULL for guests.
