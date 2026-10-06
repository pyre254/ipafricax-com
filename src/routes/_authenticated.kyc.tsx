import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ShieldCheck, Upload, FileCheck2, Clock, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/kyc")({
  component: KycPage,
});

type Submission = {
  id: string; status: string; full_legal_name: string; id_document_type: string;
  id_document_number: string; reviewer_notes: string | null; submitted_at: string;
};

function KycPage() {
  const { user } = useAuth();
  const [existing, setExisting] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullLegalName: "",
    idType: "national_id",
    idNumber: "",
    orgRegNumber: "",
  });
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [orgCert, setOrgCert] = useState<File | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("kyc_submissions").select("*").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setExisting(data as Submission | null));
  }, [user]);

  const upload = async (file: File, kind: string) => {
    const path = `${user!.id}/${kind}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file);
    if (error) throw error;
    return path;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !idFile) {
      toast.error("Please upload your ID document.");
      return;
    }
    setLoading(true);
    try {
      const [idPath, selfiePath, orgPath] = await Promise.all([
        upload(idFile, "id"),
        selfie ? upload(selfie, "selfie") : Promise.resolve(null),
        orgCert ? upload(orgCert, "org") : Promise.resolve(null),
      ]);
      const { data: inserted, error } = await supabase.from("kyc_submissions").insert({
        user_id: user.id,
        full_legal_name: form.fullLegalName,
        id_document_type: form.idType,
        id_document_number: form.idNumber,
        id_document_url: idPath,
        selfie_url: selfiePath,
        org_registration_number: form.orgRegNumber || null,
        org_certificate_url: orgPath,
        status: "pending",
      }).select("*").single();
      if (error) throw error;
      setExisting(inserted as Submission);
      await supabase.from("profiles").update({ kyc_status: "pending" }).eq("id", user.id);
      await supabase.from("audit_logs").insert({
        actor_id: user.id, action: "kyc.submitted", entity_type: "kyc_submission", entity_id: user.id,
      });
      toast.success("KYC submitted for review.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-primary">Trust & Verification</p>
      <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold">KYC & Ownership Verification</h1>
      <p className="mt-2 text-muted-foreground">
        We verify your identity, organization, and registered IP rights with government registries (ARIPO/OAPI/national IPOs).
        Verified accounts get a badge and can transact via escrow.
      </p>

      {existing && <StatusCard sub={existing} />}

      {(!existing || existing.status === "rejected") && (
        <form onSubmit={submit} className="mt-8 space-y-5 rounded-2xl border-hairline bg-gradient-card p-6">
          <h2 className="font-semibold">Submit verification</h2>

          <Field label="Full legal name">
            <input required className="input" value={form.fullLegalName} onChange={(e) => setForm({ ...form, fullLegalName: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ID document type">
              <select className="input" value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })}>
                <option value="national_id">National ID</option>
                <option value="passport">Passport</option>
                <option value="drivers_license">Driver's licence</option>
              </select>
            </Field>
            <Field label="ID number">
              <input required className="input" value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
            </Field>
          </div>
          <FileField label="ID document scan" file={idFile} onChange={setIdFile} required />
          <FileField label="Selfie holding ID (optional)" file={selfie} onChange={setSelfie} />
          <Field label="Organization registration number (if applicable)">
            <input className="input" value={form.orgRegNumber} onChange={(e) => setForm({ ...form, orgRegNumber: e.target.value })} />
          </Field>
          <FileField label="Organization registration certificate (optional)" file={orgCert} onChange={setOrgCert} />

          <button disabled={loading} className="w-full rounded-full bg-gradient-gold py-3 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-50">
            {loading ? "Uploading…" : "Submit for review"}
          </button>
          <p className="text-xs text-muted-foreground">
            Documents are stored privately. Reviewed against ARIPO/OAPI/national registries by our verification team.
          </p>
        </form>
      )}

      <style>{`
        .input { width:100%; background:#fff; border: 1px solid var(--border); border-radius: 0.625rem; padding: 0.65rem 0.85rem; color: var(--color-foreground); font-size: 0.875rem; }
        .input:focus { outline: 2px solid var(--primary); outline-offset: 1px; border-color: var(--primary); }
      `}</style>
    </div>
  );
}

function StatusCard({ sub }: { sub: Submission }) {
  const map: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string; label: string }> = {
    pending: { icon: Clock, tone: "text-primary border-primary/30 bg-primary/10", label: "Under review" },
    approved: { icon: ShieldCheck, tone: "text-accent border-accent/30 bg-accent/10", label: "Verified" },
    rejected: { icon: XCircle, tone: "text-destructive border-destructive/30 bg-destructive/10", label: "Rejected" },
  };
  const s = map[sub.status] ?? map.pending;
  const Icon = s.icon;
  return (
    <div className={`mt-8 rounded-2xl border p-5 ${s.tone}`}>
      <div className="flex items-center gap-3">
        <Icon className="h-6 w-6" />
        <div>
          <p className="font-semibold">{s.label}</p>
          <p className="text-xs opacity-80">Submitted {new Date(sub.submitted_at).toLocaleDateString()}</p>
        </div>
      </div>
      {sub.reviewer_notes && <p className="mt-3 text-sm opacity-90">Reviewer notes: {sub.reviewer_notes}</p>}
      {sub.status === "approved" && (
        <p className="mt-3 text-sm flex items-center gap-2"><FileCheck2 className="h-4 w-4" /> Your account now displays a verification badge.</p>
      )}
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
function FileField({ label, file, onChange, required }: { label: string; file: File | null; onChange: (f: File | null) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 p-3 cursor-pointer hover:bg-card/60 transition">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <input type="file" required={required} onChange={(e) => onChange(e.target.files?.[0] ?? null)} className="text-xs flex-1" accept="image/*,application/pdf" />
        {file && <span className="text-xs text-accent truncate max-w-[200px]">{file.name}</span>}
      </div>
    </label>
  );
}
