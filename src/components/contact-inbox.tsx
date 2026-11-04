import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const statuses = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
] as const;

export function ContactInbox() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | (typeof statuses)[number]["value"]>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isPending, error } = useQuery({
    queryKey: ["contact-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_submissions").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const update = async (id: string, patch: { status?: string; admin_notes?: string }) => {
    setBusy(id);
    const { error } = await supabase.from("contact_submissions").update({ ...patch, handled_by: user?.id }).eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Saved.");
    await queryClient.invalidateQueries({ queryKey: ["contact-submissions"] });
  };
  const rows = (data ?? []).filter((r) => filter === "all" || r.status === filter);
  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {([["all", "All"], ...statuses.map((s) => [s.value, s.label])] as [typeof filter, string][]).map(([v, l]) => (
          <Button key={v} size="sm" variant={filter === v ? "default" : "outline"} onClick={() => setFilter(v)}>
            {l} ({(data ?? []).filter((r) => v === "all" || r.status === v).length})
          </Button>
        ))}
      </div>
      {isPending && <p className="text-sm text-muted-foreground">Loading messages…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
      {!isPending && !rows.length && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground"><Inbox className="mx-auto mb-3 h-8 w-8" />No messages here.</div>
      )}
      {rows.map((r) => (
        <article key={r.id} className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold">{r.name}</h3>
              <p className="break-all text-sm"><a className="text-primary hover:underline" href={`mailto:${r.email}`}>{r.email}</a>{r.phone && <> · <a className="hover:underline" href={`tel:${r.phone}`}>{r.phone}</a></>}</p>
              <p className="mt-1 text-xs text-muted-foreground">Received {new Date(r.created_at).toLocaleString()} · Updated {new Date(r.updated_at).toLocaleString()}</p>
            </div>
            <select aria-label={`Status for ${r.name}`} value={r.status} disabled={busy === r.id} onChange={(e) => void update(r.id, { status: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
              {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm">{r.message}</p>
          <textarea aria-label={`Team notes for ${r.name}`} placeholder="Team notes (visible to admins only)" defaultValue={r.admin_notes ?? ""} rows={2}
            onBlur={(e) => { if (e.target.value !== (r.admin_notes ?? "")) void update(r.id, { admin_notes: e.target.value }); }}
            className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </article>
      ))}
    </section>
  );
}
