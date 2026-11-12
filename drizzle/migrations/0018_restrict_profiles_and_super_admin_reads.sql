DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles visible to self, reviewers, listing viewers and deal parties" ON public.profiles FOR SELECT TO authenticated USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'verifier'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.ip_listings l WHERE l.owner_id = profiles.id AND l.status = 'active')
  OR EXISTS (SELECT 1 FROM public.escrow_transactions e WHERE (e.buyer_id = auth.uid() AND e.seller_id = profiles.id) OR (e.seller_id = auth.uid() AND e.buyer_id = profiles.id))
);
DROP POLICY IF EXISTS "Signed-in users see the super admin" ON public.super_admin;
CREATE POLICY "Admins and the super admin see the super admin" ON public.super_admin FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)
);