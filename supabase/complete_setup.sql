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
  description  text,
  course_code  text,
  due_at       timestamptz,
  is_personal  boolean not null default false,
  source       text not null default 'manual'
               check (source in ('canvas_ics', 'manual')),
  canvas_uid   text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (block_id, canvas_uid)
);

create index idx_tasks_block on public.tasks(block_id);
create index idx_tasks_due   on public.tasks(due_at);

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

create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = ''
as $$
declare
  _email       text;
  _full_name   text;
  _avatar_url  text;
  _domain      text;
  _uni_id      uuid;
begin
  _email      := coalesce(new.email, new.raw_user_meta_data->>'email');
  _full_name  := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  );
  _avatar_url := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    ''
  );

  _domain := split_part(_email, '@', 2);

  select u.id into _uni_id
  from public.universities u
  where _domain like '%' || u.email_domain
  order by length(u.email_domain) desc
  limit 1;

  insert into public.profiles (id, email, full_name, avatar_url, university_id)
  values (new.id, _email, _full_name, _avatar_url, _uni_id)
  on conflict (id) do update set
    email       = excluded.email,
    full_name   = excluded.full_name,
    avatar_url  = excluded.avatar_url,
    university_id = coalesce(excluded.university_id, public.profiles.university_id);

  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create or replace function public.handle_user_updated()
returns trigger
security definer
set search_path = ''
as $$
begin
  update public.profiles set
    full_name  = coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      public.profiles.full_name
    ),
    avatar_url = coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture',
      public.profiles.avatar_url
    ),
    updated_at = now()
  where id = new.id;

  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row
  execute function public.handle_user_updated();

alter table public.universities          enable row level security;
alter table public.profiles              enable row level security;
alter table public.blocks                enable row level security;
alter table public.block_members         enable row level security;
alter table public.tasks                 enable row level security;
alter table public.user_task_completions enable row level security;
alter table public.beadle_announcements  enable row level security;
alter table public.block_links           enable row level security;

create or replace function public.current_user_university_id()
returns uuid
stable
security definer
set search_path = ''
as $$
  select university_id
  from public.profiles
  where id = auth.uid();
$$ language sql;

create or replace function public.is_beadle_of(p_block_id uuid)
returns boolean
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.block_members
    where block_id   = p_block_id
      and profile_id = auth.uid()
      and role       = 'beadle'
  );
$$ language sql;

create or replace function public.is_member_of(p_block_id uuid)
returns boolean
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.block_members
    where block_id   = p_block_id
      and profile_id = auth.uid()
  );
$$ language sql;

create policy "universities_select"
  on public.universities for select
  to authenticated
  using (true);

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (
    university_id = public.current_user_university_id()
    or id = auth.uid()
  );

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "blocks_select_own_university"
  on public.blocks for select
  to authenticated
  using (
    university_id = public.current_user_university_id()
  );

create policy "blocks_insert_own_university"
  on public.blocks for insert
  to authenticated
  with check (
    university_id = public.current_user_university_id()
    and created_by = auth.uid()
  );

create policy "blocks_update_beadle"
  on public.blocks for update
  to authenticated
  using (
    university_id = public.current_user_university_id()
    and public.is_beadle_of(id)
  )
  with check (
    university_id = public.current_user_university_id()
  );

create policy "blocks_delete_beadle"
  on public.blocks for delete
  to authenticated
  using (
    university_id = public.current_user_university_id()
    and public.is_beadle_of(id)
  );

create policy "block_members_select"
  on public.block_members for select
  to authenticated
  using (
    exists (
      select 1 from public.blocks b
      where b.id = block_id
        and b.university_id = public.current_user_university_id()
    )
  );

create policy "block_members_insert_self"
  on public.block_members for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.blocks b
      where b.id = block_id
        and b.university_id = public.current_user_university_id()
    )
  );

create policy "block_members_insert_beadle"
  on public.block_members for insert
  to authenticated
  with check (
    public.is_beadle_of(block_id)
  );

create policy "block_members_delete_self"
  on public.block_members for delete
  to authenticated
  using (
    profile_id = auth.uid()
  );

create policy "block_members_delete_beadle"
  on public.block_members for delete
  to authenticated
  using (
    public.is_beadle_of(block_id)
  );

create policy "tasks_select_own_university"
  on public.tasks for select
  to authenticated
  using (
    exists (
      select 1 from public.blocks b
      where b.id = block_id
        and b.university_id = public.current_user_university_id()
    )
  );

create policy "tasks_insert_beadle"
  on public.tasks for insert
  to authenticated
  with check (
    public.is_beadle_of(block_id)
  );

create policy "tasks_update_beadle"
  on public.tasks for update
  to authenticated
  using (public.is_beadle_of(block_id))
  with check (public.is_beadle_of(block_id));

create policy "tasks_delete_beadle"
  on public.tasks for delete
  to authenticated
  using (public.is_beadle_of(block_id));

create policy "utc_select_own"
  on public.user_task_completions for select
  to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and public.is_beadle_of(t.block_id)
    )
  );

create policy "utc_insert_own"
  on public.user_task_completions for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1
      from public.tasks t
      join public.blocks b on b.id = t.block_id
      where t.id = task_id
        and b.university_id = public.current_user_university_id()
    )
  );

create policy "utc_delete_own"
  on public.user_task_completions for delete
  to authenticated
  using (profile_id = auth.uid());

create policy "announcements_select"
  on public.beadle_announcements for select
  to authenticated
  using (
    exists (
      select 1 from public.blocks b
      where b.id = block_id
        and b.university_id = public.current_user_university_id()
    )
  );

create policy "announcements_insert_beadle"
  on public.beadle_announcements for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.is_beadle_of(block_id)
  );

create policy "announcements_update_beadle"
  on public.beadle_announcements for update
  to authenticated
  using (author_id = auth.uid() and public.is_beadle_of(block_id))
  with check (author_id = auth.uid() and public.is_beadle_of(block_id));

create policy "announcements_delete_beadle"
  on public.beadle_announcements for delete
  to authenticated
  using (author_id = auth.uid() and public.is_beadle_of(block_id));

create policy "block_links_select"
  on public.block_links for select
  to authenticated
  using (
    exists (
      select 1 from public.blocks b
      where b.id = block_id
        and b.university_id = public.current_user_university_id()
    )
  );

create policy "block_links_insert_beadle"
  on public.block_links for insert
  to authenticated
  with check (public.is_beadle_of(block_id));

create policy "block_links_update_beadle"
  on public.block_links for update
  to authenticated
  using (public.is_beadle_of(block_id))
  with check (public.is_beadle_of(block_id));

create policy "block_links_delete_beadle"
  on public.block_links for delete
  to authenticated
  using (public.is_beadle_of(block_id));

insert into public.universities (name, short_code, email_domain, theme_color) values
  ('Ateneo de Manila University',    'ADMU', 'ateneo.edu',   '#1E6FBA'),
  ('De La Salle University',         'DLSU', 'dlsu.edu.ph',  '#00703C'),
  ('University of the Philippines',  'UP',   'up.edu.ph',    '#7B1113'),
  ('University of Santo Tomas',      'UST',  'ust.edu.ph',   '#FFD700')
on conflict (email_domain) do nothing;
