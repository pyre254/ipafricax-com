CREATE OR REPLACE FUNCTION public.queue_expiry_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; i integer; w integer; lo integer; c integer;
  ws integer[] := ARRAY[180, 90, 30, 7, 0];
BEGIN
  FOR i IN 1..array_length(ws,1) LOOP
    w := ws[i]; lo := CASE WHEN i < array_length(ws,1) THEN ws[i+1] ELSE -100000 END;
    INSERT INTO public.notifications (user_id, kind, title, body, listing_id, dedupe_key)
    SELECT l.owner_id, 'renewal_reminder',
      CASE WHEN w = 0 THEN 'Registration expired: ' || l.title ELSE 'Renewal due soon: ' || l.title END,
      CASE WHEN w = 0 THEN 'The registration for this asset expired on ' || to_char(l.cert_expiry_date,'DD Mon YYYY') || '. Renew it with ' || coalesce(l.registration_authority,'the IP office') || ' to keep it listed as verified.'
           ELSE 'The registration expires on ' || to_char(l.cert_expiry_date,'DD Mon YYYY') || ' (' || (l.cert_expiry_date - current_date) || ' days). Start renewal with ' || coalesce(l.registration_authority,'the IP office') || '.' END,
      l.id, l.id || ':' || l.cert_expiry_date || ':' || w
    FROM public.ip_listings l
    WHERE l.verification_status = 'verified' AND l.cert_expiry_date IS NOT NULL
      AND l.cert_expiry_date - current_date <= w AND l.cert_expiry_date - current_date > lo
    ON CONFLICT (dedupe_key) DO NOTHING;
    GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.queue_expiry_reminders() FROM public, anon, authenticated;