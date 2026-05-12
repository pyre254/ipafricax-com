
-- Fix search_path on touch_updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- Revoke broad EXECUTE on SECURITY DEFINER helpers (only triggers/policies need them)
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Tighten audit log insert: actor must match
drop policy if exists "Authenticated insert audit logs" on public.audit_logs;
create policy "Users insert own audit logs"
  on public.audit_logs for insert to authenticated
  with check (actor_id = auth.uid());

-- Drop broad public listing policy on listing-covers (public bucket files are still accessible by direct URL)
drop policy if exists "Public read listing covers" on storage.objects;
