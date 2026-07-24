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
