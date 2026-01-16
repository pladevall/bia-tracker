-- Create calendar_events table
create table if not exists public.calendar_events (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null default auth.uid(),
    start_date date not null,
    end_date date not null,
    title text not null,
    category text not null, -- Stores the category key (e.g., 'ship', 'deep_work')
    notes text,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    
    constraint calendar_events_pkey primary key (id),
    constraint calendar_events_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

-- Enable RLS
alter table public.calendar_events enable row level security;

-- Create policies
create policy "Users can view their own calendar events"
    on public.calendar_events for select
    using (auth.uid() = user_id);

create policy "Users can insert their own calendar events"
    on public.calendar_events for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own calendar events"
    on public.calendar_events for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own calendar events"
    on public.calendar_events for delete
    using (auth.uid() = user_id);

-- Create indexes for faster queries by date range
create index if not exists calendar_events_user_id_idx on public.calendar_events (user_id);
create index if not exists calendar_events_start_date_idx on public.calendar_events (start_date);
create index if not exists calendar_events_end_date_idx on public.calendar_events (end_date);
