
-- ENUMS
create type public.app_role as enum ('admin','rights_holder','buyer','verifier');
create type public.kyc_status as enum ('not_started','pending','approved','rejected');
create type public.verification_status as enum ('unverified','pending','verified','rejected');
create type public.ip_type as enum ('patent','trademark','industrial_design','copyright','utility_model','trade_secret');
create type public.listing_status as enum ('draft','pending_review','active','sold','withdrawn');
create type public.escrow_status as enum ('initiated','funded','in_progress','milestone_completed','released','disputed','refunded','cancelled');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  organization text,
  org_type text,
  country text,
  avatar_url text,
  bio text,
  kyc_status public.kyc_status not null default 'not_started',
  org_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- USER ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

-- has_role
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role);
$$;

-- Auto-create profile + default buyer role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, organization, org_type, country)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'organization',''),
    coalesce(new.raw_user_meta_data->>'org_type',''),
    coalesce(new.raw_user_meta_data->>'country','')
  );
  insert into public.user_roles (user_id, role) values (new.id, 'buyer') on conflict do nothing;
  if coalesce((new.raw_user_meta_data->>'is_rights_holder')::boolean, false) then
    insert into public.user_roles (user_id, role) values (new.id, 'rights_holder') on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- KYC SUBMISSIONS
create table public.kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  full_legal_name text not null,
  id_document_type text not null,
  id_document_number text not null,
  id_document_url text,
  selfie_url text,
  org_registration_number text,
  org_certificate_url text,
  status public.kyc_status not null default 'pending',
  reviewer_id uuid,
  reviewer_notes text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.kyc_submissions enable row level security;

-- IP LISTINGS
create table public.ip_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  ip_type public.ip_type not null,
  abstract text not null,
  description text,
  registration_number text,
  registration_authority text,
  jurisdictions text[] not null default '{}',
  industry_tags text[] not null default '{}',
  asking_price numeric,
  currency text not null default 'USD',
  license_types text[] not null default '{}',
  cover_image_url text,
  documents jsonb not null default '[]',
  verification_status public.verification_status not null default 'unverified',
  verification_notes text,
  verified_by uuid,
  verified_at timestamptz,
  status public.listing_status not null default 'draft',
  ai_valuation_low numeric,
  ai_valuation_high numeric,
  ai_readiness_score int,
  ai_summary text,
  ai_embedding jsonb,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ip_listings enable row level security;
create index ip_listings_owner_idx on public.ip_listings(owner_id);
create index ip_listings_status_idx on public.ip_listings(status);
create index ip_listings_type_idx on public.ip_listings(ip_type);

-- ESCROW
create table public.escrow_transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.ip_listings(id) on delete restrict,
  buyer_id uuid references auth.users(id) not null,
  seller_id uuid references auth.users(id) not null,
  amount numeric not null,
  currency text not null default 'USD',
  deal_type text not null,
  license_terms jsonb,
  status public.escrow_status not null default 'initiated',
  funded_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.escrow_transactions enable row level security;

create table public.escrow_milestones (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.escrow_transactions(id) on delete cascade not null,
  title text not null,
  description text,
  amount numeric not null,
  status text not null default 'pending',
  completed_at timestamptz,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.escrow_milestones enable row level security;

-- AUDIT LOGS
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

-- updated_at triggers
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger ip_listings_touch before update on public.ip_listings for each row execute function public.touch_updated_at();
create trigger escrow_touch before update on public.escrow_transactions for each row execute function public.touch_updated_at();

-- ===== RLS POLICIES =====

-- profiles: anyone signed-in can view; users can insert/update own
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Admins can update any profile"
  on public.profiles for update to authenticated using (public.has_role(auth.uid(),'admin'));

-- user_roles: users see own; admins manage
create policy "Users can view own roles"
  on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Admins manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- kyc_submissions
create policy "Users view own kyc"
  on public.kyc_submissions for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'verifier'));
create policy "Users insert own kyc"
  on public.kyc_submissions for insert to authenticated with check (user_id = auth.uid());
create policy "Users update own pending kyc"
  on public.kyc_submissions for update to authenticated
  using (user_id = auth.uid() and status = 'pending');
create policy "Admins/verifiers update kyc"
  on public.kyc_submissions for update to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'verifier'));

-- ip_listings: public can see active+verified; owner sees own; admins all
create policy "Active listings viewable by everyone"
  on public.ip_listings for select to anon, authenticated
  using (status = 'active');
create policy "Owners view own listings"
  on public.ip_listings for select to authenticated using (owner_id = auth.uid());
create policy "Admins/verifiers view all listings"
  on public.ip_listings for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'verifier'));
create policy "Rights holders create listings"
  on public.ip_listings for insert to authenticated
  with check (owner_id = auth.uid() and public.has_role(auth.uid(),'rights_holder'));
create policy "Owners update own listings"
  on public.ip_listings for update to authenticated using (owner_id = auth.uid());
create policy "Admins/verifiers update listings"
  on public.ip_listings for update to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'verifier'));
create policy "Owners delete own listings"
  on public.ip_listings for delete to authenticated using (owner_id = auth.uid());

-- escrow_transactions
create policy "Parties view escrow"
  on public.escrow_transactions for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Buyers create escrow"
  on public.escrow_transactions for insert to authenticated with check (buyer_id = auth.uid());
create policy "Parties update escrow"
  on public.escrow_transactions for update to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- escrow_milestones
create policy "Parties view milestones"
  on public.escrow_milestones for select to authenticated
  using (exists (
    select 1 from public.escrow_transactions t
    where t.id = transaction_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  ));
create policy "Parties manage milestones"
  on public.escrow_milestones for all to authenticated
  using (exists (
    select 1 from public.escrow_transactions t
    where t.id = transaction_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  ))
  with check (exists (
    select 1 from public.escrow_transactions t
    where t.id = transaction_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  ));

-- audit_logs: admins only
create policy "Admins view audit logs"
  on public.audit_logs for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy "Authenticated insert audit logs"
  on public.audit_logs for insert to authenticated with check (true);

-- ===== STORAGE BUCKETS =====
insert into storage.buckets (id, name, public) values
  ('ip-documents','ip-documents', false),
  ('kyc-documents','kyc-documents', false),
  ('listing-covers','listing-covers', true)
on conflict (id) do nothing;

-- KYC: only owner + admins/verifiers
create policy "Owners read own kyc files"
  on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents' and (auth.uid()::text = (storage.foldername(name))[1] or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'verifier')));
create policy "Owners upload own kyc files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and auth.uid()::text = (storage.foldername(name))[1]);

-- IP docs: only owner + admins/verifiers (or escrow counterparties later)
create policy "Owners read own ip docs"
  on storage.objects for select to authenticated
  using (bucket_id = 'ip-documents' and (auth.uid()::text = (storage.foldername(name))[1] or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'verifier')));
create policy "Owners upload own ip docs"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'ip-documents' and auth.uid()::text = (storage.foldername(name))[1]);

-- Listing covers: public read, owners upload
create policy "Public read listing covers"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'listing-covers');
create policy "Owners upload listing covers"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-covers' and auth.uid()::text = (storage.foldername(name))[1]);
