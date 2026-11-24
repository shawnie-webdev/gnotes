-- GoldenNotes Scavenger Hunt badges and redemption codes.
create table if not exists public.scavenger_hunt_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  badge_slug text not null references public.badge_catalog(slug) on delete restrict,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  active boolean not null default true
);
create table if not exists public.scavenger_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.scavenger_hunt_codes(id) on delete cascade,
  user_uuid uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (code_id, user_uuid)
);
alter table public.scavenger_hunt_codes enable row level security;
alter table public.scavenger_redemptions enable row level security;
revoke all on public.scavenger_hunt_codes from anon, authenticated;
revoke all on public.scavenger_redemptions from anon, authenticated;
insert into public.badge_catalog(slug,name,description,icon_path) values
('scavenger-hunt-1','Scavenger Hunt 1','Redeemed a secret scavenger hunt code.','/assets/badges/scavenger-hunt-1.svg'),
('scavenger-hunt-2','Scavenger Hunt 2','Redeemed a secret scavenger hunt code.','/assets/badges/scavenger-hunt-2.svg'),
('scavenger-hunt-3','Scavenger Hunt 3','Redeemed a secret scavenger hunt code.','/assets/badges/scavenger-hunt-3.svg'),
('scavenger-hunt-4','Scavenger Hunt 4','Redeemed a secret scavenger hunt code.','/assets/badges/scavenger-hunt-4.svg'),
('scavenger-hunt-5','Scavenger Hunt 5','Redeemed a secret scavenger hunt code.','/assets/badges/scavenger-hunt-5.svg')
on conflict (slug) do update set name=excluded.name,description=excluded.description,icon_path=excluded.icon_path;
