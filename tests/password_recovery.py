"""Password recovery E2E: disposable accounts only; no credentials or recovery links are logged."""
import asyncio
import json
import os
import secrets
import time
from pathlib import Path
from urllib.parse import urlencode, urlparse

import requests
from playwright.async_api import async_playwright


async def main():
    out = Path('/tmp/browser/password-recovery')
    out.mkdir(parents=True, exist_ok=True)
    base = os.environ['SUPABASE_URL'].rstrip('/')
    headers = {'apikey': os.environ['SUPABASE_SERVICE_ROLE_KEY'], 'Content-Type': 'application/json'}
    created = []

    def admin(path, payload):
        response = requests.post(base + '/auth/v1/admin/' + path, headers=headers, json=payload, timeout=30)
        assert response.ok, f'Test setup failed ({response.status_code})'
        return response.json()

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(viewport={'width': 1280, 'height': 1800})
            page = await context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            await page.goto('http://localhost:8080/auth?mode=signin', wait_until='networkidle')
            await page.get_by_role('link', name='Forgot password?', exact=True).click()
            await page.get_by_role('heading', name='Forgot password?', exact=True).wait_for()

            # Capture the request without sending test mail or using the provider's email quota.
            request_payloads = []
            async def intercept_recover(route):
                cors = {'Access-Control-Allow-Origin': 'http://localhost:8080',
                        'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS'}
                if route.request.method == 'OPTIONS':
                    await route.fulfill(status=204, headers=cors)
                    return
                request_payloads.append((route.request.url, json.loads(route.request.post_data)))
                await route.fulfill(status=200, headers=cors, content_type='application/json', body='{}')
            await page.route('**/auth/v1/recover*', intercept_recover)
            await page.get_by_label('Email address', exact=True).fill('test-password-recovery@example.com')
            await page.get_by_role('button', name='Send reset link', exact=True).click()
            await page.get_by_role('heading', name='Check your email', exact=True).wait_for()
            assert len(request_payloads) == 1
            assert request_payloads[0][1]['email'] == 'test-password-recovery@example.com'
            assert 'redirect_to=http%3A%2F%2Flocalhost%3A8080%2Freset-password' in request_payloads[0][0]
            await page.screenshot(path=str(out / 'request-confirmed.png'))
            print('PASS: forgot-password request uses the public reset page and a neutral confirmation (mail intercepted)')

            await page.goto('http://localhost:8080/reset-password', wait_until='networkidle')
            await page.get_by_role('heading', name='Reset link unavailable', exact=True).wait_for()
            await page.screenshot(path=str(out / 'missing-link.png'))
            await page.goto('http://localhost:8080/reset-password#error=access_denied&error_code=otp_expired&type=recovery', wait_until='networkidle')
            await page.get_by_role('heading', name='Reset link unavailable', exact=True).wait_for()
            print('PASS: missing and expired recovery links cannot change a password')

            for account_type in ['buyer', 'admin']:
                email = f'ip-reset-{account_type}-{int(time.time())}-{secrets.token_hex(3)}@example.com'
                old_password = secrets.token_urlsafe(28)
                new_password = secrets.token_urlsafe(28)
                setup = admin('users', {'email': email, 'password': old_password, 'email_confirm': True,
                                       'user_metadata': {'full_name': 'TEST Password Recovery', 'is_rights_holder': False}})
                user_id = setup.get('id') or setup['user']['id']
                created.append(user_id)
                if account_type == 'admin':
                    grant = requests.post(base + '/rest/v1/user_roles', headers=headers,
                                          json={'user_id': user_id, 'role': 'admin'}, timeout=30)
                    assert grant.ok, 'Cannot grant the disposable test administrator role'

                generated = admin('generate_link', {'type': 'recovery', 'email': email,
                                                    'options': {'redirectTo': 'http://localhost:8080/reset-password'}})
                # Exchange the generated test OTP directly; never expose its link or tokens in output.
                verified = requests.post(base + '/auth/v1/verify', headers=headers,
                                         json={'type': 'recovery', 'token_hash': generated['hashed_token']}, timeout=30)
                assert verified.ok, f'Test recovery verification failed ({verified.status_code})'
                session = verified.json()
                fragment = urlencode({'access_token': session['access_token'], 'refresh_token': session['refresh_token'],
                                      'token_type': 'bearer', 'expires_in': session['expires_in'], 'type': 'recovery'})
                account_context = await browser.new_context(viewport={'width': 1280, 'height': 1800})
                account_page = await account_context.new_page()
                account_page.on('pageerror', lambda error: errors.append(str(error)))
                await account_page.goto('http://localhost:8080/reset-password#' + fragment, wait_until='networkidle')
                await account_page.get_by_role('heading', name='Reset your password', exact=True).wait_for()
                await account_page.get_by_label('New password', exact=True).fill(new_password)
                await account_page.get_by_label('Confirm new password', exact=True).fill(new_password + 'x')
                await account_page.get_by_role('button', name='Update password', exact=True).click()
                await account_page.get_by_role('alert').filter(has_text='The passwords do not match.').wait_for()
                await account_page.get_by_label('Confirm new password', exact=True).fill(new_password)
                await account_page.get_by_role('button', name='Update password', exact=True).click()
                await account_page.get_by_role('heading', name='Password updated', exact=True).wait_for(timeout=30000)
                await account_page.screenshot(path=str(out / f'{account_type}-password-updated.png'))
                await account_page.get_by_role('link', name='Back to sign in', exact=True).click()
                await account_page.get_by_label('Email', exact=True).fill(email)
                await account_page.get_by_label('Password', exact=True).fill(new_password)
                await account_page.get_by_role('button', name='Sign in', exact=True).click()
                await account_page.wait_for_url('**/dashboard', timeout=30000)
                await account_page.goto('http://localhost:8080/reset-password', wait_until='networkidle')
                await account_page.get_by_role('heading', name='Reset link unavailable', exact=True).wait_for()
                roles = await account_page.evaluate("""async () => {
                    const {supabase:s} = await import('/src/integrations/supabase/client.ts');
                    const {data:{user}} = await s.auth.getUser();
                    const {data} = await s.from('user_roles').select('role').eq('user_id',user.id);
                    return data.map(row=>row.role);
                }""")
                assert 'buyer' in roles
                assert ('admin' in roles) == (account_type == 'admin')
                if account_type == 'admin':
                    await account_page.goto('http://localhost:8080/admin', wait_until='networkidle')
                    await account_page.get_by_role('heading', name="Confirm it's you", exact=True).wait_for()
                    # Do not screenshot the enrollment QR code or secret.
                    print('PASS: administrator password reset preserves roles and still requires authenticator setup')
                else:
                    print('PASS: buyer resets password, signs in with it, retains buyer-only privileges, and cannot reuse a plain reset page')
                await account_context.close()

            for path in ['/', '/marketplace', '/auth?mode=signup', '/forgot-password', '/reset-password']:
                await page.goto('http://localhost:8080' + path, wait_until='networkidle')
                home = page.get_by_role('link', name='Go to homepage', exact=True)
                await home.click()
                assert urlparse(page.url).path == '/'
            icon = await page.locator('link[rel="icon"]').get_attribute('href')
            assert (await context.request.get('http://localhost:8080' + icon)).ok
            print('PASS: homepage icons navigate home and the favicon is served')

            for width, height in [(375, 812), (685, 529)]:
                await page.set_viewport_size({'width': width, 'height': height})
                for path in ['/', '/auth?mode=signin', '/forgot-password', '/reset-password']:
                    await page.goto('http://localhost:8080' + path, wait_until='networkidle')
                    assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Horizontal overflow'
                    await page.get_by_role('link', name='Go to homepage', exact=True).wait_for()
                await page.goto('http://localhost:8080/forgot-password', wait_until='networkidle')
                await page.screenshot(path=str(out / f'recovery-{width}.png'))
            print('PASS: recovery pages and home icons fit small screens')
            assert not errors, 'Browser runtime errors detected'
            await browser.close()
    finally:
        for user_id in created:
            response = requests.delete(base + '/auth/v1/admin/users/' + user_id, headers=headers, timeout=30)
            assert response.ok, 'Disposable account cleanup failed'
        print('Disposable password-recovery accounts removed')


if __name__ == '__main__':
    asyncio.run(main())