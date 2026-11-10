# Admin verification and per-listing renewals
- [ ] Move the verification centre and evidence tools into authenticator-protected Admin; remove public and account verification navigation.
- [ ] Confirm introductory periods, separate subscriptions, immediate expiry hiding, verified payment restoration, and retained history for IP and services.
- [ ] Improve dashboard monitoring, complete revenue totals, and payment callback handling.
- [ ] Verify authenticated navigation, payment/visibility rules, and notification outcomes; email delivery awaits sender-domain setup and real payments require payer consent.

# IP Verification and Services navigation
- [x] Keep both pages in the main navigation on desktop and smaller screens without crowding account links.
- [x] Preserve verification/service destinations after sign-in and provide a way back from service submission.
- [x] Verify public pages and signed-in navigation at 1280px, 631px and 375px; 39 unit tests pass and no browser errors.

# Registration and verification checks
- [x] Confirm authenticator-protected IP review at the server boundary and test decision/history/privacy rules.
- [x] Track successful verification submissions, review outcomes and listing renewal requests/confirmations without personal data; four catalog schemas registered and validated.
- [ ] Configure verification/renewal sender domain: waiting for the owner to complete the email-domain dialog.
- [x] Add a Daraja preflight and explicit phone/amount confirmation before requesting a payment; keep live payments off.
- [x] Extract printed ownership details from private certificates and preserve uncertain or missing fields for review; real-certificate inference still awaits a supplied certificate.
- [x] Set up the designated existing administrator account and explain secure sign-in.
- [x] Add buyer/seller account profiles and administrator role management with enforced privileges.
- [x] Run 43 isolated identity/asset/permission checks; fix missing audit and notifications on certificate changes.
- [x] Verify private identity and certificate links through the administrator screens; deny unrelated buyer and public access.
- [x] Rerun live signup/sign-in/submission/profile/role tests; verify approval notifications, audit and publication in isolation.

# Password recovery and navigation
- [x] Add forgot-password and public reset-password pages for all accounts, preserving administrator MFA.
- [x] Create an IP brand favicon and a homepage icon on every content page.
- [x] Verify buyer/admin recovery, existing authenticator checks, expired links, favicon, homepage navigation, and registration tests; inbox delivery remains unverified.

# KIPI IP verification centre
- [x] Discover 28 official source links spanning 2008–2026; import January 2008 evidence with physical page citations.
- [x] Add private verification requests, evidence, results, reviews and auditable journal processing.
- [x] Build centre, submission, history, results, administrator journal/review screens and listing integration.
- [x] Add bounded native PDF processing, certificate comparison and clear manual-review flags for scanned pages (OCR declined).
- [x] Add private PDF reports, in-app notifications, daily source discovery/indexing at 08:00 Nairobi and failure/coverage states.
- [x] Verify a real 2008 application match and report download/readback; test privacy, MFA and review semantics in isolation.
- [ ] Verify real-browser administrator review and certificate AI extraction: requires administrator authenticator code and an actual certificate.

# Listing visibility and M-Pesa renewals
- [x] Add per-listing three-calendar-month introductory visibility from approval/publication and KSh 1,000 / 30-day renewals.
- [x] Add professional service listings, owner renewal controls and administrator visibility/payment monitoring.
- [x] Add direct Daraja STK Push, independent callback status queries, payment leases and transactional deduplication; direct authorization verified.
- [x] Enforce expiry on public reads immediately; daily in-app reminders use free 14/7/3 and paid 7/3 days.
- [x] Test exact prices/durations, early/late renewal, duplicate and test payments, expiry privacy and service approval; 74 database checks and 29 unit tests pass.
- [ ] Verify M-Pesa prompt/payment end-to-end: requires an approved listing owned by a test payer and phone confirmation; live mode remains off.
- [ ] Add/send email reminders: sender domain setup required; no email domain currently configured.
