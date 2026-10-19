import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Upload, Sparkles, ArrowLeft, Link as LinkIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

const IP_TYPES = ["patent", "trademark", "industrial_design", "copyright", "utility_model", "trade_secret"] as const;
const LICENSE_TYPES = ["exclusive", "non_exclusive", "territorial", "time_based", "royalty", "revenue_share", "lump_sum"];
const AUTHORITIES = ["ARIPO", "OAPI", "KIPI (Kenya)", "CIPC (South Africa)", "NIPO (Nigeria)", "USPTO", "EPO", "WIPO", "Other"];

export const Route = createFileRoute("/_authenticated/listings/new")({
  head: () => pageMeta('List an IP asset', 'Submit patents, trademarks and other IP assets for verification.'),
  component: NewListing,
});

function NewListing() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    ipType: "patent" as typeof IP_TYPES[number],
    abstract: "",
    description: "",
    registrationNumber: "",
    registrationAuthority: "ARIPO",
    jurisdictions: "Kenya, Nigeria, South Africa",
    industryTags: "",
    askingPrice: "",
    currency: "USD",
    licenseTypes: ["non_exclusive"] as string[],
  });
  const [cover, setCover] = useState<File | null>(null);
  const [certificate, setCertificate] = useState<File | null>(null);
  const [aiResult, setAiResult] = useState<{ valuation_low?: number; valuation_high?: number; readiness_score?: number; summary?: string } | null>(null);

  if (!user) return null;
  if (authLoading) {
    return <div className="mx-auto max-w-3xl px-6 py-24 text-center text-muted-foreground">Loading…</div>;
  }
  if (!hasRole("rights_holder")) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Rights-holder access required</h1>
        <p className="mt-2 text-muted-foreground">You need a rights-holder role to publish listings. Update your profile or contact support.</p>
      </div>
    );
  }

  const runAI = async () => {
    if (!form.abstract || form.abstract.length < 30) {
      toast.error("Add a longer abstract (30+ chars) for valuation.");
      return;
    }
    setAiBusy(true);
    try {
      const r = await fetch("/api/ai/value", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, ip_type: form.ipType, abstract: form.abstract,
          industry_tags: form.industryTags, jurisdictions: form.jurisdictions,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "AI failed");
      setAiResult(json);
      toast.success("AI valuation generated.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "AI valuation failed");
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let coverUrl: string | null = null;
      let certPath: string | null = null;

      if (cover) {
        const path = `${user.id}/${Date.now()}-${cover.name}`;
        const { error } = await supabase.storage.from("listing-covers").upload(path, cover);
        if (error) throw error;
        const { data } = supabase.storage.from("listing-covers").getPublicUrl(path);
        coverUrl = data.publicUrl;
      }
      if (certificate) {
        certPath = `${user.id}/cert-${Date.now()}-${certificate.name}`;
        const { error } = await supabase.storage.from("ip-documents").upload(certPath, certificate);
        if (error) throw error;
      }

      const documents = certPath ? [{ kind: "registration_certificate", path: certPath, name: certificate?.name }] : [];

      const { data: ins, error } = await supabase.from("ip_listings").insert({
        owner_id: user.id,
        title: form.title,
        ip_type: form.ipType,
        abstract: form.abstract,
        description: form.description,
        registration_number: form.registrationNumber || null,
        registration_authority: form.registrationAuthority,
        jurisdictions: form.jurisdictions.split(",").map((s) => s.trim()).filter(Boolean),
        industry_tags: form.industryTags.split(",").map((s) => s.trim()).filter(Boolean),
        asking_price: form.askingPrice ? Number(form.askingPrice) : null,
        currency: form.currency,
        license_types: form.licenseTypes,
        cover_image_url: coverUrl,
        documents,
        status: "pending_review",
        verification_status: "pending",
        ai_valuation_low: aiResult?.valuation_low ?? null,
        ai_valuation_high: aiResult?.valuation_high ?? null,
        ai_readiness_score: aiResult?.readiness_score ?? null,
        ai_summary: aiResult?.summary ?? null,
      }).select("id").single();
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        actor_id: user.id, action: "listing.created", entity_type: "ip_listing", entity_id: ins.id,
        metadata: { title: form.title, ip_type: form.ipType },
      });

      toast.success("Listing submitted for review.");
      navigate({ to: "/listings/$id", params: { id: ins.id } });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create listing");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <h1 className="mt-4 font-display text-3xl md:text-4xl font-semibold">List your IP asset</h1>
      <p className="mt-2 text-muted-foreground">Submit details and proof of ownership. Our verification team reviews before the listing goes live.</p>

      <form onSubmit={submit} className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4 rounded-2xl border-hairline bg-gradient-card p-6">
          <Field label="Title">
            <input required className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="IP type">
              <select className="input" value={form.ipType} onChange={(e) => setForm({ ...form, ipType: e.target.value as typeof IP_TYPES[number] })}>
                {IP_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
            </Field>
            <Field label="Registration authority">
              <select className="input" value={form.registrationAuthority} onChange={(e) => setForm({ ...form, registrationAuthority: e.target.value })}>
                {AUTHORITIES.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Abstract (public)">
            <textarea required rows={4} className="input" value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} />
          </Field>
          <Field label="Detailed description (visible after NDA)">
            <textarea rows={5} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Registration number">
              <input className="input" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} placeholder="e.g. AP/P/2023/01234" />
            </Field>
            <Field label="Jurisdictions (comma-separated)">
              <input className="input" value={form.jurisdictions} onChange={(e) => setForm({ ...form, jurisdictions: e.target.value })} />
            </Field>
          </div>
          <Field label="Industry tags (comma-separated)">
            <input className="input" placeholder="agritech, fintech, healthtech" value={form.industryTags} onChange={(e) => setForm({ ...form, industryTags: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Asking price">
              <input type="number" className="input" value={form.askingPrice} onChange={(e) => setForm({ ...form, askingPrice: e.target.value })} />
            </Field>
            <Field label="Currency">
              <select className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {["USD", "EUR", "ZAR", "KES", "NGN"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label=" ">
              <button type="button" onClick={runAI} disabled={aiBusy} className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-xs font-semibold text-accent disabled:opacity-50">
                <Sparkles className="h-4 w-4" /> {aiBusy ? "Valuing…" : "AI valuation"}
              </button>
            </Field>
          </div>

          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Available license types</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {LICENSE_TYPES.map((t) => {
                const active = form.licenseTypes.includes(t);
                return (
                  <button key={t} type="button"
                    onClick={() => setForm({ ...form, licenseTypes: active ? form.licenseTypes.filter((x) => x !== t) : [...form.licenseTypes, t] })}
                    className={`rounded-full border px-3 py-1 text-xs capitalize ${active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
                    {t.replace("_", " ")}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <FileField label="Cover image (public)" file={cover} onChange={setCover} accept="image/*" />
          <FileField label="Registration certificate (private)" file={certificate} onChange={setCertificate} accept="image/*,application/pdf" />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border-hairline bg-gradient-card p-6 sticky top-24">
            <p className="text-xs uppercase tracking-widest text-primary">AI insights</p>
            {aiResult ? (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Estimated value</p>
                  <p className="font-display text-xl font-semibold text-gradient-gold">
                    {form.currency} {Number(aiResult.valuation_low ?? 0).toLocaleString()} – {Number(aiResult.valuation_high ?? 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Commercial readiness</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-gradient-gold" style={{ width: `${aiResult.readiness_score ?? 0}%` }} />
                    </div>
                    <span className="text-xs font-mono">{aiResult.readiness_score ?? 0}/100</span>
                  </div>
                </div>
                {aiResult.summary && (
                  <div>
                    <p className="text-xs text-muted-foreground">AI summary</p>
                    <p className="text-sm mt-1 leading-relaxed">{aiResult.summary}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Click AI valuation to estimate value, readiness and generate a marketing summary.</p>
            )}
            <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground border-t border-border/40 pt-4">
              <LinkIcon className="h-3 w-3" /> Powered by Lovable AI
            </div>
          </div>
          <button disabled={loading} className="w-full rounded-full bg-gradient-gold py-3 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-50">
            {loading ? "Submitting…" : "Submit for verification"}
          </button>
        </aside>
      </form>

      <style>{`
        .input { width:100%; background:#fff; border: 1px solid var(--border); border-radius: 0.625rem; padding: 0.65rem 0.85rem; color: var(--color-foreground); font-size: 0.875rem; }
        .input:focus { outline: 2px solid var(--primary); outline-offset: 1px; border-color: var(--primary); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
function FileField({ label, file, onChange, accept }: { label: string; file: File | null; onChange: (f: File | null) => void; accept?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 p-3 cursor-pointer hover:bg-card/60 transition">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <input type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] ?? null)} className="text-xs flex-1" />
        {file && <span className="text-xs text-accent truncate max-w-[200px]">{file.name}</span>}
      </div>
    </label>
  );
}
