alter table public.tasks enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;

drop policy if exists tasks_select_own on public.tasks;
create policy tasks_select_own on public.tasks
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own on public.tasks
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own on public.tasks
  for delete to authenticated
  using ((select auth.uid()) = user_id);

do $$
declare
  tasks_id_sequence regclass;
begin
  tasks_id_sequence := pg_get_serial_sequence('public.tasks', 'id');
  if tasks_id_sequence is not null then
    execute format('grant usage, select on sequence %s to authenticated', tasks_id_sequence);
  end if;
end
$$;
