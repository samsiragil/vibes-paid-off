-- search_projects (Fase 6, /explore and /tools/[slug]) against 30 published fixtures.
-- Every fixture uses test-only categories and tools, and every text query includes the marker
-- word "zzvpo", so real rows in the linked database never change the expected results.

insert into categories (slug, sort_order) values ('tst-a', 900), ('tst-b', 901);
insert into tools (slug, name, kind) values
  ('tst-tool-a', 'Test Tool A', 'ai_agent'),
  ('tst-tool-b', 'Test Tool B', 'backend');

select tap.user('m1'), tap.user('m2'), tap.user('m3');

-- p01 … p30: category tst-a for 1–15, tst-b for 16–30; odd = EN, even = ID; published one day
-- apart (p30 newest); eligible votes = n % 7; tool A on even n, tool B on n divisible by 3.
do $$
declare
  n integer;
  key text;
  pid uuid;
begin
  for n in 1..30 loop
    key := 'p' || lpad(n::text, 2, '0');
    pid := tap.project(tap.id('m' || (n % 3 + 1)), key);
    update projects set
      title = case when n <= 5 then 'Kasir warung ' || key else 'Aplikasi ' || key end,
      key_prompt = case when n = 10 then 'Bikin kasir buat toko' else 'Bikin sesuatu ' || key end,
      description = 'Fixture zzvpo ' || key,
      category = case when n <= 15 then 'tst-a' else 'tst-b' end,
      content_lang = case when n % 2 = 1 then 'en' else 'id' end::content_lang,
      published_at = timestamptz '2026-01-01 00:00+07' + n * interval '1 day',
      eligible_upvote_count = n % 7
    where id = pid;
    if n % 2 = 0 then
      insert into project_tools (project_id, tool_id)
      values (pid, (select id from tools where slug = 'tst-tool-a'));
    end if;
    if n % 3 = 0 then
      insert into project_tools (project_id, tool_id)
      values (pid, (select id from tools where slug = 'tst-tool-b'));
    end if;
  end loop;
end;
$$;

-- Only a session prompt mentions it (search covers session prompts, prefix match).
update project_sessions set prompt = 'Tambah fitur kasirku yang baru'
where project_id = tap.id('p20');

-- Not published: never listed.
select tap.project(tap.id('m1'), 'hidden-one', 'hidden');
select tap.project(tap.id('m1'), 'pending-one', 'pending');
update projects set category = 'tst-a', description = 'Kasir zzvpo'
where id in (tap.id('hidden-one'), tap.id('pending-one'));

-- Slugs (without the "tst-" prefix) in result order.
create function tap.search(
  q text default null,
  tool_slugs text[] default null,
  cats text[] default '{tst-a,tst-b}',
  lang content_lang default null,
  sort text default 'worth_it',
  after jsonb default null,
  lim integer default 48
) returns text[] language sql as $$
  select coalesce(array_agg(replace(p.slug, 'tst-', '') order by s.n), '{}')
  from search_projects(q, tool_slugs, cats, lang, sort, after, lim) with ordinality as s (project_id, e, published_at, total, n)
  join projects p on p.id = s.project_id;
$$;

create function tap.search_total(
  q text default null,
  tool_slugs text[] default null,
  cats text[] default '{tst-a,tst-b}',
  sort text default 'worth_it',
  after jsonb default null,
  lim integer default 48
) returns bigint language sql as $$
  select max(total_count) from search_projects(q, tool_slugs, cats, null, sort, after, lim);
$$;

-- Keyset cursor for the row of a fixture, as the app builds it from the last row of a page.
create function tap.cursor_of(key text) returns jsonb language sql as $$
  select jsonb_build_object('e', eligible_upvote_count, 'p', published_at, 'i', id)
  from projects where id = tap.id(key);
$$;

-- Walk every page of 7 and check nothing is skipped or repeated.
create function tap.walk(sort text, page integer) returns text[] language plpgsql as $$
declare
  acc text[] := '{}';
  chunk text[];
  cur jsonb := null;
begin
  loop
    chunk := tap.search(sort => sort, after => cur, lim => page);
    exit when cardinality(chunk) = 0;
    acc := acc || chunk;
    cur := tap.cursor_of(chunk[cardinality(chunk)]);
  end loop;
  return acc;
end;
$$;

grant execute on all functions in schema tap to public;

-- Filters ------------------------------------------------------------------------
select tap.as_anon();

