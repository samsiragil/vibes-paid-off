-- Security audit run-1, stage 3: replies are written only by the server, after Turnstile.
--
-- Turnstile is checked in the postReply server action, but signed-in users could insert into
-- comments straight through the Data API with the public key and skip it. The insert grant is
-- revoked; the server action now calls post_reply_as() with the secret key (service_role only)
-- once the challenge passed. The function runs the insert as that user, so comments_before_insert
-- still applies the username rule, the 30-per-24h quota, trimming and the forced status.
-- Deleting your own reply stays a direct call.

revoke insert on public.comments from authenticated;
revoke insert (project_id, body) on public.comments from authenticated;
drop policy comments_insert_own on public.comments;

create function public.post_reply_as(p_user_id uuid, p_project_id uuid, p_body text)
returns table (id uuid, body text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_sub text := current_setting('request.jwt.claim.sub', true);
begin
  if p_user_id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- What comments_insert_own checked; this function bypasses RLS.
  if not exists (
    select 1 from public.projects p where p.id = p_project_id and p.status = 'published'
  ) then
    raise exception 'project_not_published' using errcode = '42501';
  end if;

  -- The triggers read auth.uid(): act as the user for this insert, then restore the caller.
  -- auth.uid() reads the legacy request.jwt.claim.sub first, so set both.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);

  return query
  insert into public.comments as c (user_id, project_id, body)
  values (p_user_id, p_project_id, p_body)
  returning c.id, c.body, c.created_at;

  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
end;
$$;

revoke execute on function public.post_reply_as(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.post_reply_as(uuid, uuid, text) to service_role;
