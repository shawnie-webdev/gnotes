begin;

alter table public.tasks add column if not exists id text;

with duplicate_ids as (
  select ctid, row_number() over (partition by id order by ctid) as row_number
  from public.tasks
  where id is not null
)
update public.tasks as task
set id = gen_random_uuid()::text
from duplicate_ids
where task.ctid = duplicate_ids.ctid
  and duplicate_ids.row_number > 1;

update public.tasks
set id = gen_random_uuid()::text
where id is null;

alter table public.tasks
  alter column id set default gen_random_uuid()::text,
  alter column id set not null;

alter table public.tasks drop constraint if exists tasks_pkey;
alter table public.tasks add constraint tasks_pkey primary key (id);

commit;
