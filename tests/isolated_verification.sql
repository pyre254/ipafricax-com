-- Runs only against a disposable database loaded with the project's migrations.
-- Fixed identities are synthetic; no hosted accounts or roles are changed.
INSERT INTO auth.users(id,raw_user_meta_data) VALUES
 ('10000000-0000-0000-0000-000000000001','{"full_name":"TEST Rights Holder","is_rights_holder":true}'),
 ('10000000-0000-0000-0000-000000000002','{"full_name":"TEST Verifier","is_rights_holder":true}'),
 ('10000000-0000-0000-0000-000000000003','{"full_name":"TEST Buyer"}');
INSERT INTO public.user_roles(user_id,role) VALUES ('10000000-0000-0000-0000-000000000002','verifier');
INSERT INTO auth.users(id,raw_user_meta_data) VALUES ('10000000-0000-0000-0000-000000000004','{"full_name":"TEST Administrator","role":"admin","is_admin":true}');
INSERT INTO public.user_roles(user_id,role) VALUES ('10000000-0000-0000-0000-000000000004','admin');
INSERT INTO storage.objects(bucket_id,name) VALUES
 ('kyc-documents','10000000-0000-0000-0000-000000000001/id.png'),
 ('kyc-documents','10000000-0000-0000-0000-000000000001/org.png'),
 ('ip-documents','10000000-0000-0000-0000-000000000001/cert.png');

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
SELECT pg_temp.assert_true((SELECT count(*)=1 AND bool_and(role='buyer') FROM user_roles WHERE user_id='10000000-0000-0000-0000-000000000004' AND role<>'admin'),'signup ignores requested admin metadata');

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
SELECT pg_temp.expect_error($q$INSERT INTO user_roles(user_id,role) VALUES(auth.uid(),'admin')$q$,'permission denied','owner cannot assign admin role');
SELECT pg_temp.expect_error($q$SELECT manage_account_role(auth.uid(),'admin',true)$q$,'Administrator access required','owner cannot use role-management operation');
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM storage.objects),'owner can read their submitted private documents');

SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM ip_listings),'unrelated buyer cannot see pending assets');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM kyc_submissions),'unrelated buyer cannot see identity evidence');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM storage.objects),'unrelated buyer cannot read any private document objects');
SELECT pg_temp.expect_error($q$INSERT INTO ip_listings(owner_id,title,ip_type,abstract) VALUES(auth.uid(),'Forbidden buyer upload','patent','test')$q$,'row-level security','buyer cannot upload seller assets');
SELECT pg_temp.expect_error($q$INSERT INTO storage.objects(bucket_id,name) VALUES('ip-documents','10000000-0000-0000-0000-000000000001/forged.png')$q$,'row-level security','buyer cannot upload files into another account');

SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM storage.objects),'verifier can read submitted certificate and identity documents');
SELECT pg_temp.expect_error($q$SELECT manage_account_role('10000000-0000-0000-0000-000000000003','admin',true)$q$,'Administrator access required','verifier cannot grant administrator access');
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
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM ip_listings),'buyer can read approved marketplace assets');
INSERT INTO escrow_transactions(id,listing_id,buyer_id,seller_id,amount,deal_type) VALUES('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',auth.uid(),'10000000-0000-0000-0000-000000000001',100,'license');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM escrow_transactions WHERE id='40000000-0000-0000-0000-000000000001'),'buyer role permits creating their own deal');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM storage.objects WHERE bucket_id IN ('ip-documents','kyc-documents')),'publication does not expose private documents to buyers');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM notifications WHERE listing_id='30000000-0000-0000-0000-000000000001' AND kind='listing_review'),'asset approval notifies rights-holder');
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub','',false);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM ip_listings),'only approved active assets are public');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM storage.objects),'anonymous user cannot read private certificate or identity objects');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
UPDATE ip_listings SET registration_number='TEST-CHANGED' WHERE id='30000000-0000-0000-0000-000000000001';
SELECT pg_temp.assert_true((SELECT verification_status='pending' AND status='pending_review' AND verified_by IS NULL AND verified_at IS NULL FROM ip_listings WHERE id='30000000-0000-0000-0000-000000000001'),'changing verified registration invalidates approval');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM audit_logs WHERE entity_id='30000000-0000-0000-0000-000000000001' AND action='listing.pending'),'invalidated approval records audit history');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM notifications WHERE listing_id='30000000-0000-0000-0000-000000000001' AND kind='listing_review'),'invalidated approval notifies rights-holder');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM storage.objects),'administrator can read submitted private documents');
SELECT manage_account_role('10000000-0000-0000-0000-000000000003','rights_holder',true);
SELECT pg_temp.assert_true(public.has_role('10000000-0000-0000-0000-000000000003','rights_holder'),'administrator can enable seller access for buyer');
SELECT manage_account_role('10000000-0000-0000-0000-000000000003','rights_holder',false);
SELECT pg_temp.assert_true(NOT public.has_role('10000000-0000-0000-0000-000000000003','rights_holder'),'administrator can revoke seller access');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM audit_logs WHERE entity_id='10000000-0000-0000-0000-000000000003' AND action IN ('account.role_granted','account.role_removed')),'role grant and removal both record audit history');
SELECT pg_temp.expect_error($q$SELECT manage_account_role(auth.uid(),'admin',false)$q$,'own administrator access','administrator cannot lock themselves out');
SELECT manage_account_role('10000000-0000-0000-0000-000000000003','buyer',false);
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
SELECT pg_temp.expect_error($q$INSERT INTO escrow_transactions(listing_id,buyer_id,seller_id,amount,deal_type) VALUES('30000000-0000-0000-0000-000000000001',auth.uid(),'10000000-0000-0000-0000-000000000001',100,'license')$q$,'row-level security','revoked buyer access blocks new deals');
RESET ROLE;