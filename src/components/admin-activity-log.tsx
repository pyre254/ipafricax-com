import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_ACTIONS = [
  "account.role_granted", "account.role_removed",
  "kyc.approved", "kyc.rejected",
  "listing.verified", "listing.rejected",
  "certificate.review_accepted", "certificate.review_rejected", "certificate.review_needs_info",
];

const LABELS: Record<string, string> = {
  "account.role_granted": "Role granted", "account.role_removed": "Role removed",
  "kyc.approved": "Identity approved", "kyc.rejected": "Identity rejected",
  "listing.verified": "Certificate / asset approved", "listing.rejected": "Certificate / asset rejected",
  "certificate.review_accepted": "Certificate flag accepted", "certificate.review_rejected": "Certificate flag rejected",
  "certificate.review_needs_info": "More info requested",
};

type Row = { id: string; action: string; actor_id: string | null; entity_type: string; entity_id: string | null; metadata: Record<string, unknown> | null; created_at: string };

export function AdminActivityLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("audit_logs").select("id,action,actor_id,entity_type,entity_id,metadata,created_at")
        .in("action", ADMIN_ACTIONS).order("created_at", { ascending: false }).limit(200);
      const list = (data ?? []) as Row[];
      setRows(list);
      const ids = [...new Set(list.flatMap((r) => [r.actor_id, r.entity_type === "user_role" ? r.entity_id : null]).filter(Boolean))] as string[];
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id,full_name").in("id", ids);
        setNames(Object.fromEntries((p ?? []).map((x) => [x.id, x.full_name ?? "Unnamed"])));
      }
    })();
  }, []);

  const shown = rows.filter((r) => filter === "all" || r.action.startsWith(filter));
  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><History className="h-5 w-5 text-primary" />Admin activity</h2>
        <select aria-label="Filter activity" value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-input bg-card px-3 py-2 text-sm">
          <option value="all">All actions</option>
          <option value="account.">Role changes</option>
          <option value="kyc.">Identity decisions</option>
          <option value="listing.">Asset approvals</option>
          <option value="certificate.">Certificate flag reviews</option>
        </select>
      </div>
      <div className="rounded-2xl border-hairline bg-gradient-card divide-y divide-border/40">
        {!shown.length && <p className="p-6 text-center text-sm text-muted-foreground">No administrator actions recorded yet.</p>}
        {shown.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div>
              <span className="font-medium">{LABELS[r.action] ?? r.action}</span>
              {r.metadata?.role ? <span className="text-muted-foreground"> · {String(r.metadata.role).replace("_", " ")} for {names[r.entity_id ?? ""] ?? "account"}</span> : null}
              {r.metadata?.notes ? <p className="text-xs text-muted-foreground">“{String(r.metadata.notes)}”</p> : null}
              <p className="text-xs text-muted-foreground">By {names[r.actor_id ?? ""] ?? "system"}</p>
            </div>
            <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
