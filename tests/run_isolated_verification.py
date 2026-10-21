"""Run real migration/authorization regressions in a disposable local PostgreSQL database.

Requires PostgreSQL tools, never connects to the hosted backend. Test records and
reviewer grants are confined to a temporary database which is removed on exit.
"""
import os
import pwd
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

BOOTSTRAP = """
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(coalesce(current_setting('request.jwt.claim.sub',true),
 current_setting('request.jwt.claims',true)::jsonb->>'sub'),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
GRANT SELECT,INSERT ON storage.objects TO authenticated;
-- Reproduce the hosted backend's existing base-table grants for old migrations.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
"""

def main():
    with tempfile.TemporaryDirectory(prefix='ip-approval-',dir='/tmp') as directory:
        base=Path(directory)
        demote=None
        if os.getuid()==0:
            sandbox_user=pwd.getpwnam('lovable')
            os.chown(base,sandbox_user.pw_uid,sandbox_user.pw_gid)
            def demote():
                os.setgid(sandbox_user.pw_gid)
                os.setuid(sandbox_user.pw_uid)
        def run(args, **kwargs):
            return subprocess.run(args,check=True,text=True,**kwargs)
        run(['initdb','-D',str(base/'data'),'-A','trust','-U','postgres','--no-locale'],preexec_fn=demote,stdout=subprocess.DEVNULL)
        run(['pg_ctl','-D',str(base/'data'),'-l',str(base/'postgres.log'),'-o',f'-p 55439 -k {base} -h 127.0.0.1','-w','start'],preexec_fn=demote,stdout=subprocess.DEVNULL)
        connection=['psql','-h',str(base),'-p','55439','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
        try:
            run(connection,input=BOOTSTRAP,stdout=subprocess.DEVNULL)
            for migration in sorted((ROOT/'supabase/migrations').glob('*.sql'))+sorted((ROOT/'drizzle/migrations').glob('*.sql')):
                run(connection+['-f',str(migration)],stdout=subprocess.DEVNULL)
            run(connection+['-f',str(ROOT/'tests/isolated_verification.sql')],stdout=subprocess.DEVNULL)
        finally:
            run(['pg_ctl','-D',str(base/'data'),'-m','immediate','-w','stop'],preexec_fn=demote,stdout=subprocess.DEVNULL)

if __name__=='__main__': main()