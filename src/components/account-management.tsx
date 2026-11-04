import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { accountRoles, type AccountRole } from "@/lib/account-roles";
import { listAccounts, changeAccountRole, inviteAccount } from "@/lib/accounts.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function AccountManagement() {
  const { user, refreshRoles } = useAuth();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const fetchAccounts = useServerFn(listAccounts);
  const saveRole = useServerFn(changeAccountRole);
  const { data: superAdminId } = useQuery({ queryKey: ["super-admin"], queryFn: async () => (await supabase.from("super_admin").select("user_id").maybeSingle()).data?.user_id ?? null });
  const isSuper = Boolean(user && superAdminId === user.id);
  const { data, isPending, error } = useQuery({ queryKey: ["admin-accounts", page], queryFn: () => fetchAccounts({ data: { page } }) });
  const changeRole = async (userId: string, role: AccountRole, enabled: boolean) => {
    setBusy(userId);
    try {
      await saveRole({ data: { userId, role, enabled } });
      await queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
      if (userId === user?.id) await refreshRoles();
      toast.success("Account access updated.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update access."); }
    finally { setBusy(null); }
  };
  const visible = data?.accounts.filter((a) => `${a.email} ${a.profile?.full_name ?? ""} ${a.profile?.organization ?? ""}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <section className="mt-6 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Users className="h-5 w-5 text-primary" />User accounts</h2>
      <input aria-label="Filter accounts on this page" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm sm:w-72" />
    </div>
    {isSuper ? <InviteForm onDone={() => queryClient.invalidateQueries({ queryKey: ["admin-accounts"] })} /> : <p className="text-sm text-muted-foreground">Only the super administrator can invite people or give administrator access.</p>}
    {isPending && <p className="text-sm text-muted-foreground">Loading accounts…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
    {!isPending && !error && !visible.length && <p className="text-sm text-muted-foreground">No matching accounts.</p>}
    <div className="space-y-3">{visible.map((a) => <article key={a.id} className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="font-semibold">{a.profile?.full_name || "Unnamed account"}</h3><p className="break-all text-sm text-muted-foreground">{a.email}</p><p className="mt-1 text-xs text-muted-foreground">{a.profile?.organization || "Independent"} · {a.profile?.country || "—"}</p></div>
        <p className="text-xs text-muted-foreground">Email: {a.confirmed ? "confirmed" : "unconfirmed"} · Identity: {a.profile?.kyc_status.replaceAll("_", " ") ?? "not started"}</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{accountRoles.map((r) => <label key={r.value} className="flex items-start gap-2 text-sm">
        <Checkbox aria-label={`${r.label} access for ${a.email}`} checked={a.roles.includes(r.value)} disabled={busy !== null || (r.value === "admin" && (!isSuper || a.id === user?.id || a.id === superAdminId))} onCheckedChange={(checked) => void changeRole(a.id, r.value, checked === true)} />
        <span>{r.label}{r.value === "admin" && a.id === superAdminId ? " (super admin)" : ""}</span>
      </label>)}</div>
    </article>)}</div>
    <div className="flex items-center justify-end gap-3"><Button variant="outline" size="icon" aria-label="Previous accounts" disabled={page === 1 || isPending} onClick={() => setPage(page - 1)}><ChevronLeft /></Button><span className="text-sm">Page {page}</span><Button variant="outline" size="icon" aria-label="Next accounts" disabled={!data?.hasMore || isPending} onClick={() => setPage(page + 1)}><ChevronRight /></Button></div>
    <dl className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">{accountRoles.map((r) => <div key={r.value}><dt className="text-sm font-semibold">{r.label}</dt><dd className="mt-1 text-sm text-muted-foreground">{r.privileges}</dd></div>)}</dl>
  </section>;
}
function InviteForm({ onDone }: { onDone: () => void }) {
  const invite = useServerFn(inviteAccount);
  const [email, setEmail] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(true);
  const [sending, setSending] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await invite({ data: { email, makeAdmin, redirectTo: window.location.origin } });
      toast.success(`Invitation sent to ${email}.`);
      setEmail("");
      onDone();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not send the invitation."); }
    finally { setSending(false); }
  };
  return <form onSubmit={submit} className="rounded-lg border border-border bg-card p-5">
    <h3 className="font-semibold">Invite someone</h3>
    <p className="mt-1 text-sm text-muted-foreground">They get an email link to choose their password. Administrators must also set up an authenticator app.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <input type="email" required aria-label="Email to invite" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm sm:w-72" />
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={makeAdmin} onCheckedChange={(c) => setMakeAdmin(c === true)} />Give administrator access</label>
      <Button type="submit" disabled={sending}>{sending ? "Sending…" : "Send invitation"}</Button>
    </div>
  </form>;
}
