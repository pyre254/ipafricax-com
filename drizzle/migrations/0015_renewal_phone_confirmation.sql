CREATE TABLE public.listing_renewal_confirmations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 subscription_id uuid NOT NULL REFERENCES public.listing_subscriptions(id),
 owner_id uuid NOT NULL REFERENCES public.profiles(id),
 phone_number text NOT NULL CHECK(phone_number ~ '^254[17][0-9]{8}$'),
 environment text NOT NULL CHECK(environment IN ('sandbox','live')),
 amount integer NOT NULL DEFAULT 1000 CHECK(amount=1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes',
 consumed_at timestamptz
);
GRANT SELECT ON public.listing_renewal_confirmations TO authenticated;
GRANT ALL ON public.listing_renewal_confirmations TO service_role;
ALTER TABLE public.listing_renewal_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY renewal_confirmation_owner_read ON public.listing_renewal_confirmations FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE INDEX renewal_confirmation_owner_time ON public.listing_renewal_confirmations(owner_id,created_at DESC);
CREATE OR REPLACE FUNCTION public.consume_listing_renewal_confirmation(p_id uuid,p_subscription uuid,p_phone text,p_environment text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 UPDATE public.listing_renewal_confirmations c SET consumed_at=now()
 WHERE c.id=p_id AND c.subscription_id=p_subscription AND c.owner_id=auth.uid()
 AND c.phone_number=p_phone AND c.environment=p_environment AND c.amount=1000
 AND c.expires_at>now() AND c.consumed_at IS NULL
 AND EXISTS(SELECT 1 FROM public.listing_subscriptions s WHERE s.id=p_subscription AND s.owner_id=auth.uid() AND NOT s.admin_hidden AND
   (EXISTS(SELECT 1 FROM public.ip_listings l WHERE l.id=s.ip_listing_id AND l.status='active' AND l.verification_status='verified')
   OR EXISTS(SELECT 1 FROM public.service_listings l WHERE l.id=s.service_listing_id AND l.status='approved')));
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.consume_listing_renewal_confirmation(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consume_listing_renewal_confirmation(uuid,uuid,text,text) TO authenticated;
ALTER TABLE public.listing_payments ADD COLUMN phone_confirmation_id uuid REFERENCES public.listing_renewal_confirmations(id);
CREATE UNIQUE INDEX payment_phone_confirmation_once ON public.listing_payments(phone_confirmation_id) WHERE phone_confirmation_id IS NOT NULL;