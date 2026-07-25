ALTER TABLE public.tasks ADD COLUMN description text;
ALTER TABLE public.tasks ADD COLUMN is_personal boolean NOT NULL DEFAULT false;
