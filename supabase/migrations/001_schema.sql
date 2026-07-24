create extension if not exists "pgcrypto";

create table public.universities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  short_code   text not null unique,
  email_domain text not null unique,
  theme_color  text not null default '#3B82F6',
  created_at   timestamptz not null default now()
);

create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null unique,
  full_name      text,
  avatar_url     text,
  university_id  uuid references public.universities(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.blocks (
  id              uuid primary key default gen_random_uuid(),
  university_id   uuid not null references public.universities(id) on delete cascade,
  name            text not null,
  invite_code     text not null unique default encode(gen_random_bytes(6), 'hex'),
  canvas_ics_url  text,
  created_by      uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_blocks_invite_code on public.blocks(invite_code);

create table public.block_members (
  id          uuid primary key default gen_random_uuid(),
  block_id    uuid not null references public.blocks(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'student'
              check (role in ('beadle', 'student')),
  joined_at   timestamptz not null default now(),
  unique (block_id, profile_id)
);

create index idx_block_members_profile on public.block_members(profile_id);
create index idx_block_members_block   on public.block_members(block_id);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  block_id     uuid not null references public.blocks(id) on delete cascade,
  title        text not null,
  course_code  text,
  due_at       timestamptz,
  source       text not null default 'manual'
               check (source in ('canvas_ics', 'manual')),
  canvas_uid   text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (block_id, canvas_uid)
);

create index idx_tasks_block   on public.tasks(block_id);
create index idx_tasks_due     on public.tasks(due_at);

create table public.user_task_completions (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  completed_at  timestamptz not null default now(),
  unique (task_id, profile_id)
);

create index idx_utc_profile on public.user_task_completions(profile_id);

create table public.beadle_announcements (
  id          uuid primary key default gen_random_uuid(),
  block_id    uuid not null references public.blocks(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  content     text not null,
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_announcements_block on public.beadle_announcements(block_id);

create table public.block_links (
  id          uuid primary key default gen_random_uuid(),
  block_id    uuid not null references public.blocks(id) on delete cascade,
  title       text not null,
  url         text not null,
  created_at  timestamptz not null default now()
);

create index idx_block_links_block on public.block_links(block_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_blocks_updated_at
  before update on public.blocks
  for each row execute function public.set_updated_at();

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger trg_announcements_updated_at
  before update on public.beadle_announcements
  for each row execute function public.set_updated_at();
