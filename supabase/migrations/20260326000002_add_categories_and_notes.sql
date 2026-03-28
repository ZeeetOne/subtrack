-- Create categories table
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade, -- null for default categories
  name text not null,
  icon text,
  color text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add notes and category_id to expenses
alter table expenses add column if not exists notes text;
alter table expenses add column if not exists category_id uuid references categories(id) on delete set null;

-- Enable RLS for categories
alter table categories enable row level security;

-- Policies for categories
create policy "Users can view default categories" on categories
  for select using (user_id is null);

create policy "Users can view their own categories" on categories
  for select using (auth.uid() = user_id);

create policy "Users can insert their own categories" on categories
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own categories" on categories
  for update using (auth.uid() = user_id);

create policy "Users can delete their own categories" on categories
  for delete using (auth.uid() = user_id);

-- Seed default categories
insert into categories (name, icon, color) values
  ('Entertainment', 'Play', '#6366f1'),
  ('Food & Drink', 'Utensils', '#f59e0b'),
  ('Transport', 'Car', '#3b82f6'),
  ('SaaS & Tools', 'Cpu', '#10b981'),
  ('Shopping', 'ShoppingBag', '#ec4899'),
  ('Health', 'Heart', '#ef4444'),
  ('Utilities', 'Zap', '#8b5cf6'),
  ('Other', 'MoreHorizontal', '#94a3b8');
