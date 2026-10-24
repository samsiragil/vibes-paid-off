-- Prepended to every test file by scripts/db-test.mjs. The whole run is one transaction that the
-- runner aborts at the end, so fixtures (users, projects, the tap schema) never persist.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

create schema tap;
grant usage on schema tap to public;

create table tap.out (id serial primary key, line text);
grant all on tap.out to public;
grant all on sequence tap.out_id_seq to public;

-- Fixture ids by name, so tests can say tap.id('maker1') instead of juggling uuids.
create table tap.ids (k text primary key, id uuid not null);
grant all on tap.ids to public;

create function tap.id(key text) returns uuid language sql stable as $$
  select id from tap.ids where k = key;
$$;

-- Every assertion is wrapped in tap.emit(...) so its TAP line reaches the runner.
create function tap.emit(line text) returns void language sql as $$
  insert into tap.out (line) values (line);
$$;

create function tap.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function tap.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
end;
$$;

-- The server (secret key): the only caller of post_reply_as().
create function tap.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
end;
$$;

create function tap.as_postgres() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Creates an auth user (the trigger makes the profile) with a fixed account age and username.
create function tap.user(handle text, created timestamptz default '2020-01-01', with_username boolean default true)
returns uuid language plpgsql as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role, created_at, raw_user_meta_data)
  values (uid, handle || '@vpo-test.local', 'authenticated', 'authenticated', created,
    jsonb_build_object('full_name', 'Test ' || handle, 'avatar_url', 'https://example.com/a.png'));
  update public.profiles
  set created_at = created, username = case when with_username then 'tst_' || handle end
  where id = uid;
  insert into tap.ids values (handle, uid);
  return uid;
end;
$$;

create function tap.project(
  owner uuid,
  slug text,
  status public.project_status default 'published',
  published timestamptz default '2029-12-01',
  with_media boolean default true
) returns uuid language plpgsql as $$
declare
  pid uuid;
begin
  -- created_at is in the past so fixtures do not count toward the daily rate limit.
  insert into public.projects (owner_id, slug, title, tagline, key_prompt, build_effort, live_url, category, status, published_at, created_at)
  values (owner, 'tst-' || slug, 'Test ' || slug, 'Tagline ' || slug, 'Prompt kunci ' || slug, 'weekend',
    'https://example.com/' || slug, 'other', status,
    case when status = 'published' then published end, '2020-06-01')
  returning id into pid;
  insert into public.project_sessions (project_id, sort_order, duration_hours, prompt, result)
  values (pid, 0, 2, 'Bikin halaman ' || slug, 'Halaman jadi');
  if with_media then
    insert into public.project_media (project_id, r2_key, width, height, bytes, sort_order)
    values (pid, 'test/' || pid || '.webp', 1600, 1000, 120000, 0);
  end if;
  insert into tap.ids values (slug, pid);
  return pid;
end;
$$;

create function tap.vote(voter uuid, project uuid, at timestamptz) returns void language sql as $$
  insert into public.upvotes (user_id, project_id, created_at) values (voter, project, at);
$$;

create function tap.reply(author uuid, project uuid, at timestamptz) returns void language sql as $$
  insert into public.comments (user_id, project_id, body, created_at) values (author, project, 'Mantap!', at);
$$;

grant execute on all functions in schema tap to public;

select no_plan();
