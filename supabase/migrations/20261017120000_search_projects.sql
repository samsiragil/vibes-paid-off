-- Discovery (Fase 6): search and filters for /explore and /tools/[slug].
-- Runs as the caller (security invoker), so RLS still decides what is visible; only published
-- projects are ever returned.

-- "kasir warung" -> 'kasir:* & warung:*' (prefix match, every word must match). Null when the
-- input has no searchable word. Words are reduced to letters and digits, so to_tsquery never sees
-- operators typed by the user.
create function public.prefix_tsquery(p_query text)
returns tsquery
language sql
immutable
set search_path = ''
as $$
  select case when words is null then null else to_tsquery('simple', words) end
  from (
    select string_agg(w || ':*', ' & ' order by n) as words
    from (
      select w, n
      from regexp_split_to_table(lower(left(coalesce(p_query, ''), 200)), '[^[:alnum:]]+')
        with ordinality as t (w, n)
      where w <> ''
      order by n
      limit 8
    ) words
  ) q;
$$;

-- One page of /explore results, newest or "Paling worth it" first (§2.7 C).
--   p_tools       tool slugs; a project must use ALL of them ("kombinasi")
--   p_categories  category slugs; a project may be in ANY of them (one category per project)
--   p_sort        'worth_it' (eligible votes, then newer) or 'new'
--   p_after       keyset cursor from the last row of the previous page: {"e", "p", "i"}
-- total_count is the number of matches for the filters, before the cursor and the limit.
create function public.search_projects(
  p_query text default null,
  p_tools text[] default null,
  p_categories text[] default null,
  p_lang public.content_lang default null,
  p_sort text default 'worth_it',
  p_after jsonb default null,
  p_limit integer default 24
)
returns table (
  project_id uuid,
  eligible_upvote_count integer,
  published_at timestamptz,
  total_count bigint
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  q tsquery := public.prefix_tsquery(p_query);
  tool_slugs text[] := (select array_agg(distinct s) from unnest(p_tools) s where s is not null);
  after_e integer := (p_after ->> 'e')::integer;
  after_p timestamptz := (p_after ->> 'p')::timestamptz;
  after_i uuid := (p_after ->> 'i')::uuid;
  page_size integer := least(greatest(coalesce(p_limit, 24), 1), 48);
begin
  if p_sort is null or p_sort not in ('worth_it', 'new') then
    raise exception 'invalid_sort' using errcode = '22023';
  end if;
  if p_after is not null and (after_p is null or after_i is null or (p_sort = 'worth_it' and after_e is null)) then
    raise exception 'invalid_cursor' using errcode = '22023';
  end if;

  return query
    with matched as (
      select
        p.id,
        p.eligible_upvote_count,
        coalesce(p.published_at, p.created_at) as published_at,
        count(*) over () as total
      from public.projects p
      where p.status = 'published'
        and (q is null or p.search @@ q)
        and (p_categories is null or cardinality(p_categories) = 0 or p.category = any (p_categories))
        and (p_lang is null or p.content_lang = p_lang)
        and (
          tool_slugs is null
          or (
            select count(*)
            from public.project_tools pt
            join public.tools t on t.id = pt.tool_id
            where pt.project_id = p.id and t.slug = any (tool_slugs)
          ) = cardinality(tool_slugs)
        )
    )
    select m.id, m.eligible_upvote_count, m.published_at, m.total
    from matched m
    where p_after is null
      or (
        p_sort = 'worth_it'
        and (m.eligible_upvote_count, m.published_at, m.id) < (after_e, after_p, after_i)
      )
      or (p_sort = 'new' and (m.published_at, m.id) < (after_p, after_i))
    order by
      case when p_sort = 'worth_it' then m.eligible_upvote_count end desc nulls last,
      m.published_at desc,
      m.id desc
    limit page_size;
end;
$$;

revoke execute on function public.prefix_tsquery(text) from public;
revoke execute on function public.search_projects(text, text[], text[], public.content_lang, text, jsonb, integer)
  from public;
grant execute on function public.prefix_tsquery(text) to anon, authenticated;
grant execute on function public.search_projects(text, text[], text[], public.content_lang, text, jsonb, integer)
  to anon, authenticated;
