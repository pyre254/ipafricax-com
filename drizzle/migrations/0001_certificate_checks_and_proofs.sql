CREATE TABLE public.certificate_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.ip_listings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  file_path text NOT NULL,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  mismatches jsonb NOT NULL DEFAULT '[]'::jsonb,
  match_score integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.certificate_checks TO authenticated;
GRANT ALL ON public.certificate_checks TO service_role;
ALTER TABLE public.certificate_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or reviewers view checks" ON public.certificate_checks FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'verifier'));
CREATE POLICY "Listing owner inserts checks" ON public.certificate_checks FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.ip_listings l WHERE l.id = listing_id AND l.owner_id = auth.uid()));

CREATE TABLE public.certificate_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.ip_listings(id) ON DELETE CASCADE,
  file_name text,
  sha256 text NOT NULL,
  prev_record_hash text,
  record_hash text NOT NULL,
  ots_proof text,
  ots_calendar text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.certificate_proofs TO anon;
GRANT SELECT, INSERT ON public.certificate_proofs TO authenticated;
GRANT ALL ON public.certificate_proofs TO service_role;
ALTER TABLE public.certificate_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Proofs public for verified listings" ON public.certificate_proofs FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.ip_listings l WHERE l.id = listing_id AND (l.status = 'active' OR l.owner_id = auth.uid())) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'verifier'));
CREATE POLICY "Owner or admin records proof of verified listing" ON public.certificate_proofs FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.ip_listings l WHERE l.id = listing_id AND l.verification_status = 'verified' AND (l.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'verifier'))));
CREATE INDEX ON public.certificate_proofs (created_at DESC);