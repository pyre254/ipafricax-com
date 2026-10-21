"""Live integration checks using a clearly labelled, isolated test account."""
import asyncio, secrets, time
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    Path('/tmp/browser/approval').mkdir(parents=True, exist_ok=True)
    stamp=str(int(time.time()))
    email=f'ip-exchange-check-{stamp}@example.com'
    password=secrets.token_urlsafe(24)
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True)
        page=await browser.new_page(viewport={'width':1280,'height':1800})
        await page.goto('http://localhost:8080/auth?mode=signup',wait_until='networkidle')
        await page.get_by_label('Full name',exact=True).fill('TEST — Verification Flow')
        await page.get_by_label('Email',exact=True).fill(email)
        await page.get_by_label('Password',exact=True).fill(password)
        await page.get_by_role('button',name='Create account',exact=True).click()
        await page.wait_for_url('**/dashboard',timeout=30000)
        print('PASS: registration creates a signed-in rights-holder account')
        await page.get_by_role('button',name='Sign out',exact=True).click()
        await page.wait_for_url('http://localhost:8080/',timeout=30000)
        await page.goto('http://localhost:8080/auth?mode=signin',wait_until='networkidle')
        await page.get_by_label('Email',exact=True).fill(email)
        await page.get_by_label('Password',exact=True).fill(password)
        await page.get_by_role('button',name='Sign in',exact=True).click()
        await page.wait_for_url('**/dashboard',timeout=30000)
        print('PASS: password sign-in')
        fixture=Path('/tmp/browser/approval/test-document.png')
        from PIL import Image, ImageDraw
        im=Image.new('RGB',(700,300),'white'); ImageDraw.Draw(im).text((20,20),'TEST DOCUMENT - NOT VALID FOR IDENTITY OR IP APPROVAL',fill='black'); im.save(fixture)
        await page.goto('http://localhost:8080/kyc',wait_until='networkidle')
        await page.get_by_label('Full legal name',exact=True).fill('TEST — Verification Flow')
        await page.get_by_label('ID number',exact=True).fill('TEST-NOT-A-REAL-ID')
        await page.get_by_label('ID document scan',exact=False).set_input_files(str(fixture))
        await page.get_by_role('button',name='Submit for review').click()
        await page.get_by_text('Under review',exact=True).wait_for()
        print('PASS: identity submission reads back as pending')
        await page.goto('http://localhost:8080/listings/new',wait_until='networkidle')
        await page.get_by_label('Title',exact=True).fill('TEST — Registration Flow '+stamp)
        await page.get_by_label('Abstract (public)',exact=True).fill('Synthetic test asset. This is not genuine intellectual property and must not be approved.')
        await page.get_by_label('Registration certificate (private)',exact=False).set_input_files(str(fixture))
        await page.get_by_role('button',name='Submit for verification',exact=True).click()
        await page.wait_for_url('**/listings/*',timeout=30000)
        listing_id=page.url.rsplit('/',1)[1]
        print('PASS: asset submission opens its pending detail page')
        result=await page.evaluate('''async (id)=>{const {supabase:s}=await import('/src/integrations/supabase/client.ts'); const {data:{user}}=await s.auth.getUser();
          const profile=await s.from('profiles').select('kyc_status').eq('id',user.id).single();
          const selfKyc=await s.from('profiles').update({kyc_status:'approved'}).eq('id',user.id);
          const selfListing=await s.from('ip_listings').update({verification_status:'verified',status:'active'}).eq('id',id);
          const rpc=await s.rpc('decide_listing',{p_id:id,p_status:'verified',p_notes:'test'});
          return {pending:profile.data?.kyc_status,profileDenied:!!selfKyc.error,listingDenied:!!selfListing.error,reviewDenied:!!rpc.error};}''',listing_id)
        assert result['pending']=='pending',result
        assert result['profileDenied'] and result['listingDenied'] and result['reviewDenied'],result
        print('PASS: profile synchronization and unauthorized self-approval denial')
        await page.goto('http://localhost:8080/admin',wait_until='networkidle')
        assert page.url.endswith('/dashboard'),page.url
        print('PASS: non-reviewer cannot access admin console')
        await page.goto('http://localhost:8080',wait_until='networkidle')
        assert 'IP Africa Exchange' in await page.locator('header').inner_text()
        await page.screenshot(path='/tmp/browser/approval/checked.png')
        print('PASS: new website name rendered')
        await browser.close()

if __name__=='__main__': asyncio.run(main())
