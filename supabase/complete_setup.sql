CREATE    EXTENSION if NOT EXISTS "pgcrypto";
CREATE    TABLE public.universities (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          short_code text NOT NULL UNIQUE,
          email_domain text NOT NULL UNIQUE,
          theme_color text NOT NULL DEFAULT '#3B82F6',
          created_at timestamptz NOT NULL DEFAULT now()
          );
CREATE    TABLE public.profiles (
          id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
          email text NOT NULL UNIQUE,
          full_name text,
          avatar_url text,
          university_id uuid REFERENCES public.universities (id) ON DELETE SET NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
          );
CREATE    TABLE public.blocks (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE CASCADE,
          name text NOT NULL,
          invite_code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes (6), 'hex'),
          canvas_ics_url text,
          created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
          );
CREATE    INDEX idx_blocks_invite_code ON public.blocks (invite_code);
CREATE    TABLE public.block_members (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          block_id uuid NOT NULL REFERENCES public.blocks (id) ON DELETE CASCADE,
          profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
          role text NOT NULL DEFAULT 'student' CHECK (role IN ('beadle', 'student')),
          joined_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (block_id, profile_id)
          );
CREATE    INDEX idx_block_members_profile ON public.block_members (profile_id);
CREATE    INDEX idx_block_members_block ON public.block_members (block_id);
CREATE    TABLE public.tasks (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          block_id uuid NOT NULL REFERENCES public.blocks (id) ON DELETE CASCADE,
          title text NOT NULL,
          description text,
          course_code text,
          due_at timestamptz,
          is_personal boolean NOT NULL DEFAULT FALSE,
          source text NOT NULL DEFAULT 'manual' CHECK (source IN ('canvas_ics', 'manual')),
          canvas_uid text,
          created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (block_id, canvas_uid)
          );
CREATE    INDEX idx_tasks_block ON public.tasks (block_id);
CREATE    INDEX idx_tasks_due ON public.tasks (due_at);
CREATE    TABLE public.user_task_completions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
          profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
          completed_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (task_id, profile_id)
          );
CREATE    INDEX idx_utc_profile ON public.user_task_completions (profile_id);
CREATE    TABLE public.beadle_announcements (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          block_id uuid NOT NULL REFERENCES public.blocks (id) ON DELETE CASCADE,
          author_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
          content text NOT NULL,
          is_pinned boolean NOT NULL DEFAULT FALSE,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
          );
CREATE    INDEX idx_announcements_block ON public.beadle_announcements (block_id);
CREATE    TABLE public.block_links (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          block_id uuid NOT NULL REFERENCES public.blocks (id) ON DELETE CASCADE,
          title text NOT NULL,
          url text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
          );
CREATE    INDEX idx_block_links_block ON public.block_links (block_id);
CREATE    OR REPLACE FUNCTION public.set_updated_at () returns trigger AS $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
CREATE    TRIGGER trg_profiles_updated_at before
UPDATE    ON public.profiles FOR each ROW
EXECUTE   function public.set_updated_at ();
CREATE    TRIGGER trg_blocks_updated_at before
UPDATE    ON public.blocks FOR each ROW
EXECUTE   function public.set_updated_at ();
CREATE    TRIGGER trg_tasks_updated_at before
UPDATE    ON public.tasks FOR each ROW
EXECUTE   function public.set_updated_at ();
CREATE    TRIGGER trg_announcements_updated_at before
UPDATE    ON public.beadle_announcements FOR each ROW
EXECUTE   function public.set_updated_at ();
CREATE    OR REPLACE FUNCTION public.handle_new_user () returns trigger security definer
SET       search_path = '' AS $$
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
DROP      TRIGGER if EXISTS on_auth_user_created ON auth.users;
CREATE    TRIGGER on_auth_user_created
AFTER     insert ON auth.users FOR each ROW
EXECUTE   function public.handle_new_user ();
CREATE    OR REPLACE FUNCTION public.handle_user_updated () returns trigger security definer
SET       search_path = '' AS $$
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
DROP      TRIGGER if EXISTS on_auth_user_updated ON auth.users;
CREATE    TRIGGER on_auth_user_updated
AFTER    
UPDATE    ON auth.users FOR each ROW
EXECUTE   function public.handle_user_updated ();
ALTER     TABLE public.universities enable ROW level security;
ALTER     TABLE public.profiles enable ROW level security;
ALTER     TABLE public.blocks enable ROW level security;
ALTER     TABLE public.block_members enable ROW level security;
ALTER     TABLE public.tasks enable ROW level security;
ALTER     TABLE public.user_task_completions enable ROW level security;
ALTER     TABLE public.beadle_announcements enable ROW level security;
ALTER     TABLE public.block_links enable ROW level security;
CREATE    OR REPLACE FUNCTION public.current_user_university_id () returns uuid stable security definer
SET       search_path = '' AS $$
  select university_id
  from public.profiles
  where id = auth.uid();
