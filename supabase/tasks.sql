ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;