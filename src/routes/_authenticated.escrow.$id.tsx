import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, Banknote, CheckCircle2, Clock, Lock, Unlock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/escrow/$id")({
  component: EscrowDetail,
});

type Tx = {
  id: string; listing_id: string | null; buyer_id: string; seller_id: string;
  amount: number; currency: string; deal_type: string; status: string;
  funded_at: string | null; released_at: string | null; created_at: string;
};
type Milestone = { id: string; title: string; description: string | null; amount: number; status: string; completed_at: string | null; order_index: number };
type Log = { id: string; action: string; created_at: string; metadata: Record<string, unknown> };

function EscrowDetail() {
  const { id } = Route.useParams();
  const { user, hasRole } = useAuth();
  const [tx, setTx] = useState<Tx | null>(null);
  const [ms, setMs] = useState<Milestone[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);

  const load = useCallback(async () => {
    const { data: t } = await supabase.from("escrow_transactions").select("*").eq("id", id).maybeSingle();
    setTx(t as Tx | null);
    const { data: m } = await supabase.from("escrow_milestones").select("*").eq("transaction_id", id).order("order_index");
    setMs((m ?? []) as Milestone[]);
    if (hasRole("admin")) {
      const { data: l } = await supabase.from("audit_logs").select("id,action,created_at,metadata").eq("entity_id", id).order("created_at", { ascending: false }).limit(20);
      setLogs((l ?? []) as Log[]);
    }
  }, [id, hasRole]);

  useEffect(() => { load(); }, [load]);

  if (!tx || !user) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  const isBuyer = tx.buyer_id === user.id;
  const isSeller = tx.seller_id === user.id;

  const fund = async () => {
    const { error } = await supabase.from("escrow_transactions").update({
      status: "funded", funded_at: new Date().toISOString(),
    }).eq("id", tx.id);
    if (error) return toast.error(error.message);
    await supabase.from("audit_logs").insert({ actor_id: user.id, action: "escrow.funded", entity_type: "escrow_transaction", entity_id: tx.id, metadata: { amount: tx.amount } });
    toast.success(`Escrow funded · ${tx.currency} ${Number(tx.amount).toLocaleString()} held securely.`);
    load();
  };

  const completeMilestone = async (mid: string) => {
    const { error } = await supabase.from("escrow_milestones").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", mid);
    if (error) return toast.error(error.message);
    await supabase.from("audit_logs").insert({ actor_id: user.id, action: "milestone.completed", entity_type: "escrow_milestone", entity_id: mid, metadata: { transaction_id: tx.id } });

    const remaining = ms.filter((m) => m.id !== mid && m.status !== "completed").length;
    if (remaining === 0) {
      await supabase.from("escrow_transactions").update({ status: "released", released_at: new Date().toISOString() }).eq("id", tx.id);
      await supabase.from("audit_logs").insert({ actor_id: user.id, action: "escrow.released", entity_type: "escrow_transaction", entity_id: tx.id });
      toast.success("All milestones complete. Funds released to seller.");
    } else {
      await supabase.from("escrow_transactions").update({ status: "milestone_completed" }).eq("id", tx.id);
      toast.success("Milestone marked complete.");
    }
    load();
  };

  const dispute = async () => {
    const { error } = await supabase.from("escrow_transactions").update({ status: "disputed" }).eq("id", tx.id);
    if (error) return toast.error(error.message);
    await supabase.from("audit_logs").insert({ actor_id: user.id, action: "escrow.disputed", entity_type: "escrow_transaction", entity_id: tx.id });
    toast.success("Dispute opened. Admin notified.");
    load();
  };

  const refund = async () => {
    if (!confirm("Refund all remaining escrowed funds to the buyer? This cannot be undone.")) return;
    const remaining = ms.filter((m) => m.status !== "completed").reduce((s, m) => s + Number(m.amount), 0);
    const { error } = await supabase.from("escrow_transactions").update({ status: "refunded", released_at: new Date().toISOString() }).eq("id", tx.id);
    if (error) return toast.error(error.message);
    await supabase.from("audit_logs").insert({
      actor_id: user.id, action: "escrow.refunded", entity_type: "escrow_transaction", entity_id: tx.id,
      metadata: { refunded_amount: remaining, currency: tx.currency },
    });
    toast.success(`${tx.currency} ${remaining.toLocaleString()} refunded to buyer.`);
    load();
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="mt-6 rounded-3xl border-hairline bg-gradient-card p-8 shadow-elegant">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary">Escrow · {tx.deal_type}</p>
            <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold text-gradient-gold">
              {tx.currency} {Number(tx.amount).toLocaleString()}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Status: <span className="capitalize">{tx.status.replace(/_/g, " ")}</span></p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {tx.status === "initiated" && isBuyer && (
              <button onClick={fund} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-emerald">
                <Lock className="h-4 w-4" /> Fund escrow
              </button>
            )}
            {isSeller && (tx.status === "disputed" || tx.status === "funded" || tx.status === "milestone_completed") && (
              <button onClick={refund} className="rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent-foreground">Refund buyer</button>
            )}
            {(isBuyer || isSeller) && tx.status !== "released" && tx.status !== "disputed" && tx.status !== "refunded" && (
              <button onClick={dispute} className="rounded-full border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">Open dispute</button>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
          <Step active={["initiated", "funded", "in_progress", "milestone_completed", "released"].includes(tx.status)} label="Initiated" />
          <Step active={["funded", "in_progress", "milestone_completed", "released"].includes(tx.status)} label="Funded" />
          <Step active={tx.status === "released"} label="Released" />
        </div>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Milestones</h2>
        <p className="text-sm text-muted-foreground">Funds release as milestones complete. {isSeller ? "You'll receive each tranche when the buyer marks it complete." : "Approve milestones as deliverables are met."}</p>
        <div className="mt-4 space-y-3">
          {ms.map((m, i) => (
            <div key={m.id} className="flex items-start gap-4 rounded-2xl border-hairline bg-gradient-card p-5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${m.status === "completed" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                {m.status === "completed" ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              </div>
              <div className="flex-1">
                <p className="font-medium">Milestone {i + 1}: {m.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Releases {tx.currency} {Number(m.amount).toLocaleString()} · {m.status}</p>
              </div>
              {m.status !== "completed" && isBuyer && tx.status !== "initiated" && tx.status !== "disputed" && (
                <button onClick={() => completeMilestone(m.id)} className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary inline-flex items-center gap-1.5">
                  <Unlock className="h-3 w-3" /> Approve & release
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border-hairline bg-gradient-card p-6">
          <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-accent" /> Trust & safety</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>• Funds held by IPAfrica until milestones are met</li>
            <li>• Counterparties are KYC-verified</li>
            <li>• Disputes routed to qualified IP arbitrators</li>
            <li>• Every action recorded in audit log</li>
          </ul>
        </div>
        <div className="rounded-2xl border-hairline bg-gradient-card p-6">
          <div className="flex items-center gap-2 text-sm font-medium"><Banknote className="h-4 w-4 text-primary" /> Settlement</div>
          <p className="mt-3 text-sm text-muted-foreground">
            On full release, the seller receives {tx.currency} {Number(tx.amount).toLocaleString()} less platform fees.
            Multi-currency settlement supported across major African corridors.
          </p>
        </div>
      </div>

      {hasRole("admin") && logs.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold">Audit log (admin)</h2>
          <div className="mt-3 rounded-2xl border-hairline bg-gradient-card divide-y divide-border/40">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-3 text-sm">
                <span className="font-mono text-xs">{l.action}</span>
                <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Step({ active, label }: { active: boolean; label: string }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
      {label}
    </div>
  );
}
