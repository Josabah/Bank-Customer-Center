create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  normalized_name text not null unique,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_auth_factors (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  pin_hash text not null,
  pin_updated_at timestamptz not null default now(),
  failed_attempt_count integer not null default 0,
  locked_until timestamptz
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  account_type text not null default 'checking',
  currency text not null default 'ETB',
  available_balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  amount numeric(14, 2) not null,
  currency text not null default 'ETB',
  description text not null,
  posted_at timestamptz not null default now(),
  direction text not null check (direction in ('credit', 'debit'))
);

create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'ended', 'handoff')),
  auth_state text not null default 'started' check (auth_state in ('started', 'identified', 'authenticated', 'failed', 'handoff')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  handoff_reason text
);

create table if not exists public.call_messages (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references public.call_sessions(id) on delete cascade,
  speaker text not null check (speaker in ('user', 'agent')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_base_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists customers_normalized_name_idx on public.customers (normalized_name);
create index if not exists accounts_customer_id_idx on public.accounts (customer_id);
create index if not exists transactions_account_id_posted_at_idx on public.transactions (account_id, posted_at desc);
create index if not exists call_messages_call_session_id_created_at_idx on public.call_messages (call_session_id, created_at);
create index if not exists knowledge_base_entries_body_trgm_idx on public.knowledge_base_entries using gin (body gin_trgm_ops);

alter table public.customers enable row level security;
alter table public.customer_auth_factors enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.call_sessions enable row level security;
alter table public.call_messages enable row level security;
alter table public.knowledge_base_entries enable row level security;

create policy "service role manages customers" on public.customers for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role manages customer auth factors" on public.customer_auth_factors for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role manages accounts" on public.accounts for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role manages transactions" on public.transactions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role manages call sessions" on public.call_sessions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role manages call messages" on public.call_messages for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role manages knowledge base entries" on public.knowledge_base_entries for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

insert into public.customers (id, display_name, normalized_name, phone)
values ('11111111-1111-4111-8111-111111111111', 'Aymen', 'aymen', '+251900000000')
on conflict (normalized_name) do nothing;

insert into public.customer_auth_factors (customer_id, pin_hash)
values (
  '11111111-1111-4111-8111-111111111111',
  'sha256:demo-aymen-pin-salt:ea3af5c7c1da2a3f27424a4ec26fbd26a856aa4c85a2a5b12c01d1a58f3a9842'
)
on conflict (customer_id) do nothing;

insert into public.accounts (id, customer_id, account_type, currency, available_balance)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'checking',
  'ETB',
  5200.00
)
on conflict (id) do nothing;

insert into public.transactions (account_id, amount, currency, description, direction)
values (
  '22222222-2222-4222-8222-222222222222',
  200.00,
  'ETB',
  '200 birr sent',
  'debit'
);

insert into public.knowledge_base_entries (title, body, tags)
values
  ('Balance help', 'You can ask for your account balance after your PIN has been verified.', array['accounts', 'balance']),
  ('Recent transactions', 'You can ask for your recent transaction after your PIN has been verified.', array['transactions']);
