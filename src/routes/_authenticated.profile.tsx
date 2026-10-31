import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { accountRoles } from "@/lib/account-roles";
import { pageMeta } from "@/lib/page-meta";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/site-nav";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => pageMeta("Account profile", "Manage your buyer or seller profile and view your account privileges."),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, roles } = useAuth();
  const { data, isPending, error } = useQuery({ queryKey: ["account-profile", user?.id], enabled: Boolean(user), queryFn: async () => {
    if (!user) throw new Error("Sign in to view your profile");
    const { data, error } = await supabase.from("profiles").select("full_name,organization,org_type,country,bio,kyc_status,org_verified").eq("id", user.id).single();
    if (error) throw error;
    return data;
  } });
  return <main className="mx-auto max-w-5xl px-6 py-12">
    <p className="text-xs uppercase tracking-widest text-primary">Account</p><h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-semibold"><UserRound className="h-7 w-7" />Your profile</h1>
    {isPending && <p className="mt-6 text-muted-foreground">Loading profile…</p>}
    {error && <p role="alert" className="mt-6 text-destructive">Could not load your profile.</p>}
    {data && user && <div className="mt-8 grid gap-10 md:grid-cols-[1.5fr_1fr]">
      <ProfileForm key={user.id} initial={data} userId={user.id} email={user.email ?? ""} />
      <aside><h2 className="font-display text-xl font-semibold">Account access</h2><div className="mt-4 space-y-5">{accountRoles.filter((r) => roles.includes(r.value)).map((r) => <div key={r.value}><h3 className="font-semibold">{r.label}</h3><p className="mt-1 text-sm text-muted-foreground">{r.privileges}</p></div>)}</div><div className="mt-6 border-t border-border pt-5"><p className="mb-2 text-sm font-medium">Identity verification</p><StatusPill status={data.kyc_status} />{data.org_verified && <p className="mt-3 text-sm text-primary">Organization verified</p>}</div></aside>
    </div>}
  </main>;
}

type ProfileData = { full_name: string | null; organization: string | null; org_type: string | null; country: string | null; bio: string | null };
function ProfileForm({ initial, userId, email }: { initial: ProfileData; userId: string; email: string }) {
  const [form, setForm] = useState({ full_name: initial.full_name ?? "", organization: initial.organization ?? "", org_type: initial.org_type ?? "inventor", country: initial.country ?? "Kenya", bio: initial.bio ?? "" });
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  return <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try {
    const { error } = await supabase.from("profiles").update(form).eq("id", userId);
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["account-profile", userId] });
    toast.success("Profile saved.");
  } catch { toast.error("Could not save your profile."); } finally { setBusy(false); } }} className="space-y-5">
    <p className="break-all text-sm text-muted-foreground">{email}</p>
    {([['full_name', 'Full name'], ['organization', 'Organization'], ['country', 'Country']] as const).map(([key, label]) => <label key={key} className="block text-sm font-medium">{label}<input required={key === 'full_name'} maxLength={200} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-2 w-full rounded-lg border border-input bg-card px-3 py-2 font-normal" /></label>)}
    <label className="block text-sm font-medium">Organization type<select value={form.org_type} onChange={(e) => setForm({ ...form, org_type: e.target.value })} className="mt-2 w-full rounded-lg border border-input bg-card px-3 py-2 font-normal"><option value="inventor">Independent inventor</option><option value="startup">Startup</option><option value="university">University / TTO</option><option value="corporate">Corporate</option><option value="law_firm">Law firm / Agent</option></select></label>
    <label className="block text-sm font-medium">About you<textarea value={form.bio} maxLength={2000} rows={4} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="mt-2 w-full rounded-lg border border-input bg-card px-3 py-2 font-normal" /></label>
    <Button disabled={busy} type="submit"><Save />{busy ? "Saving…" : "Save profile"}</Button>
  </form>;
}