REVOKE ALL ON public.listing_renewal_confirmations FROM anon;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.listing_renewal_confirmations FROM authenticated;
GRANT SELECT ON public.listing_renewal_confirmations TO authenticated;
GRANT ALL ON public.listing_renewal_confirmations TO service_role;