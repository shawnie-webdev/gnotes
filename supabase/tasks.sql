create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) <= 150),
  description text not null default '' check (char_length(description) <= 2000),
  subject text not null check (char_length(subject) <= 100),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_created_at_idx
  on public.tasks (user_id, created_at desc);

alter table public.tasks enable row level security;

drop policy if exists student_tasks_select_own on public.tasks;
create policy student_tasks_select_own on public.tasks
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists student_tasks_insert_own on public.tasks;
create policy student_tasks_insert_own on public.tasks
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists student_tasks_update_own on public.tasks;
create policy student_tasks_update_own on public.tasks
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists student_tasks_delete_own on public.tasks;
create policy student_tasks_delete_own on public.tasks
  for delete to authenticated
  using (auth.uid() = user_id);
