import { useEffect, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type State = { kind: "loading" } | { kind: "ok" } | { kind: "enroll"; factorId: string; qr: string; secret: string } | { kind: "verify"; factorId: string };

/** Administrators must pass a second sign-in step (authenticator app) before using admin tools. */
export function AdminMfaGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const check = async () => {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") return setState({ kind: "ok" });
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.[0];
    if (verified) return setState({ kind: "verify", factorId: verified.id });
    for (const f of factors?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "IP Africa Exchange admin" });
    if (error || !data) { toast.error(error?.message ?? "Could not start setup"); return; }
    setState({ kind: "enroll", factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };
  useEffect(() => { check(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind !== "enroll" && state.kind !== "verify") return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: state.factorId, code: code.trim() });
    setBusy(false);
    if (error) return toast.error("That code didn't work. Try the latest one.");
    toast.success("Administrator access unlocked.");
    setState({ kind: "ok" });
  };

  if (state.kind === "ok") return <>{children}</>;
  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <ShieldCheck className="h-10 w-10 text-primary" />
      <h1 className="mt-4 font-display text-2xl font-semibold">Confirm it's you</h1>
      {state.kind === "loading" && <p className="mt-3 text-sm text-muted-foreground">Checking your security settings…</p>}
      {state.kind === "enroll" && <>
        <p className="mt-3 text-sm text-muted-foreground">Administrator accounts need an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…). Scan this code, then enter the 6-digit number it shows.</p>
        <img src={state.qr} alt="Authenticator setup code" className="mt-5 h-48 w-48 rounded-lg border border-border bg-card p-2" />
        <p className="mt-2 break-all text-xs text-muted-foreground">Or enter this key manually: <span className="font-mono">{state.secret}</span></p>
      </>}
      {state.kind === "verify" && <p className="mt-3 text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app to open the administrator tools.</p>}
      {state.kind !== "loading" && (
        <form onSubmit={submit} className="mt-5 flex gap-2">
          <input aria-label="Authentication code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} className="flex-1 rounded-lg border border-input bg-card px-3 py-2 font-mono tracking-widest" />
          <Button type="submit" disabled={busy || code.trim().length !== 6}>{busy ? "Checking…" : "Verify"}</Button>
        </form>
      )}
    </div>
  );
}
