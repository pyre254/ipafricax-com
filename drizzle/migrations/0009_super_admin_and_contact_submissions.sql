CREATE TABLE public.super_admin (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.super_admin TO authenticated;
GRANT ALL ON public.super_admin TO service_role;
ALTER TABLE public.super_admin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users see the super admin" ON public.super_admin FOR SELECT TO authenticated USING (true);
INSERT INTO public.super_admin(user_id) SELECT id FROM auth.users WHERE lower(email)='selfplanltd@gmail.com' LIMIT 1;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admin WHERE user_id=_user_id)
    AND (_user_id IS DISTINCT FROM auth.uid() OR coalesce(auth.jwt() ->> 'aal','')='aal2')
$$;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.manage_account_role(p_user_id uuid, p_role public.app_role, p_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF p_enabled IS NULL OR p_role IS NULL THEN RAISE EXCEPTION 'Role and enabled state are required'; END IF;
  IF p_role='admin' AND NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only the super administrator can change administrator access'; END IF;
  PERFORM pg_advisory_xact_lock(69318122);
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id) THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF p_role='admin' AND NOT p_enabled THEN
    IF p_user_id=auth.uid() THEN RAISE EXCEPTION 'You cannot remove your own administrator access'; END IF;
    IF EXISTS(SELECT 1 FROM public.super_admin WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'The super administrator keeps administrator access'; END IF;
    IF (SELECT count(*) FROM public.user_roles WHERE role='admin')<=1 THEN RAISE EXCEPTION 'At least one administrator must remain'; END IF;
  END IF;
  IF p_enabled THEN
    INSERT INTO public.user_roles(user_id,role) VALUES(p_user_id,p_role) ON CONFLICT(user_id,role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id=p_user_id AND role=p_role;
  END IF;
  IF FOUND THEN
    INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES(auth.uid(),CASE WHEN p_enabled THEN 'account.role_granted' ELSE 'account.role_removed' END,'user_role',p_user_id,jsonb_build_object('role',p_role));
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.manage_account_role(uuid,public.app_role,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_account_role(uuid,public.app_role,boolean) TO authenticated;

CREATE TABLE public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 255),
  phone text CHECK (phone IS NULL OR length(phone) <= 40),
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 4000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','resolved')),
  admin_notes text,
  handled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_submissions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.contact_submissions TO authenticated;
GRANT ALL ON public.contact_submissions TO service_role;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can send a contact message" ON public.contact_submissions FOR INSERT TO anon, authenticated
  WITH CHECK (status='new' AND admin_notes IS NULL AND handled_by IS NULL);
CREATE POLICY "Admins view contact messages" ON public.contact_submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update contact messages" ON public.contact_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER contact_submissions_touch BEFORE UPDATE ON public.contact_submissions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();