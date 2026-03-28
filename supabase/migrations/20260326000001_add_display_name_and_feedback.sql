-- Add display_name to profiles
alter table profiles add column if not exists display_name text;

-- Create feedback table
create table feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  message text not null,
  category text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for feedback
alter table feedback enable row level security;

-- Policies for feedback
create policy "Users can insert their own feedback" on feedback
  for insert with check (auth.uid() = user_id);

create policy "Users can view their own feedback" on feedback
  for select using (auth.uid() = user_id);