$$ language sql;
CREATE    OR REPLACE FUNCTION public.is_beadle_of (p_block_id uuid) returns boolean stable security definer
SET       search_path = '' AS $$
  select exists (
    select 1
    from public.block_members
    where block_id   = p_block_id
      and profile_id = auth.uid()
      and role       = 'beadle'
  );
$$ language sql;
CREATE    OR REPLACE FUNCTION public.is_member_of (p_block_id uuid) returns boolean stable security definer
SET       search_path = '' AS $$
  select exists (
    select 1
    from public.block_members
    where block_id   = p_block_id
      and profile_id = auth.uid()
  );
$$ language sql;
CREATE    POLICY "universities_select" ON public.universities FOR
SELECT    TO authenticated USING (TRUE);
CREATE    POLICY "profiles_select_own" ON public.profiles FOR
SELECT    TO authenticated USING (
          university_id = public.current_user_university_id ()
OR        id = auth.uid ()
          );
CREATE    POLICY "profiles_update_own" ON public.profiles
FOR       UPDATE TO authenticated USING (id = auth.uid ())
WITH      CHECK (id = auth.uid ());
CREATE    POLICY "blocks_select_own_university" ON public.blocks FOR
SELECT    TO authenticated USING (university_id = public.current_user_university_id ());
CREATE    POLICY "blocks_insert_own_university" ON public.blocks FOR insert TO authenticated
WITH      CHECK (
          university_id = public.current_user_university_id ()
AND       created_by = auth.uid ()
          );
CREATE    POLICY "blocks_update_beadle" ON public.blocks
FOR       UPDATE TO authenticated USING (
          university_id = public.current_user_university_id ()
AND       public.is_beadle_of (id)
          )
WITH      CHECK (university_id = public.current_user_university_id ());
CREATE    POLICY "blocks_delete_beadle" ON public.blocks FOR delete TO authenticated USING (
university_id = public.current_user_university_id ()
AND       public.is_beadle_of (id)
          );
CREATE    POLICY "block_members_select" ON public.block_members FOR
SELECT    TO authenticated USING (
          EXISTS (
          SELECT    1
          FROM      public.blocks b
          WHERE     b.id = block_id
          AND       b.university_id = public.current_user_university_id ()
          )
          );
CREATE    POLICY "block_members_insert_self" ON public.block_members FOR insert TO authenticated
WITH      CHECK (
          profile_id = auth.uid ()
AND       EXISTS (
          SELECT    1
          FROM      public.blocks b
          WHERE     b.id = block_id
          AND       b.university_id = public.current_user_university_id ()
          )
          );
CREATE    POLICY "block_members_insert_beadle" ON public.block_members FOR insert TO authenticated
WITH      CHECK (public.is_beadle_of (block_id));
CREATE    POLICY "block_members_delete_self" ON public.block_members FOR delete TO authenticated USING (profile_id = auth.uid ());
CREATE    POLICY "block_members_delete_beadle" ON public.block_members FOR delete TO authenticated USING (public.is_beadle_of (block_id));
CREATE    POLICY "block_members_update_beadle" ON public.block_members
FOR       UPDATE TO authenticated USING (public.is_beadle_of (block_id))
WITH      CHECK (public.is_beadle_of (block_id));
CREATE    POLICY "tasks_select_own_university" ON public.tasks FOR
SELECT    TO authenticated USING (
          EXISTS (
          SELECT    1
          FROM      public.blocks b
          WHERE     b.id = block_id
          AND       b.university_id = public.current_user_university_id ()
          )
          );
