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

create policy "block_members_update_beadle"
  on public.block_members for update
  to authenticated
  using (
    public.is_beadle_of(block_id)
  )
  with check (
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
  using (
    public.is_beadle_of(block_id)
  )
  with check (
    public.is_beadle_of(block_id)
  );

create policy "tasks_delete_beadle"
  on public.tasks for delete
  to authenticated
  using (
    public.is_beadle_of(block_id)
  );

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
  using (
    profile_id = auth.uid()
  );

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
  using (
    author_id = auth.uid()
    and public.is_beadle_of(block_id)
  )
  with check (
    author_id = auth.uid()
    and public.is_beadle_of(block_id)
  );

create policy "announcements_delete_beadle"
  on public.beadle_announcements for delete
  to authenticated
  using (
    author_id = auth.uid()
    and public.is_beadle_of(block_id)
  );

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
  with check (
    public.is_beadle_of(block_id)
  );

create policy "block_links_update_beadle"
  on public.block_links for update
  to authenticated
  using (public.is_beadle_of(block_id))
  with check (public.is_beadle_of(block_id));

create policy "block_links_delete_beadle"
  on public.block_links for delete
  to authenticated
  using (
    public.is_beadle_of(block_id)
  );
