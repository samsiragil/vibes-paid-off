-- Vibes Paid Off: core schema (docs/implementation-plan.md §2.2).
-- Derived columns (counters, build time, search) are maintained by triggers in the next migration.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.project_status as enum ('pending', 'published', 'hidden', 'rejected', 'removed');
create type public.link_status as enum ('live', 'offline', 'archived');
create type public.content_lang as enum ('id', 'en');
create type public.tool_kind as enum (
  'ai_agent', 'ai_builder', 'ai_assistant', 'framework', 'backend', 'hosting', 'service'
);
create type public.report_reason as enum (
  'spam', 'scam', 'adult_illegal', 'harassment', 'personal_data', 'other'
);
create type public.report_target as enum ('project', 'comment');
create type public.comment_status as enum ('visible', 'hidden');
create type public.suggestion_status as enum ('pending', 'merged', 'rejected');

-- ---------------------------------------------------------------------------
-- Helpers used by check constraints
-- ---------------------------------------------------------------------------

-- Usernames that would collide with routes or impersonate the site.
create function public.is_reserved_username(name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(name) = any (array[
    'admin', 'administrator', 'root', 'me', 'api', 'auth', 'login', 'logout', 'signup',
    'onboarding', 'submit', 'explore', 'tools', 'support', 'rules', 'about', 'settings',
    'help', 'p', 'u', 'id', 'en', 'dev', 'null', 'undefined', 'system', 'moderator', 'mod',
    'staff', 'official', 'vibes', 'vibespaidoff', 'vibes_paid_off', 'vpo'
  ]);
$$;

create function public.is_https_url(url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select url ~ '^https://[^\s/]+\.[^\s]+$' and char_length(url) <= 500;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Null until the user finishes /onboarding; required before submitting a project.
  username extensions.citext unique,
  display_name text not null default '',
  avatar_url text,
  bio text,
  location text,
  links jsonb not null default '{}'::jsonb,
  tip_url text,
  is_trusted boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username is null
    or (username::text ~ '^[a-z0-9_]{3,20}$' and not public.is_reserved_username(username::text))
  ),
  constraint profiles_display_name_length check (char_length(display_name) <= 60),
  constraint profiles_bio_length check (char_length(bio) <= 280),
  constraint profiles_location_length check (char_length(location) <= 60),
  constraint profiles_links_object check (jsonb_typeof(links) = 'object'),
  constraint profiles_tip_url_https check (tip_url is null or public.is_https_url(tip_url))
);

comment on column public.profiles.is_trusted is
  'Set after an admin approves the first project; later projects publish without review.';

-- ---------------------------------------------------------------------------
-- Categories and tools
-- ---------------------------------------------------------------------------

