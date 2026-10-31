import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, KeyRound, Link2Off, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { pageMeta } from "@/lib/page-meta";
import { validateResetPassword } from "@/lib/password-recovery";
import { AccountPage } from "@/components/account-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => pageMeta("Reset password", "Set a new password using your secure IP Africa Exchange recovery link."),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { passwordRecovery, loading, setRecoveryUserId } = useAuth();
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "success">("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const finishing = useRef(false);

  useEffect(() => {
    if (loading || finishing.current) return;
    if (!passwordRecovery) { setState("invalid"); return; }
    let active = true;
    const check = async () => {
      const { data, error: sessionError } = await supabase.auth.getUser();
      if (!active || finishing.current) return;
      if (sessionError || !data.user) { setState("invalid"); return; }
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      let verifiedFactor: string | null = null;
      if (assurance?.currentLevel !== "aal2") {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;
        verifiedFactor = factors?.totp.find((factor) => factor.status === "verified")?.id ?? null;
        if (!verifiedFactor && assurance?.nextLevel === "aal2") throw new Error("Your account needs another verification method. Please use your usual sign-in method.");
      }
      if (!active || finishing.current) return;
      setFactorId(verifiedFactor);
      setState("ready");
    };
    void check().catch(() => { if (active && !finishing.current) setState("invalid"); });
    return () => { active = false; };
  }, [loading, passwordRecovery]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || state !== "ready" || !passwordRecovery) return;
    const validationError = validateResetPassword(password, confirmation);
    if (validationError) { setError(validationError); return; }
    finishing.current = true;
    setBusy(true);
    setError("");
    try {
      const { data, error: sessionError } = await supabase.auth.getUser();
      if (sessionError || !data.user) { setState("invalid"); return; }
      if (factorId) {
        if (!/^\d{6}$/.test(code.trim())) { setError("Enter the 6-digit code from your authenticator app."); return; }
        const { error: verificationError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
        if (verificationError) { setError("That authenticator code didn't work. Try the latest code."); return; }
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword("");
      setConfirmation("");
      setState("success");
      setRecoveryUserId(null);
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) setError("Your password was updated, but we couldn't sign you out. Please sign out before signing in again.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We couldn't update your password. Please try again.");
    } finally {
      finishing.current = false;
      setBusy(false);
    }
  };

  return (
    <AccountPage>
      {state === "checking" && (
        <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
          <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Checking your reset link…
        </div>
      )}
      {state === "invalid" && (
        <>
          <Link2Off className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-5 text-3xl font-semibold">Reset link unavailable</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">This link is missing, expired, or already used. Request a new link to reset your password.</p>
          <Button asChild className="mt-6 h-11 w-full"><Link to="/forgot-password">Request a new link</Link></Button>
        </>
      )}
      {state === "ready" && (
        <>
          <KeyRound className="h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="mt-5 text-3xl font-semibold">Reset your password</h1>
          <p className="mt-3 text-sm text-muted-foreground">Choose a new password with at least 8 characters.</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="new-password" className="text-sm font-medium">New password</label>
              <Input id="new-password" type="password" autoComplete="new-password" required minLength={8} value={password}
                onChange={(event) => setPassword(event.target.value)} disabled={busy} className="mt-2 h-11 bg-card" />
            </div>
            <div>
              <label htmlFor="confirm-password" className="text-sm font-medium">Confirm new password</label>
              <Input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)} disabled={busy} className="mt-2 h-11 bg-card" />
            </div>
            {factorId && (
              <div>
                <label htmlFor="recovery-code" className="text-sm font-medium">Authentication code</label>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Your account is protected by an authenticator app. Enter its current 6-digit code.</p>
                <Input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6}
                  value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  disabled={busy} className="mt-2 h-11 bg-card font-mono" />
              </div>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy} className="h-11 w-full">{busy ? "Updating…" : "Update password"}</Button>
          </form>
        </>
      )}
      {state === "success" && (
        <div role="status">
          <CheckCircle2 className="h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="mt-5 text-3xl font-semibold">Password updated</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Sign in with your new password. Administrator accounts still require their authenticator code.</p>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </div>
      )}
      {state !== "checking" && (
        <Button asChild variant="link" className="mt-6 w-full"><Link to="/auth" search={{ mode: "signin" }}>Back to sign in</Link></Button>
      )}
    </AccountPage>
  );
}