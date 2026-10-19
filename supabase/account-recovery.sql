-- GoldenNotes secondary personal email recovery
-- Run this in Supabase SQL Editor before deploying the recovery feature.
create table if not exists public.account_recovery_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recovery_email text not null unique,
  verified_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.account_recovery_challenges (
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('verify', 'reset')),
  recovery_email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, purpose)
);
alter table public.account_recovery_emails enable row level security;
alter table public.account_recovery_challenges enable row level security;
-- Intentionally no client policies: only the server's service-role client can read/write these tables.
