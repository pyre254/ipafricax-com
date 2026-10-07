import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { CertificateCheckPanel, BlockchainProofPanel } from "@/components/certificate-panels";
import { ShieldCheck, Banknote, ArrowLeft, Building2, MapPin, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/listings/$id")({
  component: ListingDetail,
});

type Listing = {
  id: string; owner_id: string; title: string; ip_type: string; abstract: string;
  description: string | null; registration_number: string | null; registration_authority: string | null;
  jurisdictions: string[]; industry_tags: string[]; asking_price: number | null; currency: string;
  license_types: string[]; cover_image_url: string | null; verification_status: string;
  status: string; ai_valuation_low: number | null; ai_valuation_high: number | null;
  ai_readiness_score: number | null; ai_summary: string | null;
};
type Owner = { full_name: string; organization: string; org_verified: boolean };

function ListingDetail() {
  const { id } = Route.useParams();
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [offerAmount, setOfferAmount] = useState("");
  const [dealType, setDealType] = useState<"purchase" | "license">("license");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ip_listings").select("*").eq("id", id).maybeSingle();
      setListing(data as Listing | null);
      if (data) {
        const { data: o } = await supabase.from("profiles").select("full_name,organization,org_verified").eq("id", (data as Listing).owner_id).maybeSingle();
        setOwner(o as Owner | null);
      }
    })();
  }, [id]);

  if (!listing) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;

  const isOwner = user?.id === listing.owner_id;
  const isAdmin = hasRole("admin") || hasRole("verifier");

  const verify = async (status: "verified" | "rejected", notes?: string) => {
    const { error } = await supabase.from("ip_listings").update({
      verification_status: status,
      verification_notes: notes ?? null,
      verified_by: user!.id,
      verified_at: new Date().toISOString(),
      status: status === "verified" ? "active" : "withdrawn",
    }).eq("id", listing.id);
    if (error) return toast.error(error.message);
    await supabase.from("audit_logs").insert({
      actor_id: user!.id, action: `listing.${status}`, entity_type: "ip_listing", entity_id: listing.id, metadata: { notes },
    });
    toast.success(`Listing ${status}.`);
    const { data } = await supabase.from("ip_listings").select("*").eq("id", id).maybeSingle();
    setListing(data as Listing);
  };

  const initiateEscrow = async () => {
    if (!user) return;
    if (!offerAmount || Number(offerAmount) <= 0) return toast.error("Enter a valid offer amount.");
    setCreating(true);
    try {
      const { data: tx, error } = await supabase.from("escrow_transactions").insert({
        listing_id: listing.id, buyer_id: user.id, seller_id: listing.owner_id,
        amount: Number(offerAmount), currency: listing.currency, deal_type: dealType,
        status: "initiated",
      }).select("id").single();
      if (error) throw error;

      // default milestones
      const milestones = dealType === "license"
        ? [
            { title: "License agreement signed", amount: Number(offerAmount) * 0.5, order_index: 0 },
            { title: "Tech transfer / asset delivery", amount: Number(offerAmount) * 0.4, order_index: 1 },
            { title: "Final acceptance", amount: Number(offerAmount) * 0.1, order_index: 2 },
          ]
        : [
            { title: "Purchase agreement signed", amount: Number(offerAmount) * 0.3, order_index: 0 },
            { title: "Rights transfer registered", amount: Number(offerAmount) * 0.7, order_index: 1 },
          ];
      await supabase.from("escrow_milestones").insert(milestones.map((m) => ({ ...m, transaction_id: tx.id, status: "pending" })));
      await supabase.from("audit_logs").insert({
        actor_id: user.id, action: "escrow.initiated", entity_type: "escrow_transaction", entity_id: tx.id,
        metadata: { listing_id: listing.id, amount: offerAmount, deal_type: dealType },
      });
      toast.success("Escrow initiated.");
      navigate({ to: "/escrow/$id", params: { id: tx.id } });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate escrow");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to marketplace
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          {listing.cover_image_url && (
            <img src={listing.cover_image_url} alt={listing.title} className="rounded-2xl border-hairline w-full max-h-80 object-cover" loading="lazy" />
          )}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-primary">{listing.ip_type.replace("_", " ")}</span>
            {listing.verification_status === "verified" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                <ShieldCheck className="h-3 w-3" /> Registry verified
              </span>
            )}
            <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize">{listing.status.replace("_", " ")}</span>
          </div>
          <h1 className="mt-2 font-display text-3xl md:text-5xl font-semibold leading-tight">{listing.title}</h1>
          <p className="mt-4 text-muted-foreground leading-relaxed">{listing.abstract}</p>

          <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
            <Info label="Registration #" value={listing.registration_number || "—"} />
            <Info label="Authority" value={listing.registration_authority || "—"} />
            <Info label="Jurisdictions" value={listing.jurisdictions.join(", ") || "—"} icon={MapPin} />
            <Info label="Industry tags" value={listing.industry_tags.join(", ") || "—"} />
          </div>

          {listing.description && (
            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold">Description</h2>
              <p className="mt-2 text-muted-foreground whitespace-pre-wrap leading-relaxed">{listing.description}</p>
            </section>
          )}

          {(listing.ai_summary || listing.ai_readiness_score) && (
            <section className="mt-10 rounded-2xl border-hairline bg-gradient-card p-6">
              <div className="flex items-center gap-2 text-sm text-accent">
                <Sparkles className="h-4 w-4" /> AI insights
              </div>
              {listing.ai_summary && <p className="mt-3 text-sm">{listing.ai_summary}</p>}
              {listing.ai_readiness_score !== null && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Commercial readiness</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-gradient-gold" style={{ width: `${listing.ai_readiness_score}%` }} />
                    </div>
                    <span className="text-xs font-mono">{listing.ai_readiness_score}/100</span>
                  </div>
                </div>
              )}
            </section>
          )}

          {isOwner && <CertificateCheckPanel listingId={listing.id} ownerId={listing.owner_id} />}
          <BlockchainProofPanel listingId={listing.id} canAnchor={listing.verification_status === "verified" && (isOwner || isAdmin)} />

          {isAdmin && listing.verification_status !== "verified" && (
            <section className="mt-10 rounded-2xl border border-primary/30 bg-primary/10 p-6">
              <h2 className="font-semibold">Verifier actions</h2>
              <p className="text-sm text-muted-foreground mt-1">Verify this listing after confirming ownership against the registry.</p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => verify("verified")} className="rounded-full bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground">Approve & publish</button>
                <button onClick={() => verify("rejected", "Could not confirm registry record")} className="rounded-full border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">Reject</button>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border-hairline bg-gradient-card p-6 sticky top-24">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Asking price</p>
            <p className="mt-1 font-display text-3xl font-semibold text-gradient-gold">
              {listing.asking_price ? `${listing.currency} ${Number(listing.asking_price).toLocaleString()}` : "Price on application"}
            </p>
            {listing.ai_valuation_low && (
              <p className="mt-1 text-xs text-muted-foreground">
                AI estimate: {listing.currency} {Number(listing.ai_valuation_low).toLocaleString()} – {Number(listing.ai_valuation_high ?? 0).toLocaleString()}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-1.5">
              {listing.license_types.map((t) => (
                <span key={t} className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary capitalize">{t.replace("_", " ")}</span>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-card/50 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-trust"><Building2 className="h-4 w-4 text-accent-foreground" /></div>
              <div className="text-sm flex-1">
                <p className="font-medium">{owner?.full_name || "Rights-holder"}</p>
                <p className="text-xs text-muted-foreground truncate">{owner?.organization || "—"} {owner?.org_verified && "· Verified"}</p>
              </div>
            </div>

            {!isOwner && user && (
              <div className="mt-6 space-y-3 border-t border-border/40 pt-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Make an offer via escrow</p>
                <div className="flex gap-1 rounded-full border border-border p-1 text-xs">
                  {(["license", "purchase"] as const).map((t) => (
                    <button key={t} onClick={() => setDealType(t)} className={`flex-1 py-1.5 rounded-full capitalize ${dealType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
                  ))}
                </div>
                <input
                  type="number"
                  placeholder={`Offer in ${listing.currency}`}
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={initiateEscrow}
                  disabled={creating || listing.status !== "active"}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-50"
                >
                  <Banknote className="h-4 w-4" />
                  {listing.status !== "active" ? "Awaiting verification" : creating ? "Creating…" : "Initiate escrow"}
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">{Icon && <Icon className="h-3 w-3" />}{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
