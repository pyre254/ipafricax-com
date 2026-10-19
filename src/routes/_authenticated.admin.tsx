import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CertificateFlagQueue } from "@/components/review-panels";
import { toast } from "sonner";
import { PrivateDocument } from "@/components/private-document";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Clock, FileSearch, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => pageMeta('Verification console', 'Review identity documents and intellectual property ownership.'),
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth", search: { mode: "signin" } });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
    if (!(roles ?? []).some((r) => r.role === "admin" || r.role === "verifier")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Admin,
});

type KycRow = {
  id: string; user_id: string; full_legal_name: string; id_document_type: string;
  id_document_number: string; status: string; submitted_at: string;
  org_registration_number: string | null; reviewer_notes: string | null;
  id_document_url: string | null; selfie_url: string | null; org_certificate_url: string | null;
};
type ListingRow = {
  id: string; title: string; ip_type: string; registration_number: string | null;
  registration_authority: string | null; verification_status: string; owner_id: string;
};

function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"kyc" | "listings" | "certs" | "audit">("kyc");
  const [kyc, setKyc] = useState<KycRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [audit, setAudit] = useState<{ id: string; action: string; entity_type: string; entity_id: string | null; created_at: string }[]>([]);

  const load = useCallback(async () => {
    const { data: k } = await supabase.from("kyc_submissions").select("*").eq("status", "pending").order("submitted_at", { ascending: false });
    setKyc((k ?? []) as KycRow[]);
    const { data: l } = await supabase.from("ip_listings").select("id,title,ip_type,registration_number,registration_authority,verification_status,owner_id").in("verification_status", ["pending", "unverified"]).order("created_at", { ascending: false });
    setListings((l ?? []) as ListingRow[]);
    const { data: a } = await supabase.from("audit_logs").select("id,action,entity_type,entity_id,created_at").order("created_at", { ascending: false }).limit(30);
    setAudit(a ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const reviewKyc = async (row: KycRow, status: "approved" | "rejected", notes?: string) => {
    if (!user || busy) return;
    setBusy(row.id);
    const { error } = await supabase.rpc("decide_kyc", { p_id: row.id, p_status: status, p_notes: notes ?? "Identity documents reviewed" });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`KYC ${status}.`);
    load();
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-primary">Verifier console</p>
      <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold">Trust & verification queue</h1>

      <div className="mt-6 inline-flex rounded-full border border-border p-1 text-sm">
        {([["kyc", "KYC"], ["listings", "Listings"], ["certs", "Certificate flags"], ["audit", "Audit log"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-full ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab === "kyc" && (
        <section className="mt-6 space-y-3">
          {kyc.length === 0 && <Empty icon={ShieldCheck} text="No pending KYC submissions." />}
          {kyc.map((row) => (
            <div key={row.id} className="rounded-2xl border-hairline bg-gradient-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{row.full_legal_name}</p>
                  <p className="text-xs text-muted-foreground">{row.id_document_type.toUpperCase()} · {row.id_document_number}</p>
                  {row.org_registration_number && <p className="text-xs text-muted-foreground mt-1">Org: {row.org_registration_number}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy !== null || row.user_id === user?.id} onClick={() => reviewKyc(row, "approved")}>Approve</Button>
                  <Button size="sm" variant="destructive" disabled={busy !== null || row.user_id === user?.id} onClick={() => reviewKyc(row, "rejected", "Documents could not be verified")}>Reject</Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Submitted {new Date(row.submitted_at).toLocaleString()}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <PrivateDocument bucket="kyc-documents" path={row.id_document_url} label="ID document" />
                <PrivateDocument bucket="kyc-documents" path={row.selfie_url} label="Selfie" />
                <PrivateDocument bucket="kyc-documents" path={row.org_certificate_url} label="Organization certificate" />
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === "listings" && (
        <section className="mt-6 space-y-3">
          {listings.length === 0 && <Empty icon={FileSearch} text="No listings awaiting verification." />}
          {listings.map((l) => (
            <Link key={l.id} to="/listings/$id" params={{ id: l.id }} className="flex items-center justify-between rounded-2xl border-hairline bg-gradient-card p-5 hover:shadow-glow transition">
              <div>
                <p className="text-xs uppercase tracking-widest text-primary">{l.ip_type.replace("_", " ")}</p>
                <p className="font-semibold mt-0.5">{l.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{l.registration_authority || "—"} · {l.registration_number || "no reg #"}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </section>
      )}

      {tab === "certs" && <section className="mt-6"><CertificateFlagQueue /></section>}

      {tab === "audit" && (
        <section className="mt-6 rounded-2xl border-hairline bg-gradient-card divide-y divide-border/40">
          {audit.map((a) => (
            <div key={a.id} className="flex items-center justify-between p-3 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-xs">{a.action}</span>
                <span className="text-xs text-muted-foreground">· {a.entity_type}</span>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      <Icon className="h-8 w-8 mx-auto mb-3" />
      {text}
    </div>
  );
}
