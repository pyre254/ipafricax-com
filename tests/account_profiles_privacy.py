"""Live checks using the current administrator session and a synthetic buyer; never approves test evidence."""
import asyncio,json,os,secrets,time
from pathlib import Path
from playwright.async_api import async_playwright

OUT=Path('/tmp/browser/account-privacy')
OUT.mkdir(parents=True,exist_ok=True)

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  context=await browser.new_context(viewport={'width':1280,'height':1800})
  page=await context.new_page()
  errors=[]
  page.on('pageerror',lambda error: errors.append(str(error)))
  with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f: minted=json.load(f)
  if minted.get('cookies'):
   await context.add_cookies([{**c,'url':'http://localhost:8080'} for c in minted['cookies']])
  await page.goto('http://localhost:8080',wait_until='networkidle')
  await page.evaluate('([k,v])=>window.localStorage.setItem(k,v)',[minted['storage_key'],json.dumps(minted['session'])])
  await page.goto('http://localhost:8080/admin',wait_until='networkidle')
  await page.get_by_role('button',name='Users & roles',exact=True).click()
  await page.get_by_role('heading',name='User accounts',exact=True).wait_for()
  await page.get_by_label('Filter accounts on this page').fill('selfplanltd@gmail.com')
  own=page.locator('article').filter(has=page.get_by_text('selfplanltd@gmail.com',exact=True))
  await own.wait_for()
  assert await own.get_by_role('checkbox',name='Administrator access for selfplanltd@gmail.com',exact=True).is_checked()
  assert await own.get_by_role('checkbox',name='Administrator access for selfplanltd@gmail.com',exact=True).is_disabled()
  await page.get_by_role('heading',name='User accounts',exact=True).screenshot(path=str(OUT/'admin-heading.png'))
  print('PASS: designated administrator opens account management; self-demotion is disabled')

  buyer_context=await browser.new_context(viewport={'width':1280,'height':1800})
  buyer=await buyer_context.new_page()
  email='ip-buyer-check-'+str(int(time.time()))+'@example.com'
  password=secrets.token_urlsafe(24)
  await buyer.goto('http://localhost:8080/auth?mode=signup',wait_until='networkidle')
  await buyer.get_by_label('Full name',exact=True).fill('TEST Buyer Profile')
  await buyer.get_by_label('Account type',exact=True).select_option('buyer')
  await buyer.get_by_label('Email',exact=True).fill(email)
  await buyer.get_by_label('Password',exact=True).fill(password)
  await buyer.get_by_role('button',name='Create account',exact=True).click()
  await buyer.wait_for_url('**/dashboard')
  await buyer.goto('http://localhost:8080/profile',wait_until='networkidle')
  await buyer.get_by_label('Full name',exact=True).fill('TEST Buyer Updated')
  await buyer.get_by_role('button',name='Save profile',exact=True).click()
  await buyer.get_by_text('Profile saved.',exact=True).wait_for()
  await buyer.reload(wait_until='networkidle')
  assert await buyer.get_by_label('Full name',exact=True).input_value()=='TEST Buyer Updated'
  roles=await buyer.evaluate("""async ()=>{const {supabase:s}=await import('/src/integrations/supabase/client.ts');const {data:{user}}=await s.auth.getUser();return (await s.from('user_roles').select('role').eq('user_id',user.id)).data.map(r=>r.role)}""")
  assert roles==['buyer'],roles
  await buyer.screenshot(path=str(OUT/'buyer-profile.png'))
  print('PASS: buyer signup grants only buyer; editable profile saves and reads back')

  await page.get_by_label('Filter accounts on this page').fill(email)
  await page.get_by_role('button',name='KYC',exact=True).click()
  await page.get_by_role('button',name='Users & roles',exact=True).click()
  await page.get_by_label('Filter accounts on this page').fill(email)
  test_account=page.locator('article').filter(has=page.get_by_text(email,exact=True))
  await test_account.wait_for()
  seller=test_account.get_by_role('checkbox',name='Seller / rights holder access for '+email,exact=True)
  await seller.click()
  await seller.get_attribute("aria-checked")
  await page.get_by_text('Account access updated.',exact=True).wait_for()
  await buyer.reload(wait_until='networkidle')
  await buyer.get_by_role('heading',name='Seller / rights holder',exact=True).wait_for()
  print('PASS: administrator enables seller access; buyer profile shows the new privilege after reload')
  await seller.click()
  await seller.get_attribute("aria-checked")
  await buyer.reload(wait_until='networkidle')
  await buyer.get_by_role('heading',name='Buyer',exact=True).wait_for()
  assert await buyer.get_by_role('heading',name='Seller / rights holder',exact=True).count()==0
  print('PASS: administrator revokes seller access and profile reads back buyer-only privileges')
  denied=await buyer.evaluate("""async ()=>{try{const {listAccounts}=await import('/src/lib/accounts.functions.ts');await listAccounts({data:{page:1}});return false;}catch{return true;}}""")
  assert denied
  print('PASS: buyer is denied administrator account data')

  await page.get_by_role('button',name='KYC',exact=True).click()
  kyc=page.locator('section > div').filter(has=page.get_by_text('TEST — Verification Flow',exact=True)).first
  await kyc.get_by_role('button',name='ID document',exact=True).click()
  link=kyc.get_by_role('link',name='Open id document',exact=True)
  await link.wait_for()
  url=await link.get_attribute('href')
  response=await context.request.get(url)
  assert response.ok,response.status
  path=await page.evaluate("""async ()=>{const {supabase:s}=await import('/src/integrations/supabase/client.ts');const {data,error}=await s.from('kyc_submissions').select('id_document_url').eq('full_legal_name','TEST — Verification Flow').order('submitted_at',{ascending:false}).limit(1).single();if(error)throw Error('test evidence unavailable');return data.id_document_url;}""")
  await page.get_by_role('button',name='Listings',exact=True).click()
  await page.get_by_role('link').filter(has_text='TEST — Registration Flow').first.click()
  await page.get_by_role('button',name='test-document.png',exact=True).click()
  cert=page.get_by_role('link',name='Open test-document.png',exact=True)
  await cert.wait_for()
  cert_url=await cert.get_attribute('href')
  cert_response=await context.request.get(cert_url)
  assert cert_response.ok,cert_response.status
  cert_path=await page.evaluate("""async ()=>{const {supabase:s}=await import('/src/integrations/supabase/client.ts');const id=location.pathname.split('/').at(-1);const {data}=await s.from('ip_listings').select('documents').eq('id',id).single();return data.documents.find(d=>d.kind==='registration_certificate').path;}""")
  print('PASS: administrator opens synthetic identity scan and registration certificate through the review screens')
  denied_files=await buyer.evaluate("""async ([id,cert])=>{const {supabase:s}=await import('/src/integrations/supabase/client.ts');return Promise.all([['kyc-documents',id],['ip-documents',cert]].map(async ([bucket,path])=>{const r=await s.storage.from(bucket).createSignedUrl(path,300);return !!r.error;}));}""",[path,cert_path])
  assert all(denied_files)
  anon_context=await browser.new_context(viewport={'width':1280,'height':1800})
  anon=await anon_context.new_page()
  await anon.goto('http://localhost:8080',wait_until='networkidle')
  anon_denied=await anon.evaluate("""async ([id,cert])=>{const {supabase:s}=await import('/src/integrations/supabase/client.ts');return Promise.all([['kyc-documents',id],['ip-documents',cert]].map(async ([bucket,path])=>{const r=await s.storage.from(bucket).createSignedUrl(path,300);return !!r.error;}));}""",[path,cert_path])
  assert all(anon_denied)
  print('PASS: unrelated buyer and anonymous visitor cannot obtain links for either known private file')
  print('Observed administrator URL:',page.url)
  print('Browser runtime errors:',len(errors))
  assert not errors,errors
  await browser.close()

asyncio.run(main())
