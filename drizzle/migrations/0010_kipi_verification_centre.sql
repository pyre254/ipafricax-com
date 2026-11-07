CREATE TABLE public.kipi_journals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), journal_title text NOT NULL, publication_year integer NOT NULL CHECK(publication_year>=2008), publication_month integer CHECK(publication_month BETWEEN 1 AND 12), source_url text NOT NULL UNIQUE CHECK(source_url ~ '^https://(www\.)?kipi\.go\.ke/sites/default/files/'), discovery_url text NOT NULL, archive_format text NOT NULL CHECK(archive_format IN ('pdf','zip','rar')), archive_member text, parent_journal_id uuid REFERENCES public.kipi_journals(id), storage_path text, file_hash text, total_pages integer, processed_pages integer NOT NULL DEFAULT 0, indexed_records_count integer NOT NULL DEFAULT 0, processing_status text NOT NULL DEFAULT 'discovered', processing_error text, lease_until timestamptz, last_synced_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kipi_journals TO anon,authenticated; GRANT ALL ON public.kipi_journals TO service_role;
ALTER TABLE public.kipi_journals ENABLE ROW LEVEL SECURITY;
CREATE POLICY journals_public_read ON public.kipi_journals FOR SELECT TO anon,authenticated USING(true);
CREATE TABLE public.kipi_journal_pages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), journal_id uuid NOT NULL REFERENCES public.kipi_journals(id), page_number integer NOT NULL CHECK(page_number>0), extracted_text text NOT NULL, extraction_method text NOT NULL DEFAULT 'native_pdf', requires_ocr boolean NOT NULL DEFAULT false, evidence_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(journal_id,page_number));
GRANT SELECT ON public.kipi_journal_pages TO authenticated; GRANT ALL ON public.kipi_journal_pages TO service_role;
ALTER TABLE public.kipi_journal_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY pages_authenticated_read ON public.kipi_journal_pages FOR SELECT TO authenticated USING(true);
CREATE TABLE public.kipi_ip_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), journal_id uuid NOT NULL REFERENCES public.kipi_journals(id), ip_category text NOT NULL CHECK(ip_category IN ('patent','utility_model','industrial_design','trademark')), original_registration_number text NOT NULL, normalized_registration_number text NOT NULL, applicant_name text, proprietor_name text, ip_title text, filing_date date, publication_date date, registration_date date, expiry_date date, classification_code text, recorded_status text NOT NULL DEFAULT 'publication', source_page_number integer NOT NULL CHECK(source_page_number>0), extracted_text text NOT NULL, extraction_confidence numeric NOT NULL DEFAULT 0 CHECK(extraction_confidence BETWEEN 0 AND 100), record_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kipi_ip_records TO authenticated; GRANT ALL ON public.kipi_ip_records TO service_role;
ALTER TABLE public.kipi_ip_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY records_authenticated_read ON public.kipi_ip_records FOR SELECT TO authenticated USING(true);
CREATE INDEX kipi_record_number ON public.kipi_ip_records(ip_category,normalized_registration_number);
CREATE INDEX kipi_record_search ON public.kipi_ip_records USING gin(to_tsvector('simple',coalesce(applicant_name,'')||' '||coalesce(proprietor_name,'')||' '||coalesce(ip_title,'')||' '||original_registration_number));
CREATE INDEX kipi_record_journal ON public.kipi_ip_records(journal_id,source_page_number);
CREATE TABLE public.kipi_sync_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, discovered_count integer NOT NULL DEFAULT 0, error_message text, coverage_note text);
GRANT SELECT ON public.kipi_sync_runs TO anon,authenticated; GRANT ALL ON public.kipi_sync_runs TO service_role;
ALTER TABLE public.kipi_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sync_public_read ON public.kipi_sync_runs FOR SELECT TO anon,authenticated USING(true);
CREATE TABLE public.ip_verification_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), verification_reference text NOT NULL UNIQUE DEFAULT ('IPAX-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))), user_id uuid NOT NULL REFERENCES public.profiles(id), listing_id uuid REFERENCES public.ip_listings(id), ip_category text NOT NULL CHECK(ip_category IN ('patent','utility_model','industrial_design','trademark','copyright','trade_secret')), registration_number text NOT NULL, normalized_registration_number text NOT NULL, certificate_number text, ip_title text, applicant_name text NOT NULL, application_date date, claimed_registration_date date, declared_authorized boolean NOT NULL CHECK(declared_authorized), submission_status text NOT NULL DEFAULT 'submitted', verification_status text NOT NULL DEFAULT 'MANUAL_REVIEW_REQUIRED' CHECK(verification_status IN ('VERIFIED','PARTIALLY_VERIFIED','DISCREPANCY_DETECTED','NOT_FOUND','MANUAL_REVIEW_REQUIRED')), processing_error text, lease_until timestamptz, administrator_decision text, administrator_notes text, official_confirmation_url text, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT ON public.ip_verification_requests TO authenticated; GRANT ALL ON public.ip_verification_requests TO service_role;
ALTER TABLE public.ip_verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY verification_requests_read ON public.ip_verification_requests FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY verification_requests_submit ON public.ip_verification_requests FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND declared_authorized AND submission_status='submitted' AND verification_status='MANUAL_REVIEW_REQUIRED' AND administrator_decision IS NULL AND administrator_notes IS NULL AND official_confirmation_url IS NULL AND completed_at IS NULL AND lease_until IS NULL AND processing_error IS NULL AND (listing_id IS NULL OR EXISTS(SELECT 1 FROM public.ip_listings l WHERE l.id=listing_id AND l.owner_id=auth.uid())));
CREATE INDEX verification_owner_date ON public.ip_verification_requests(user_id,created_at DESC);
CREATE TABLE public.ip_verification_documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), verification_request_id uuid NOT NULL REFERENCES public.ip_verification_requests(id), document_type text NOT NULL CHECK(document_type IN ('certificate','supporting')), storage_path text NOT NULL UNIQUE, original_filename text NOT NULL, mime_type text NOT NULL, file_size bigint NOT NULL, sha256_hash text NOT NULL, uploaded_by uuid NOT NULL REFERENCES public.profiles(id), extracted_fields jsonb, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.ip_verification_documents TO authenticated; GRANT ALL ON public.ip_verification_documents TO service_role;
ALTER TABLE public.ip_verification_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY verification_documents_read ON public.ip_verification_documents FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.ip_verification_requests r WHERE r.id=verification_request_id AND (r.user_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE TABLE public.ip_verification_results(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), verification_request_id uuid NOT NULL REFERENCES public.ip_verification_requests(id), matched_record_id uuid REFERENCES public.kipi_ip_records(id), result_status text NOT NULL, record_match boolean NOT NULL DEFAULT false, certificate_consistency text NOT NULL DEFAULT 'not_assessed', certificate_authenticity text NOT NULL DEFAULT 'unconfirmed', registration_status text NOT NULL DEFAULT 'unconfirmed', field_comparison jsonb NOT NULL DEFAULT '[]', risk_indicators jsonb NOT NULL DEFAULT '[]', evidence_summary text NOT NULL, evidence_completeness numeric NOT NULL DEFAULT 0, ai_model text, coverage_snapshot jsonb NOT NULL DEFAULT '{}', report_path text, generated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.ip_verification_results TO authenticated; GRANT ALL ON public.ip_verification_results TO service_role;
ALTER TABLE public.ip_verification_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY verification_results_read ON public.ip_verification_results FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.ip_verification_requests r WHERE r.id=verification_request_id AND (r.user_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE TABLE public.ip_verification_evidence(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), verification_result_id uuid NOT NULL REFERENCES public.ip_verification_results(id), source_type text NOT NULL, source_title text NOT NULL, source_url text NOT NULL, journal_id uuid REFERENCES public.kipi_journals(id), page_number integer, supporting_extract text NOT NULL, evidence_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.ip_verification_evidence TO authenticated; GRANT ALL ON public.ip_verification_evidence TO service_role;
ALTER TABLE public.ip_verification_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY verification_evidence_read ON public.ip_verification_evidence FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.ip_verification_results v JOIN public.ip_verification_requests r ON r.id=v.verification_request_id WHERE v.id=verification_result_id AND (r.user_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE TABLE public.ip_verification_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), verification_request_id uuid NOT NULL REFERENCES public.ip_verification_requests(id), administrator_id uuid NOT NULL REFERENCES public.profiles(id), previous_status text NOT NULL, new_status text NOT NULL, review_decision text NOT NULL, review_notes text NOT NULL, confirmation_url text, reviewed_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.ip_verification_reviews TO authenticated; GRANT ALL ON public.ip_verification_reviews TO service_role;
ALTER TABLE public.ip_verification_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY verification_reviews_read ON public.ip_verification_reviews FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.ip_verification_requests r WHERE r.id=verification_request_id AND (r.user_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE TABLE public.ip_verification_audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), verification_request_id uuid REFERENCES public.ip_verification_requests(id), actor_id uuid REFERENCES public.profiles(id), action text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.ip_verification_audit_logs TO authenticated; GRANT ALL ON public.ip_verification_audit_logs TO service_role;
ALTER TABLE public.ip_verification_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY verification_audit_read ON public.ip_verification_audit_logs FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.ip_verification_requests r WHERE r.id=verification_request_id AND r.user_id=auth.uid()));
CREATE TABLE public.ip_verification_settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), setting_key text NOT NULL UNIQUE, setting_value jsonb NOT NULL, updated_by uuid REFERENCES public.profiles(id), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.ip_verification_settings TO authenticated; GRANT ALL ON public.ip_verification_settings TO service_role;
ALTER TABLE public.ip_verification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY verification_settings_admin ON public.ip_verification_settings FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.review_ip_verification(p_id uuid,p_decision text,p_notes text,p_confirmation_url text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ip_verification_requests; next_status text;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator MFA required'; END IF;
 IF p_decision NOT IN ('approve','reject','needs_documents','kipi_confirmation','inconclusive','reopen') OR length(trim(coalesce(p_notes,'')))<3 THEN RAISE EXCEPTION 'A valid decision and review notes are required'; END IF;
 SELECT * INTO r FROM public.ip_verification_requests WHERE id=p_id FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
 IF r.user_id=auth.uid() THEN RAISE EXCEPTION 'Self review is not allowed'; END IF;
 IF r.submission_status='processing' THEN RAISE EXCEPTION 'Processing must finish before review'; END IF;
 next_status:=CASE p_decision WHEN 'reject' THEN 'DISCREPANCY_DETECTED' WHEN 'approve' THEN 'PARTIALLY_VERIFIED' ELSE 'MANUAL_REVIEW_REQUIRED' END;
 IF p_decision='approve' THEN
  IF NOT EXISTS(SELECT 1 FROM public.ip_verification_results WHERE verification_request_id=p_id AND record_match) THEN RAISE EXCEPTION 'Official indexed evidence is required for approval'; END IF;
  IF p_confirmation_url IS NOT NULL THEN
   IF p_confirmation_url !~ '^https://(www\.)?kipi\.go\.ke/' THEN RAISE EXCEPTION 'Direct official KIPI confirmation is required'; END IF;
   next_status:='VERIFIED';
  END IF;
 END IF;
 UPDATE public.ip_verification_requests SET verification_status=next_status,administrator_decision=p_decision,administrator_notes=trim(p_notes),official_confirmation_url=p_confirmation_url,submission_status=CASE WHEN p_decision='reopen' THEN 'submitted' ELSE 'reviewed' END,updated_at=now() WHERE id=p_id;
 INSERT INTO public.ip_verification_reviews(verification_request_id,administrator_id,previous_status,new_status,review_decision,review_notes,confirmation_url) VALUES(p_id,auth.uid(),r.verification_status,next_status,p_decision,trim(p_notes),p_confirmation_url);
 INSERT INTO public.ip_verification_audit_logs(verification_request_id,actor_id,action,details) VALUES(p_id,auth.uid(),'verification.review_'||p_decision,jsonb_build_object('notes',p_notes,'confirmation_url',p_confirmation_url));
 INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES(auth.uid(),'verification.review_'||p_decision,'ip_verification',p_id,jsonb_build_object('notes',p_notes,'previous',r.verification_status,'result',next_status));
 INSERT INTO public.notifications(user_id,kind,title,body,listing_id) VALUES(r.user_id,'ip_verification','IP verification: '||replace(p_decision,'_',' '),p_notes,r.listing_id);
END $$;
REVOKE ALL ON FUNCTION public.review_ip_verification(uuid,text,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.review_ip_verification(uuid,text,text,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.claim_ip_verification(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.ip_verification_requests SET submission_status='processing',lease_until=now()+interval '5 minutes',updated_at=now() WHERE id=p_id AND (user_id=auth.uid() OR public.has_role(auth.uid(),'admin')) AND administrator_decision IS NULL AND (submission_status IN ('submitted','failed') OR (submission_status='processing' AND lease_until<now()));
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.claim_ip_verification(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.claim_ip_verification(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.claim_kipi_journal(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator MFA required'; END IF;
 UPDATE public.kipi_journals SET lease_until=now()+interval '5 minutes' WHERE id=p_id AND (lease_until IS NULL OR lease_until<now()); RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.claim_kipi_journal(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.claim_kipi_journal(uuid) TO authenticated;
CREATE POLICY verification_private_documents_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='ip-verification-private' AND (public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.ip_verification_documents d JOIN public.ip_verification_requests r ON r.id=d.verification_request_id WHERE d.storage_path=name AND r.user_id=auth.uid()) OR EXISTS(SELECT 1 FROM public.ip_verification_results v JOIN public.ip_verification_requests r ON r.id=v.verification_request_id WHERE v.report_path=name AND r.user_id=auth.uid())));
