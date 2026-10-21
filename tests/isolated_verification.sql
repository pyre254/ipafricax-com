-- Runs only against a disposable database loaded with the project's migrations.
-- Fixed identities are synthetic; no hosted accounts or roles are changed.
INSERT INTO auth.users(id,raw_user_meta_data) VALUES
 ('10000000-0000-0000-0000-000000000001','{"full_name":"TEST Rights Holder","is_rights_holder":true}'),
 ('10000000-0000-0000-0000-000000000002','{"full_name":"TEST Verifier","is_rights_holder":true}'),
 ('10000000-0000-0000-0000-000000000003','{"full_name":"TEST Buyer"}');
INSERT INTO public.user_roles(user_id,role) VALUES ('10000000-0000-0000-0000-000000000002','verifier');

CREATE FUNCTION pg_temp.assert_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE failed boolean := false;
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
   IF position(expected in SQLERRM)=0 THEN RAISE; END IF; failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'FAIL: % was allowed',label; END IF;
 RAISE NOTICE 'PASS: %',label;
END $$;

SELECT pg_temp.assert_true((SELECT count(*)=2 FROM user_roles WHERE user_id='10000000-0000-0000-0000-000000000001'),'registration assigns buyer and rights-holder only');
SELECT pg_temp.assert_true((SELECT count(*)=1 AND bool_and(role='buyer') FROM user_roles WHERE user_id='10000000-0000-0000-0000-000000000003'),'buyer registration cannot grant reviewer access');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
INSERT INTO kyc_submissions(id,user_id,full_legal_name,id_document_type,id_document_number,id_document_url)
 VALUES('20000000-0000-0000-0000-000000000001',auth.uid(),'TEST Rights Holder','national_id','SYNTHETIC','10000000-0000-0000-0000-000000000001/id.png');
SELECT pg_temp.assert_true((SELECT kyc_status='pending' FROM profiles WHERE id=auth.uid()),'identity submission synchronizes pending profile status');
SELECT pg_temp.expect_error($q$UPDATE profiles SET kyc_status='approved' WHERE id=auth.uid()$q$,'reviewers only','owner cannot self-verify profile');
SELECT pg_temp.expect_error($q$SELECT decide_kyc('20000000-0000-0000-0000-000000000001','approved','self')$q$,'Reviewer access required','owner cannot approve identity');
INSERT INTO ip_listings(id,owner_id,title,ip_type,abstract,documents,status,verification_status) VALUES
 ('30000000-0000-0000-0000-000000000001',auth.uid(),'TEST Asset','patent','Synthetic certificate fixture','[{"kind":"registration_certificate","path":"10000000-0000-0000-0000-000000000001/cert.png"}]','pending_review','pending'),
 ('30000000-0000-0000-0000-000000000002',auth.uid(),'TEST Missing Certificate','patent','Synthetic missing evidence fixture','[]','pending_review','pending');
SELECT pg_temp.expect_error($q$UPDATE ip_listings SET verification_status='verified',status='active' WHERE id='30000000-0000-0000-0000-000000000001'$q$,'Only reviewers','owner cannot self-publish asset');
SELECT pg_temp.expect_error($q$INSERT INTO user_roles(user_id,role) VALUES(auth.uid(),'admin')$q$,'row-level security','owner cannot assign admin role');

SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM ip_listings),'unrelated buyer cannot see pending assets');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM kyc_submissions),'unrelated buyer cannot see identity evidence');

SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
SELECT pg_temp.expect_error($q$SELECT decide_listing('30000000-0000-0000-0000-000000000001','verified','premature')$q$,'identity before publishing','asset approval requires approved identity');
SELECT decide_kyc('20000000-0000-0000-0000-000000000001','rejected','TEST: resubmit clearer document');
SELECT pg_temp.assert_true((SELECT kyc_status='rejected' FROM profiles WHERE id='10000000-0000-0000-0000-000000000001'),'identity rejection synchronizes profile');
SELECT pg_temp.expect_error($q$SELECT decide_kyc('20000000-0000-0000-0000-000000000001','approved','duplicate')$q$,'no longer pending','duplicate identity decisions fail');

SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
INSERT INTO kyc_submissions(id,user_id,full_legal_name,id_document_type,id_document_number,id_document_url,org_certificate_url,org_registration_number)
 VALUES('20000000-0000-0000-0000-000000000002',auth.uid(),'TEST Rights Holder','national_id','SYNTHETIC','10000000-0000-0000-0000-000000000001/id.png','10000000-0000-0000-0000-000000000001/org.png','TEST-ORG');
SELECT pg_temp.assert_true((SELECT kyc_status='pending' FROM profiles WHERE id=auth.uid()),'rejected identity can be resubmitted');
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
SELECT decide_kyc('20000000-0000-0000-0000-000000000002','approved','TEST: evidence approved');
SELECT pg_temp.assert_true((SELECT kyc_status='approved' AND org_verified FROM profiles WHERE id='10000000-0000-0000-0000-000000000001'),'identity approval atomically verifies profile and organization');
SELECT pg_temp.assert_true((SELECT status='approved' AND reviewer_id=auth.uid() AND reviewed_at IS NOT NULL AND reviewer_notes='TEST: evidence approved' FROM kyc_submissions WHERE id='20000000-0000-0000-0000-000000000002'),'identity approval records reviewer date and notes');
SELECT pg_temp.expect_error($q$SELECT decide_listing('30000000-0000-0000-0000-000000000002','verified','missing')$q$,'certificate is required','asset approval requires certificate');
SELECT decide_listing('30000000-0000-0000-0000-000000000002','rejected','TEST: missing certificate');
SELECT pg_temp.assert_true((SELECT verification_status='rejected' AND status='withdrawn' FROM ip_listings WHERE id='30000000-0000-0000-0000-000000000002'),'asset rejection withdraws listing');
SELECT decide_listing('30000000-0000-0000-0000-000000000001','verified','TEST: registry checked');
SELECT pg_temp.assert_true((SELECT verification_status='verified' AND status='active' AND verified_by=auth.uid() AND verified_at IS NOT NULL FROM ip_listings WHERE id='30000000-0000-0000-0000-000000000001'),'asset approval publishes with reviewer evidence');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM audit_logs WHERE entity_id='30000000-0000-0000-0000-000000000001' AND action='listing.verified' AND metadata->>'notes'='TEST: registry checked'),'asset approval records exactly one audit decision');
SELECT pg_temp.expect_error($q$SELECT decide_listing('30000000-0000-0000-0000-000000000001','verified','duplicate')$q$,'no longer pending','duplicate asset decisions fail');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM notifications WHERE listing_id='30000000-0000-0000-0000-000000000001' AND kind='listing_review'),'asset approval notifies rights-holder');
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub','',false);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM ip_listings),'only approved active assets are public');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
UPDATE ip_listings SET registration_number='TEST-CHANGED' WHERE id='30000000-0000-0000-0000-000000000001';
SELECT pg_temp.assert_true((SELECT verification_status='pending' AND status='pending_review' AND verified_by IS NULL AND verified_at IS NULL FROM ip_listings WHERE id='30000000-0000-0000-0000-000000000001'),'changing verified registration invalidates approval');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM audit_logs WHERE entity_id='30000000-0000-0000-0000-000000000001' AND action='listing.pending'),'invalidated approval records audit history');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM notifications WHERE listing_id='30000000-0000-0000-0000-000000000001' AND kind='listing_review'),'invalidated approval notifies rights-holder');