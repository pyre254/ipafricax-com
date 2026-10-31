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
  const finishing = useRef(false);

  useEffect(() => {
    if (loading || finishing.current) return;
    if (!passwordRecovery) { setState("invalid"); return; }
    let active = true;
    void supabase.auth.getUser().then(({ data, error: sessionError }) => {
      if (active && !finishing.current) setState(!sessionError && data.user ? "ready" : "invalid");
    }).catch(() => { if (active && !finishing.current) setState("invalid"); });
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