ALTER TABLE public.certificate_checks
  ADD COLUMN review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN reviewer_id uuid,
  ADD COLUMN reviewer_notes text,
  ADD COLUMN reviewed_at timestamptz;
UPDATE public.certificate_checks SET review_status = 'not_required' WHERE jsonb_array_length(mismatches) = 0;
GRANT UPDATE ON public.certificate_checks TO authenticated;
CREATE POLICY "Reviewers decide on checks" ON public.certificate_checks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'verifier'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'verifier'));

ALTER TABLE public.ip_listings ADD COLUMN cert_expiry_date date, ADD COLUMN cert_grant_date date;

CREATE POLICY "Verifiers view audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'verifier'));
CREATE POLICY "Owners view their asset history" ON public.audit_logs FOR SELECT TO authenticated
  USING (entity_type = 'ip_listing' AND EXISTS (SELECT 1 FROM public.ip_listings l WHERE l.id = entity_id AND l.owner_id = auth.uid()));

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  listing_id uuid REFERENCES public.ip_listings(id) ON DELETE CASCADE,
  dedupe_key text UNIQUE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users mark own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX ON public.notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.queue_expiry_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; w integer; c integer;
BEGIN
  FOREACH w IN ARRAY ARRAY[180, 90, 30, 7, 0] LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, listing_id, dedupe_key)
    SELECT l.owner_id, 'renewal_reminder',
      CASE WHEN w = 0 THEN 'Registration expired: ' || l.title ELSE 'Renewal due soon: ' || l.title END,
      CASE WHEN w = 0 THEN 'The registration for this asset expired on ' || to_char(l.cert_expiry_date,'DD Mon YYYY') || '. Renew it with ' || coalesce(l.registration_authority,'the IP office') || ' to keep it listed as verified.'
           ELSE 'The registration expires on ' || to_char(l.cert_expiry_date,'DD Mon YYYY') || ' (' || (l.cert_expiry_date - current_date) || ' days). Start renewal with ' || coalesce(l.registration_authority,'the IP office') || '.' END,
      l.id, l.id || ':' || l.cert_expiry_date || ':' || w
    FROM public.ip_listings l
    WHERE l.verification_status = 'verified' AND l.cert_expiry_date IS NOT NULL
      AND l.cert_expiry_date - current_date <= w
      AND (w = 0 OR l.cert_expiry_date >= current_date)
    ON CONFLICT (dedupe_key) DO NOTHING;
    GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.queue_expiry_reminders() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reminders_on_expiry_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.queue_expiry_reminders(); RETURN NULL; END $$;
REVOKE EXECUTE ON FUNCTION public.reminders_on_expiry_change() FROM public, anon, authenticated;
CREATE TRIGGER ip_listings_expiry_reminders AFTER UPDATE OF cert_expiry_date, verification_status ON public.ip_listings
  FOR EACH STATEMENT EXECUTE FUNCTION public.reminders_on_expiry_change();