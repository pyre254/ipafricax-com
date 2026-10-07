import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { analyzeCertificate, anchorCertificate } from "@/lib/certificates.functions";
import { toast } from "sonner";
import { FileSearch, Fingerprint, AlertTriangle, CheckCircle2, Link2 } from "lucide-react";

type Check = { id: string; extracted: Record<string, unknown>; mismatches: { field: string; listing_value: string | null; certificate_value: string | null; severity: string; note: string }[]; match_score: number | null; created_at: string };
type Proof = { id: string; sha256: string; record_hash: string; prev_record_hash: string | null; ots_proof: string | null; ots_calendar: string | null; file_name: string | null; created_at: string };

export function CertificateCheckPanel({ listingId, ownerId, onUploaded }: { listingId: string; ownerId: string; onUploaded?: () => void }) {
  const run = useServerFn(analyzeCertificate);
  const [check, setCheck] = useState<Check | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("certificate_checks").select("*").eq("listing_id", listingId).order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setCheck(data as unknown as Check | null));
  }, [listingId]);

  const submit = async () => {
    if (!file) return toast.error("Choose a certificate file first.");
    setBusy(true);
    try {
      const path = `${ownerId}/cert-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("ip-documents").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: l } = await supabase.from("ip_listings").select("documents").eq("id", listingId).single();
      const docs = Array.isArray(l?.documents) ? l.documents : [];
      await supabase.from("ip_listings").update({ documents: [...docs, { kind: "registration_certificate", path, name: file.name }] }).eq("id", listingId);
      onUploaded?.();
      const row = await run({ data: { listingId, path, mimeType: file.type || "application/pdf", fileName: file.name } });
      setCheck(row as unknown as Check);
      toast.success("Certificate checked.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check failed");
    } finally { setBusy(false); }
  };

  const ex = check?.extracted ?? {};
  const fields: [string, string][] = [["Title", "title"], ["IP type", "ip_type"], ["Registration no.", "registration_number"], ["Authority", "registration_authority"], ["Owner", "owner_name"], ["Jurisdiction", "jurisdiction"], ["Granted", "grant_date"], ["Expires", "expiry_date"]];

  return (
    <section className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 font-semibold"><FileSearch className="h-4 w-4 text-primary" /> AI certificate check</div>
      <p className="mt-1 text-sm text-muted-foreground">Upload your registration certificate (PDF or photo). AI reads it and flags anything that doesn't match this listing.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        <button disabled={busy} onClick={submit} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? "Reading certificate…" : "Upload & check"}
        </button>
      </div>

      {check && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Match score</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${check.match_score ?? 0}%` }} /></div>
            <span className="font-mono text-sm">{check.match_score ?? 0}/100</span>
          </div>
          {typeof ex.summary === "string" && <p className="text-sm">{ex.summary}</p>}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {fields.map(([label, k]) => (
              <div key={k}><dt className="text-xs text-muted-foreground">{label}</dt><dd>{(ex[k] as string) || "—"}</dd></div>
            ))}
          </dl>
          {check.mismatches.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" /> No mismatches found.</p>
          ) : (
            <ul className="space-y-2">
              {check.mismatches.map((m, i) => (
                <li key={i} className={`rounded-lg border p-3 text-sm ${m.severity === "high" ? "border-destructive/40 bg-destructive/5" : "border-accent/40 bg-accent/5"}`}>
                  <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> {m.field} <span className="text-xs uppercase text-muted-foreground">{m.severity}</span></div>
                  <p className="mt-1 text-muted-foreground">Listing: {m.listing_value ?? "—"} · Certificate: {m.certificate_value ?? "—"}</p>
                  <p className="mt-1">{m.note}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Checked {new Date(check.created_at).toLocaleString()}. AI results support, but don't replace, verifier review.</p>
        </div>
      )}
    </section>
  );
}

export function BlockchainProofPanel({ listingId, canAnchor }: { listingId: string; canAnchor: boolean }) {
  const anchor = useServerFn(anchorCertificate);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () => supabase.from("certificate_proofs").select("*").eq("listing_id", listingId).order("created_at", { ascending: false })
    .then(({ data }) => setProofs((data as Proof[]) ?? []));
  useEffect(() => { load(); }, [listingId]);

  const record = async () => {
    setBusy(true);
    try { await anchor({ data: { listingId } }); toast.success("Proof recorded."); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not record proof"); }
    finally { setBusy(false); }
  };

  if (!proofs.length && !canAnchor) return null;
  const download = (p: Proof) => {
    const bytes = Uint8Array.from(atob(p.ots_proof!), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
    const a = document.createElement("a"); a.href = url; a.download = `${p.sha256.slice(0, 12)}.ots`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <section className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold"><Fingerprint className="h-4 w-4 text-accent" /> Proof of certificate</div>
        {canAnchor && (
          <button disabled={busy} onClick={record} className="rounded-full border px-4 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50">
            {busy ? "Recording…" : "Record on blockchain"}
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">A tamper-evident fingerprint of the verified certificate, timestamped on the Bitcoin blockchain via OpenTimestamps. Legal ownership still rests with the registry (KIPI, ARIPO, OAPI).</p>
      {proofs.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No proof recorded yet.</p> : (
        <ul className="mt-4 space-y-3">
          {proofs.map((p) => (
            <li key={p.id} className="rounded-lg border p-3 text-sm">
              <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()} {p.file_name && `· ${p.file_name}`}</p>
              <p className="mt-1 break-all font-mono text-xs"><span className="text-muted-foreground">SHA-256 </span>{p.sha256}</p>
              <p className="mt-1 break-all font-mono text-xs"><span className="text-muted-foreground">Record </span>{p.record_hash}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                {p.ots_proof ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-primary"><CheckCircle2 className="h-3.5 w-3.5" /> Submitted to Bitcoin timestamp</span>
                    <button onClick={() => download(p)} className="underline">Download .ots proof</button>
                    <a href="https://opentimestamps.org" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline"><Link2 className="h-3 w-3" /> Verify</a>
                  </>
                ) : <span className="text-muted-foreground">Recorded in platform ledger (Bitcoin timestamp unavailable)</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
