-- Security audit run-1, stage 4: per-account rate limit for /api/media/presign and /finalize.
--
-- finalize re-encodes the upload with sharp, and an image that ends in "does not fit" stores
-- nothing, so the 3-images-per-project quota never bounded how often one account could make the
-- server do that work. Both routes now call consume_media_quota() before any work: presign 30 and
-- finalize 20 per account per hour, counted whether or not the upload succeeds. The account's
-- profile row is locked first, so parallel requests cannot all pass the limit.

create table public.media_rate_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('presign', 'finalize')),
  created_at timestamptz not null default now()
);

create index media_rate_log_user_idx on public.media_rate_log (user_id, kind, created_at);

alter table public.media_rate_log enable row level security;
revoke all on public.media_rate_log from public, anon, authenticated;

comment on table public.media_rate_log is
  'Media route calls in the last hour (consume_media_quota). Rows older than an hour are pruned.';

create function public.consume_media_quota(p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := case p_kind when 'presign' then 30 when 'finalize' then 20 end;
begin
  if v_uid is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_limit is null then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;

  -- Serializes concurrent calls by the same account so they cannot all pass the limit.
  perform 1 from public.profiles where id = v_uid for no key update;
  delete from public.media_rate_log l
  where l.user_id = v_uid and l.created_at <= now() - interval '1 hour';
  if (
    select count(*) from public.media_rate_log l
    where l.user_id = v_uid and l.kind = p_kind
  ) >= v_limit then
    perform public.raise_rate_limit('media');
  end if;
  insert into public.media_rate_log (user_id, kind) values (v_uid, p_kind);
end;
$$;

revoke execute on function public.consume_media_quota(text) from public, anon;
grant execute on function public.consume_media_quota(text) to authenticated;