CREATE    POLICY "tasks_insert_beadle" ON public.tasks FOR insert TO authenticated
WITH      CHECK (public.is_beadle_of (block_id));
CREATE    POLICY "tasks_update_beadle" ON public.tasks
FOR       UPDATE TO authenticated USING (public.is_beadle_of (block_id))
WITH      CHECK (public.is_beadle_of (block_id));
CREATE    POLICY "tasks_delete_beadle_or_creator" ON public.tasks FOR delete TO authenticated USING (
public.is_beadle_of (block_id)
OR        created_by = auth.uid ()
          );
CREATE    POLICY "utc_select_own" ON public.user_task_completions FOR
SELECT    TO authenticated USING (
          profile_id = auth.uid ()
OR        EXISTS (
          SELECT    1
          FROM      public.tasks t
          WHERE     t.id = task_id
          AND       public.is_beadle_of (t.block_id)
          )
          );
CREATE    POLICY "utc_insert_own" ON public.user_task_completions FOR insert TO authenticated
WITH      CHECK (
          profile_id = auth.uid ()
AND       EXISTS (
          SELECT    1
          FROM      public.tasks t
          JOIN      public.blocks b ON b.id = t.block_id
          WHERE     t.id = task_id
          AND       b.university_id = public.current_user_university_id ()
          )
          );
CREATE    POLICY "utc_delete_own" ON public.user_task_completions FOR delete TO authenticated USING (profile_id = auth.uid ());
CREATE    POLICY "announcements_select" ON public.beadle_announcements FOR
SELECT    TO authenticated USING (
          EXISTS (
          SELECT    1
          FROM      public.blocks b
          WHERE     b.id = block_id
          AND       b.university_id = public.current_user_university_id ()
          )
          );
CREATE    POLICY "announcements_insert_beadle" ON public.beadle_announcements FOR insert TO authenticated
WITH      CHECK (
          author_id = auth.uid ()
AND       public.is_beadle_of (block_id)
          );
CREATE    POLICY "announcements_update_beadle" ON public.beadle_announcements
FOR       UPDATE TO authenticated USING (
          author_id = auth.uid ()
AND       public.is_beadle_of (block_id)
          )
WITH      CHECK (
          author_id = auth.uid ()
AND       public.is_beadle_of (block_id)
          );
CREATE    POLICY "announcements_delete_beadle" ON public.beadle_announcements FOR delete TO authenticated USING (
author_id = auth.uid ()
AND       public.is_beadle_of (block_id)
          );
CREATE    POLICY "block_links_select" ON public.block_links FOR
SELECT    TO authenticated USING (
          EXISTS (
          SELECT    1
          FROM      public.blocks b
          WHERE     b.id = block_id
          AND       b.university_id = public.current_user_university_id ()
          )
          );
CREATE    POLICY "block_links_insert_beadle" ON public.block_links FOR insert TO authenticated
WITH      CHECK (public.is_beadle_of (block_id));
CREATE    POLICY "block_links_update_beadle" ON public.block_links
FOR       UPDATE TO authenticated USING (public.is_beadle_of (block_id))
WITH      CHECK (public.is_beadle_of (block_id));
CREATE    POLICY "block_links_delete_beadle" ON public.block_links FOR delete TO authenticated USING (public.is_beadle_of (block_id));
INSERT    INTO public.universities (name, short_code, email_domain, theme_color)
VALUES    ('Ateneo de Manila University', 'ADMU', 'student.ateneo.edu', '#1E6FBA'),
          ('De La Salle University', 'DLSU', 'dlsu.edu.ph', '#00703C'),
          ('FEU Tech', 'FEUTECH', 'fit.edu.ph', '#006400'),
          ('FEU Manila', 'FEU', 'feu.edu.ph', '#004D25'),
          ('University of Santo Tomas', 'UST', 'ust.edu.ph', '#FFD700'),
          ('University of Asia and the Pacific', 'UA&P', 'uap.asia', '#002B49'),
          ('CIIT College of Arts and Technology', 'CIIT', 'ciit.edu.ph', '#E31837')
ON        CONFLICT (email_domain) DO UPDATE
SET       name = excluded.name,
          short_code = excluded.short_code,
          theme_color = excluded.theme_color;