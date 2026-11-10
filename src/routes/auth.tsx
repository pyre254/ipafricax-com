import { PasswordInput } from "@/components/password-input";
import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HomeLink } from "@/components/home-link";
import { authDestinations, postSignInDestination } from "@/lib/auth-destinations";
import {
  CONTACT_EMAIL, CONTACT_EMAIL_HREF, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_HREF,
} from "@/lib/contact";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional().default("signin"),
  next: z.enum(authDestinations).optional().catch(undefined),
});

export const Route = createFileRoute("/auth")({
  head: () => pageMeta('Account access', 'Create an account or sign in to IP Africa Exchange.'),
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

function AuthPage() {
  const { mode, next } = Route.useSearch();
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
      await navigate(postSignInDestination(next));
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
        <Link to="/" aria-label="IP Africa Exchange home" className="inline-flex items-center gap-3 text-sm font-semibold text-navy">
          <img src="/favicon.svg" alt="" className="h-9 w-9" /> IP Africa Exchange
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
        <div className="text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} IP Africa Exchange</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            <a href={CONTACT_EMAIL_HREF} className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
              <Mail className="h-3.5 w-3.5 text-primary" /> {CONTACT_EMAIL}
            </a>
            <a href={CONTACT_PHONE_HREF} className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
              <Phone className="h-3.5 w-3.5 text-primary" /> {CONTACT_PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link to="/" aria-label="IP Africa Exchange home" className="flex items-center gap-2 text-sm font-semibold text-navy lg:invisible">
              <img src="/favicon.svg" alt="" className="h-8 w-8" /> IP Africa Exchange
            </Link>
            <HomeLink />
          </div>
          <h1 className="font-display text-3xl font-semibold">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignup ? "Tell us a bit about you to get personalized listings and matches." : next === "verify-ip" ? "Sign in to verify an IP asset." : next === "verification-history" ? "Sign in to view your private verification history." : next === "list-service" ? "Sign in to list a professional service." : "Sign in to manage your portfolio and deals."}
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
                <Field label="Account type">
                  <select aria-label="Account type" value={form.isRightsHolder ? "seller" : "buyer"} onChange={(e) => setForm({ ...form, isRightsHolder: e.target.value === "seller" })} className="input">
                    <option value="buyer">Buyer</option>
                    <option value="seller">Seller / rights holder</option>
                  </select>
                </Field>
              </>
            )}
            <Field label="Email">
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
            </Field>
            <Field label="Password">
              <PasswordInput required minLength={8} autoComplete={isSignup ? "new-password" : "current-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" />
            </Field>
            {!isSignup && (
              <div className="flex justify-end">
                <Button asChild variant="link" size="sm" className="px-0">
                  <Link to="/forgot-password">Forgot password?</Link>
                </Button>
              </div>
            )}

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
              search={{ mode: isSignup ? "signin" : "signup", next }}
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
          background: var(--card);
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
