-- Allow public access to calendar_events for v1 (No Login)
-- Drop existing restrictive policies
drop policy if exists "Users can view their own calendar events" on public.calendar_events;
drop policy if exists "Users can insert their own calendar events" on public.calendar_events;
drop policy if exists "Users can update their own calendar events" on public.calendar_events;
drop policy if exists "Users can delete their own calendar events" on public.calendar_events;

-- Create new public policies
-- Warning: This allows anyone to read/write any event. For v1 demo.
create policy "Allow Public Read"
on public.calendar_events for select
using (true);

create policy "Allow Public Insert"
on public.calendar_events for insert
with check (true);

create policy "Allow Public Update"
on public.calendar_events for update
using (true);

create policy "Allow Public Delete"
on public.calendar_events for delete
using (true);
