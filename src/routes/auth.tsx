import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional().default("signin"),
});

export const Route = createFileRoute("/auth")({
  head: () => pageMeta('Account access', 'Create an account or sign in to IP Africa Exchange.'),
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const isSignup = mode === "signup";
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    organization: "",
    orgType: "inventor",
    country: "Kenya",
    isRightsHolder: true,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: form.fullName,
              organization: form.organization,
              org_type: form.orgType,
              country: form.country,
              is_rights_holder: form.isRightsHolder,
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your inbox to confirm your email, then sign in.");
          return;
        }
        toast.success("Account created. Welcome to IP Africa Exchange.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
        toast.success("Signed in.");
      }
      await router.invalidate();
      await navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-card p-12 border-r border-border/40">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <div>
          <ShieldCheck className="h-10 w-10 text-accent" />
          <h2 className="mt-6 font-display text-4xl font-semibold leading-tight">
            Verified ownership.<br /> Escrow-backed deals.
          </h2>
          <p className="mt-4 text-muted-foreground max-w-md">
            Join Africa's IP marketplace. Whether you hold patents, trademarks, copyrights, or you're scouting innovation — sign in to get started.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} IP Africa Exchange</p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl font-semibold">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignup ? "Tell us a bit about you to get personalized listings and matches." : "Sign in to manage your portfolio and deals."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {isSignup && (
              <>
                <Field label="Full name">
                  <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Organization">
                    <input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="input" />
                  </Field>
                  <Field label="Type">
                    <select value={form.orgType} onChange={(e) => setForm({ ...form, orgType: e.target.value })} className="input">
                      <option value="inventor">Independent inventor</option>
                      <option value="startup">Startup</option>
                      <option value="university">University / TTO</option>
                      <option value="corporate">Corporate</option>
                      <option value="law_firm">Law firm / Agent</option>
                    </select>
                  </Field>
                </div>
                <Field label="Country">
                  <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="input" />
                </Field>
                <label className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isRightsHolder}
                    onChange={(e) => setForm({ ...form, isRightsHolder: e.target.checked })}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">I'm a rights-holder.</span>
                    <span className="block text-muted-foreground text-xs mt-0.5">I want to list IP for sale or licensing. (Buyers are enabled by default.)</span>
                  </span>
                </label>
              </>
            )}
            <Field label="Email">
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
            </Field>
            <Field label="Password">
              <input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" />
            </Field>

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gradient-gold py-3 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-50"
            >
              {loading ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground text-center">
            {isSignup ? "Already have an account?" : "New to IP Africa Exchange?"}{" "}
            <Link
              to="/auth"
              search={{ mode: isSignup ? "signin" : "signup" }}
              className="text-primary font-medium hover:underline"
            >
              {isSignup ? "Sign in" : "Create one"}
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: 0.625rem;
          padding: 0.65rem 0.85rem;
          color: var(--color-foreground);
          font-size: 0.875rem;
        }
        .input:focus { outline: 2px solid var(--primary); outline-offset: 1px; border-color: var(--primary); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