-- Labels live in messages/*.json (categories.<slug>).
create table public.categories (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order smallint not null default 0
);

create table public.tools (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(name) between 1 and 60),
  url text check (url is null or public.is_https_url(url)),
  logo_url text check (logo_url is null or public.is_https_url(logo_url)),
  kind public.tool_kind not null,
  description_id text not null default '' check (char_length(description_id) <= 500),
  description_en text not null default '' check (char_length(description_en) <= 500),
  is_active boolean not null default true,
  -- Published projects using this tool; ordering for filters (§2.8).
  project_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index tools_kind_count_idx on public.tools (kind, project_count desc);

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  tagline text not null check (char_length(btrim(tagline)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 5000),
  key_prompt text not null check (char_length(btrim(key_prompt)) between 1 and 280),
  lessons text check (char_length(lessons) <= 2000),
  live_url text not null check (public.is_https_url(live_url)),
  repo_url text check (repo_url is null or public.is_https_url(repo_url)),
  video_url text check (
    video_url is null
    or (
      public.is_https_url(video_url)
      and video_url ~ '^https://((www|m)\.)?(youtube\.com|youtu\.be|loom\.com)/'
    )
  ),
  category text not null references public.categories (slug) on update cascade,
  content_lang public.content_lang not null default 'id',
  -- Derived from project_sessions.
  build_time_hours numeric(5, 1) not null default 0,
  session_count smallint not null default 0,
  status public.project_status not null default 'pending',
  link_status public.link_status not null default 'live',
  last_checked_at timestamptz,
  link_fail_count smallint not null default 0,
  -- Derived counters.
  upvote_count integer not null default 0,
  eligible_upvote_count integer not null default 0,
  comment_count integer not null default 0,
  report_count integer not null default 0,
  published_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  reject_reason text check (char_length(reject_reason) <= 1000),
  search tsvector not null default ''::tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_idx on public.projects (owner_id, created_at desc);
create index projects_status_published_idx on public.projects (status, published_at desc);
create index projects_status_eligible_idx on public.projects (status, eligible_upvote_count desc, published_at desc);
create index projects_category_idx on public.projects (category) where status = 'published';
create index projects_search_idx on public.projects using gin (search);

-- "Cara membuatnya": one row per build session (min 1, max 10 per project).
create table public.project_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  sort_order smallint not null check (sort_order between 0 and 9),
  label text check (char_length(label) <= 40),
  duration_hours numeric(3, 1) not null check (
    duration_hours > 0 and duration_hours <= 24 and duration_hours * 2 = trunc(duration_hours * 2)
  ),
  prompt text not null check (char_length(btrim(prompt)) between 1 and 1000),
  result text not null check (char_length(btrim(result)) between 1 and 500),
  challenge text check (char_length(challenge) <= 1000),
  solution text check (char_length(solution) <= 1000),
  created_at timestamptz not null default now(),
  constraint project_sessions_solution_needs_challenge check (solution is null or challenge is not null),
  constraint project_sessions_order_unique unique (project_id, sort_order) deferrable initially deferred
);

create table public.project_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  r2_key text not null unique,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  bytes integer not null check (bytes > 0),
  sort_order smallint not null check (sort_order between 0 and 2),
  created_at timestamptz not null default now(),
  constraint project_media_order_unique unique (project_id, sort_order) deferrable initially deferred
);

create table public.project_tools (
  project_id uuid not null references public.projects (id) on delete cascade,
  tool_id bigint not null references public.tools (id) on delete cascade,
  primary key (project_id, tool_id)
);

create index project_tools_tool_idx on public.project_tools (tool_id);

-- Tools a maker could not find in the catalog; an admin merges them (§2.8).
create table public.tool_suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  suggested_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  url text check (url is null or public.is_https_url(url)),
  status public.suggestion_status not null default 'pending',
  merged_tool_id bigint references public.tools (id) on delete set null,
  created_at timestamptz not null default now()
);

create index tool_suggestions_project_idx on public.tool_suggestions (project_id);
create index tool_suggestions_pending_idx on public.tool_suggestions (lower(name)) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Interactions
-- ---------------------------------------------------------------------------

create table public.upvotes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create index upvotes_project_created_idx on public.upvotes (project_id, created_at);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  status public.comment_status not null default 'visible',
  report_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index comments_project_created_idx on public.comments (project_id, created_at);
create index comments_user_created_idx on public.comments (user_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason public.report_reason not null,
  note text check (char_length(note) <= 500),
  resolved boolean not null default false,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolution text check (char_length(resolution) <= 1000),
  created_at timestamptz not null default now(),
  -- One account counts once per target.
  constraint reports_one_per_reporter unique (reporter_id, target_type, target_id)
);

create index reports_target_idx on public.reports (target_type, target_id);
create index reports_open_idx on public.reports (created_at) where not resolved;

-- ---------------------------------------------------------------------------
-- "Pilihan minggu ini" (§2.7), frozen per week and auditable
-- ---------------------------------------------------------------------------

create table public.weekly_picks (
  -- Monday (Asia/Jakarta) of the week the pick is shown; scored on the week before.
  week_start date primary key check (extract(isodow from week_start) = 1),
  -- Null when no candidate reached the minimum score.
  project_id uuid references public.projects (id) on delete set null,
  score numeric(8, 1),
  breakdown jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);

create index weekly_picks_project_idx on public.weekly_picks (project_id);
