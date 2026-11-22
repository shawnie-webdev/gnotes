-- GoldenNotes badge system (applied to Supabase project)
create table if not exists public.badge_catalog (
  slug text primary key,
  name text not null unique,
  description text not null,
  icon_path text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_uuid uuid not null references auth.users(id) on delete cascade,
  badge_slug text not null references public.badge_catalog(slug) on delete restrict,
  awarded_by uuid not null references auth.users(id) on delete restrict,
  awarded_at timestamptz not null default now(),
  note text,
  unique (user_uuid, badge_slug)
);
alter table public.badge_catalog enable row level security;
alter table public.user_badges enable row level security;
drop policy if exists "Badge catalog readable by everyone" on public.badge_catalog;
create policy "Badge catalog readable by everyone" on public.badge_catalog for select to anon, authenticated using (true);
drop policy if exists "User badges publicly readable" on public.user_badges;
create policy "User badges publicly readable" on public.user_badges for select to anon, authenticated using (true);
revoke insert, update, delete on public.badge_catalog from anon, authenticated;
revoke insert, update, delete on public.user_badges from anon, authenticated;
grant select on public.badge_catalog to anon, authenticated;
grant select on public.user_badges to anon, authenticated;
insert into public.badge_catalog (slug,name,description,icon_path) values
('guide-giver','Study Guide Contributor','Shared lots of study guides with the community.','/assets/badges/guide-giver.svg'),
('quiz-maker','Quiz Creator','Created quizzes to help others learn.','/assets/badges/quiz-maker.svg'),
('study-streak','Study Streak','Consistently contributed to learning resources.','/assets/badges/study-streak.svg'),
('community-champion','Community Champion','Helped make GoldenNotes a welcoming community.','/assets/badges/community-champion.svg'),
('quick-learner','Quick Learner','Showed curiosity and a love for learning.','/assets/badges/quick-learner.svg'),
('golden-notes','GoldenNotes Star','A special recognition from the GoldenNotes team.','/assets/badges/golden-notes.svg')
on conflict (slug) do update set name=excluded.name,description=excluded.description,icon_path=excluded.icon_path;