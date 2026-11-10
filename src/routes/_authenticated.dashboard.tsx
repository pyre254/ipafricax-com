import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { NotificationsPanel } from "@/components/review-panels";
import { ShieldCheck, Plus, Banknote, FileCheck2, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { accountRoles } from "@/lib/account-roles";
import { Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { portfolioOptions, SubscriptionPortfolio } from "@/components/subscription-portfolio";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageMeta('Your portfolio', 'Manage your IP assets, verification and deals.'),
  component: Dashboard,
});

type Profile = { full_name: string; organization: string; kyc_status: string };
type Listing = { id: string; title: string; ip_type: string; status: string; verification_status: string; asking_price: number | null; currency: string };
type Escrow = { id: string; amount: number; currency: string; status: string; deal_type: string; listing_id: string | null };

function Dashboard() {
  const { user, roles, hasRole } = useAuth();
  const queryClient=useQueryClient();
  const visibility=queryClient.getQueryData(portfolioOptions(false).queryKey);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [escrows, setEscrows] = useState<Escrow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: l }, { data: e }] = await Promise.all([
        supabase.from("profiles").select("full_name,organization,kyc_status").eq("id", user.id).maybeSingle(),
        supabase.from("ip_listings").select("id,title,ip_type,status,verification_status,asking_price,currency").eq("owner_id", user.id).order("created_at", { ascending: false }),
        supabase.from("escrow_transactions").select("id,amount,currency,status,deal_type,listing_id").or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order("created_at", { ascending: false }),
      ]);
      setProfile(p as Profile | null);
      setListings((l ?? []) as Listing[]);
      setEscrows((e ?? []) as Escrow[]);
    })();
  }, [user]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">Dashboard</p>
          <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold">
            Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {profile?.organization || "Your portfolio"} · {accountRoles.filter((r) => roles.includes(r.value)).map((r) => r.label).join(", ") || "Loading access…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/profile">Your profile</Link></Button>
          {(hasRole("admin") || hasRole("verifier")) && <Button asChild variant="outline"><Link to="/admin">Review submissions</Link></Button>}
          <Link to="/marketplace" className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm hover:bg-card">
            Browse marketplace <ArrowRight className="h-4 w-4" />
          </Link>
          {hasRole("rights_holder") && (
            <Link to="/listings/new" className="inline-flex items-center gap-2 rounded-full bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground shadow-gold">
              <Plus className="h-4 w-4" /> New listing
            </Link>
          )}
        </div>
      </div>

      {profile && profile.kyc_status !== "approved" && (
        <Link to="/kyc" className="mt-8 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm hover:bg-primary/15 transition">
          <AlertCircle className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Complete KYC verification</p>
            <p className="text-muted-foreground text-xs">Status: {profile.kyc_status.replace("_", " ")} — verified accounts unlock listing publication and escrow.</p>
          </div>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      {user && <NotificationsPanel userId={user.id} />}
      <section className="mt-10"><Suspense fallback={<p className="text-sm text-muted-foreground">Loading listing visibility…</p>}><SubscriptionPortfolio /></Suspense></section>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <Stat icon={FileCheck2} label="Active listings" value={(visibility?.totals.active??0).toString()} />
        <Stat icon={ShieldCheck} label="Verified IP" value={listings.filter((l) => l.verification_status === "verified").length.toString()} />
        <Stat icon={Banknote} label="Escrow deals" value={escrows.length.toString()} />
      </div>

      <Section title="Your listings" empty="No listings yet. Create your first to start receiving offers.">
        {listings.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {listings.map((l) => (
              <Link key={l.id} to="/listings/$id" params={{ id: l.id }} className="group rounded-2xl border-hairline bg-gradient-card p-5 hover:shadow-glow transition">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-primary">{l.ip_type.replace("_", " ")}</p>
                    <h3 className="mt-1 font-semibold leading-tight">{l.title}</h3>
                  </div>
                  <Badge>{l.status}</Badge>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Verification: {l.verification_status}</span>
                  <span className="font-mono">{l.asking_price ? `${l.currency} ${Number(l.asking_price).toLocaleString()}` : "POA"}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Escrow & deals" empty="No escrow transactions yet.">
        {escrows.length > 0 && (
          <div className="space-y-2">
            {escrows.map((e) => (
              <Link key={e.id} to="/escrow/$id" params={{ id: e.id }} className="flex items-center justify-between gap-4 rounded-xl border-hairline bg-gradient-card p-4 hover:shadow-glow transition">
                <div>
                  <p className="font-medium text-sm capitalize">{e.deal_type} · {e.currency} {Number(e.amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Status: {e.status.replace(/_/g, " ")}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl border-hairline bg-gradient-card p-6 shadow-elegant">
      <Icon className="h-6 w-6 text-primary" />
      <p className="mt-4 font-display text-3xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
function Section({ title, empty, children }: { title: string; empty: string; children?: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-xl font-semibold mb-4">{title}</h2>
      {children ?? <div className="rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground text-center">{empty}</div>}
    </section>
  );
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-border bg-card/70 px-2 py-0.5 text-xs capitalize">{children}</span>;
}
