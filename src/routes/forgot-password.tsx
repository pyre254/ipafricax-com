import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, KeyRound, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AccountPage } from "@/components/account-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/forgot-password")({
  head: () => pageMeta("Forgot password", "Request a secure password reset link for your IP Africa Exchange account."),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (requestError) {
        throw new Error(requestError.status === 429
          ? "Too many requests. Please wait before requesting another link."
          : "We couldn't send a reset link right now. Please try again.");
      }
      setSent(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We couldn't send a reset link. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountPage>
      {sent ? (
        <div role="status">
          <MailCheck className="h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="mt-5 text-3xl font-semibold">Check your email</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            If an account exists for that email, you'll receive a link to reset your password. Check your spam folder too.
          </p>
          <Button variant="outline" className="mt-6 w-full" onClick={() => { setSent(false); setError(""); }}>
            Use another email
          </Button>
        </div>
      ) : (
        <>
          <KeyRound className="h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="mt-5 text-3xl font-semibold">Forgot password?</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Enter your account email to receive a secure reset link.</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="recovery-email" className="text-sm font-medium">Email address</label>
              <Input id="recovery-email" type="email" autoComplete="email" required value={email} disabled={busy}
                onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 bg-card" />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy} className="h-11 w-full">{busy ? "Sending…" : "Send reset link"}</Button>
          </form>
        </>
      )}
      <Button asChild variant="link" className="mt-6 w-full">
        <Link to="/auth" search={{ mode: "signin" }}><ArrowLeft aria-hidden="true" /> Back to sign in</Link>
      </Button>
    </AccountPage>
  );
}