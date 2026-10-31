-- Fire after all updates: a BEFORE trigger can invalidate approval when another column changes.
DROP TRIGGER IF EXISTS audit_listing_review ON public.ip_listings;
CREATE TRIGGER audit_listing_review AFTER UPDATE ON public.ip_listings FOR EACH ROW WHEN (OLD.verification_status IS DISTINCT FROM NEW.verification_status) EXECUTE FUNCTION public.log_listing_review();

CREATE OR REPLACE FUNCTION public.manage_account_role(p_user_id uuid, p_role public.app_role, p_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF p_enabled IS NULL OR p_role IS NULL THEN RAISE EXCEPTION 'Role and enabled state are required'; END IF;
  PERFORM pg_advisory_xact_lock(69318122);
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id) THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF p_role='admin' AND NOT p_enabled THEN
    IF p_user_id=auth.uid() THEN RAISE EXCEPTION 'You cannot remove your own administrator access'; END IF;
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
-- Role changes must go through the transactional, audited administrator operation.
REVOKE INSERT,UPDATE,DELETE ON public.user_roles FROM authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;