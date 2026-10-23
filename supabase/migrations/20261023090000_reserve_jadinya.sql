-- Rename to Jadinya: reserve the new brand as a username, next to the old one.
--
-- Only the list changes; the function stays immutable, so the username check constraint keeps
-- using it as before. Existing profiles are not rechecked.

create or replace function public.is_reserved_username(name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(name) = any (array[
    'admin', 'administrator', 'root', 'me', 'api', 'auth', 'login', 'logout', 'signup',
    'onboarding', 'submit', 'explore', 'tools', 'support', 'rules', 'about', 'settings',
    'help', 'p', 'u', 'id', 'en', 'dev', 'null', 'undefined', 'system', 'moderator', 'mod',
    'staff', 'official', 'vibes', 'vibespaidoff', 'vibes_paid_off', 'vpo',
    'jadinya', 'jadinya_dev', 'jadinyadev'
  ]);
$$;
