import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { reviewCertificateCheck } from "@/lib/certificates.functions";
import { toast } from "sonner";
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, History, FileSearch } from "lucide-react";

type Mismatch = { field: string; listing_value: string | null; certificate_value: string | null; severity: string; note: string };
type FlagRow = {
  id: string; listing_id: string; match_score: number | null; review_status: string; created_at: string;
  mismatches: Mismatch[]; extracted: Record<string, unknown>; reviewer_notes: string | null;
  ip_listings: { title: string; registration_authority: string | null } | null;
};

export function CertificateFlagQueue() {
  const review = useServerFn(reviewCertificateCheck);
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("certificate_checks")
      .select("id,listing_id,match_score,review_status,created_at,mismatches,extracted,reviewer_notes,ip_listings(title,registration_authority)")
      .in("review_status", ["pending", "needs_info"]).order("created_at", { ascending: false });
    setRows(((data ?? []) as unknown as FlagRow[]).filter((r) => r.mismatches.length > 0));
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (r: FlagRow, decision: "accepted" | "rejected" | "needs_info") => {
    const n = (notes[r.id] ?? "").trim();
    if (n.length < 3) return toast.error("Add a short note explaining your decision.");
    setBusy(r.id);
    try { await review({ data: { checkId: r.id, decision, notes: n } }); toast.success("Decision recorded in the asset history."); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save decision"); }
    finally { setBusy(null); }
  };

  if (!rows.length) return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      <FileSearch className="h-8 w-8 mx-auto mb-3" />No AI-flagged certificates waiting for review.
    </div>
  );

  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const ex = r.extracted;
        const high = r.mismatches.filter((m) => m.severity === "high").length;
        return (
          <div key={r.id} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link to="/listings/$id" params={{ id: r.listing_id }} className="font-semibold hover:underline">{r.ip_listings?.title ?? "Listing"}</Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {String(ex.issuing_office ?? r.ip_listings?.registration_authority ?? "—")} · {String(ex.document_format ?? "certificate")} · language {String(ex.document_language ?? "?")}
                </p>
              </div>
              <div className="text-right text-xs">
                <p className="font-mono text-sm">{r.match_score ?? 0}/100</p>
                <p className={high ? "text-destructive" : "text-muted-foreground"}>{r.mismatches.length} flag{r.mismatches.length > 1 ? "s" : ""}{high ? ` · ${high} high` : ""}</p>
                {r.review_status === "needs_info" && <p className="text-accent-foreground">Waiting on owner</p>}
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {r.mismatches.map((m, i) => (
                <li key={i} className={`rounded-lg border p-3 text-sm ${m.severity === "high" ? "border-destructive/40 bg-destructive/5" : "border-accent/40 bg-accent/5"}`}>
                  <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> {m.field} <span className="text-xs uppercase text-muted-foreground">{m.severity}</span></div>
                  <p className="mt-1 text-muted-foreground">Listing: {m.listing_value ?? "—"} · Certificate: {m.certificate_value ?? "—"}</p>
                  <p className="mt-1">{m.note}</p>
                </li>
              ))}
            </ul>
            <textarea value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
              placeholder="Decision notes (e.g. checked against KIPI register, owner name matches after merger)…"
              className="mt-3 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={2} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy === r.id} onClick={() => decide(r, "accepted")} className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">Accept certificate</button>
              <button disabled={busy === r.id} onClick={() => decide(r, "needs_info")} className="rounded-full border px-4 py-1.5 text-xs font-medium disabled:opacity-50">Ask owner for info</button>
              <button disabled={busy === r.id} onClick={() => decide(r, "rejected")} className="rounded-full border border-destructive/40 bg-destructive/10 px-4 py-1.5 text-xs text-destructive disabled:opacity-50">Reject</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Log = { id: string; action: string; created_at: string; metadata: Record<string, unknown> | null };
const actionLabel: Record<string, string> = {
  "certificate.ai_checked": "AI certificate check",
  "certificate.review_accepted": "Reviewer accepted certificate",
  "certificate.review_rejected": "Reviewer rejected certificate",
  "certificate.review_needs_info": "Reviewer requested more information",
  "certificate.anchored": "Proof recorded on blockchain",
};

export function AssetHistoryPanel({ listingId, expiry }: { listingId: string; expiry?: string | null }) {
  const [logs, setLogs] = useState<Log[]>([]);
  useEffect(() => {
    supabase.from("audit_logs").select("id,action,created_at,metadata").eq("entity_type", "ip_listing").eq("entity_id", listingId)
      .order("created_at", { ascending: false }).limit(50).then(({ data }) => setLogs((data ?? []) as Log[]));
  }, [listingId]);
  const days = expiry ? Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000) : null;

  return (
    <section className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 font-semibold"><History className="h-4 w-4 text-primary" /> Asset history</div>
      {expiry && (
        <p className={`mt-3 flex items-center gap-2 text-sm ${days !== null && days <= 90 ? "text-destructive" : "text-muted-foreground"}`}>
          <CalendarClock className="h-4 w-4" /> Registration expires {new Date(expiry).toLocaleDateString()} {days !== null && (days >= 0 ? `(${days} days)` : "(expired)")}
        </p>
      )}
      {logs.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No history yet.</p> : (
        <ol className="mt-4 space-y-3 border-l pl-4">
          {logs.map((l) => (
            <li key={l.id} className="text-sm">
              <p className="font-medium">{actionLabel[l.action] ?? l.action}</p>
              <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}
                {typeof l.metadata?.match_score === "number" && ` · score ${l.metadata.match_score}`}</p>
              {typeof l.metadata?.notes === "string" && <p className="mt-1 rounded bg-muted p-2 text-xs">{l.metadata.notes}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

type Note = { id: string; kind: string; title: string; body: string | null; listing_id: string | null; read_at: string | null; created_at: string };

export function NotificationsPanel({ userId }: { userId: string }) {
  const [items, setItems] = useState<Note[]>([]);
  const load = useCallback(() => supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20)
    .then(({ data }) => setItems((data ?? []) as Note[])), [userId]);
  useEffect(() => { load(); }, [load]);
  const markRead = async (id: string) => { await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id); load(); };
  if (!items.length) return null;
  const unread = items.filter((i) => !i.read_at).length;

  return (
    <section className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4 text-primary" /> Notifications {unread > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{unread}</span>}</div>
      <ul className="mt-4 space-y-2">
        {items.map((n) => (
          <li key={n.id} className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${n.read_at ? "opacity-60" : ""}`}>
            <div className="flex gap-2">
              {n.kind === "renewal_reminder" ? <CalendarClock className="mt-0.5 h-4 w-4 text-destructive shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary shrink-0" />}
              <div>
                {n.listing_id ? <Link to="/listings/$id" params={{ id: n.listing_id }} className="font-medium hover:underline">{n.title}</Link> : <p className="font-medium">{n.title}</p>}
                {n.body && <p className="text-muted-foreground">{n.body}</p>}
                <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            </div>
            {!n.read_at && <button onClick={() => markRead(n.id)} className="text-xs underline shrink-0">Mark read</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