select tap.emit(is(tap.search_total(), 30::bigint, 'both test categories: 30 published projects'));
select tap.emit(is(
  tap.search_total(cats => '{tst-a}'), 15::bigint, 'one category: 15 (hidden and pending left out)'
));
select tap.emit(is(
  cardinality(tap.search(lang => 'en')), 15, 'content language EN: the 15 odd fixtures'
));
select tap.emit(ok(
  (select bool_and(right(s, 2)::int % 2 = 1) from unnest(tap.search(lang => 'en')) s),
  'EN filter returns only EN projects'
));
select tap.emit(is(
  tap.search_total(tool_slugs => '{tst-tool-a}'), 15::bigint, 'one tool: 15 projects use it'
));
select tap.emit(is(
  tap.search(tool_slugs => '{tst-tool-a,tst-tool-b}', sort => 'new'),
  '{p30,p24,p18,p12,p06}'::text[],
  'two tools: only projects that use both (a combination)'
));
select tap.emit(is(
  tap.search(tool_slugs => '{tst-tool-a,tst-tool-b}', cats => '{tst-a}', lang => 'id', sort => 'new'),
  '{p12,p06}'::text[],
  'tools, category and language combine'
));
select tap.emit(is(
  tap.search(tool_slugs => '{tst-tool-a,unknown-tool}'), '{}'::text[], 'an unknown tool matches nothing'
));
select tap.emit(is(
  tap.search_total(tool_slugs => '{tst-tool-a,tst-tool-a}'), 15::bigint, 'a repeated tool counts once'
));

-- Search ---------------------------------------------------------------------------
select tap.emit(is(
  tap.search('kasir zzvpo', sort => 'new'),
  '{p20,p10,p05,p04,p03,p02,p01}'::text[],
  'search covers title, key prompt and session prompts'
));
select tap.emit(is(
  tap.search('KAS zzv', sort => 'new'),
  '{p20,p10,p05,p04,p03,p02,p01}'::text[],
  'words match as prefixes, case-insensitive'
));
select tap.emit(is(
  tap.search('kasir warung zzvpo', sort => 'new'),
  '{p05,p04,p03,p02,p01}'::text[],
  'every word must match'
));
select tap.emit(is(
  tap.search('kasir & | ! :* ( zzvpo', sort => 'new'),
  '{p20,p10,p05,p04,p03,p02,p01}'::text[],
  'tsquery operators in the input are ignored'
));
select tap.emit(is(tap.search_total('   '), 30::bigint, 'a blank query is no query'));
select tap.emit(ok(prefix_tsquery('!!') is null, 'no searchable word: null tsquery'));

-- Sorting and keyset pagination -----------------------------------------------------
select tap.emit(is(
  tap.search(sort => 'new', lim => 5), '{p30,p29,p28,p27,p26}'::text[], 'Terbaru: newest first'
));
select tap.emit(is(
  tap.search(sort => 'new', after => tap.cursor_of('p26'), lim => 5),
  '{p25,p24,p23,p22,p21}'::text[],
  'Terbaru: the next page continues after the cursor'
));
select tap.emit(is(
  tap.search(lim => 6),
  '{p27,p20,p13,p06,p26,p19}'::text[],
  'Paling worth it: eligible votes, then newer first'
));
select tap.emit(is(
  tap.search(after => tap.cursor_of('p19'), lim => 4),
  '{p12,p05,p25,p18}'::text[],
  'Paling worth it: the next page crosses a vote tie correctly'
));
select tap.emit(is(
  tap.search_total(after => tap.cursor_of('p19'), lim => 4), 30::bigint,
  'total_count ignores the cursor'
));


select tap.emit(is(
  tap.walk('worth_it', 7), tap.search(), 'Paling worth it: pages of 7 add up to the full list'
));
select tap.emit(is(tap.walk('new', 7), tap.search(sort => 'new'), 'Terbaru: pages of 7 add up too'));
select tap.emit(is(
  cardinality(tap.search(lim => 1000)), 30, 'limit is capped (48) but returns all 30 here'
));
select tap.emit(is(cardinality(tap.search(lim => 0)), 1, 'limit below 1 becomes 1'));

-- Validation -----------------------------------------------------------------------
select tap.emit(throws_ok(
  $$ select * from search_projects(p_sort => 'random') $$, '22023', 'invalid_sort', 'unknown sort refused'
));
select tap.emit(throws_ok(
  $$ select * from search_projects(p_after => '{"p": "2026-01-01"}') $$,
  '22023', 'invalid_cursor', 'incomplete cursor refused'
));

-- Signed-in users see the same public list (never their own pending project).
select tap.as_user(tap.id('m1'));
select tap.emit(is(tap.search_total(cats => '{tst-a}'), 15::bigint, 'owner does not see own pending/hidden here'));

select tap.as_postgres();
