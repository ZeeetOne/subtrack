-- 1. Create Profiles Table (Extensions for Auth Users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  base_currency text not null default 'USD',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Expenses Table
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  amount decimal(12, 2) not null,
  currency text not null,
  exchange_rate decimal(12, 6) default 1.0 not null,
  billing_cycle text not null,
  category text,
  next_billing_date date,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable Row Level Security (RLS)
alter table profiles enable row level security;
alter table expenses enable row level security;

-- 4. Create RLS Policies
-- Profiles: Users can read and update their own profiles
create policy "Users can view their own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on profiles
  for update using (auth.uid() = id);

-- Expenses: Users can manage their own expenses
create policy "Users can view their own expenses" on expenses
  for select using (auth.uid() = user_id);

create policy "Users can insert their own expenses" on expenses
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own expenses" on expenses
  for update using (auth.uid() = user_id);

create policy "Users can delete their own expenses" on expenses
  for delete using (auth.uid() = user_id);

-- 5. Create automatic triggers for updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
before update on profiles
for each row execute function update_updated_at_column();

create trigger update_expenses_updated_at
before update on expenses
for each row execute function update_updated_at_column();

-- 6. Indexes for performance
create index idx_expenses_user_id on expenses(user_id);

-- 7. Automatically create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
