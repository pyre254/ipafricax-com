import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, LogOut, ShieldCheck, LayoutDashboard, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { HomeLink } from "@/components/home-link";

export function SiteNav() {
  const { user, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link to="/" aria-label="IP Africa Exchange home" className="flex min-w-0 items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
          <div className="leading-tight">
            <div className="font-display text-sm sm:text-lg font-semibold text-navy max-w-32 sm:max-w-none">IP Africa Exchange</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Kenya · Africa</div>
          </div>
        </Link>
        <nav className="hidden xl:flex items-center gap-5 text-sm font-medium text-foreground/70">
          <Link to="/marketplace" className="hover:text-navy transition-colors">Marketplace</Link>
          <Link to="/verification" className="hover:text-navy transition-colors">IP verification</Link>
          {user && <Link to="/dashboard" className="hover:text-navy transition-colors">Dashboard</Link>}
          {user && <Link to="/profile" className="hover:text-navy transition-colors">Profile</Link>}
          {user && hasRole("rights_holder") && <Link to="/listings/new" className="hover:text-navy transition-colors">List IP</Link>}
          {user && <Link to="/kyc" className="hover:text-navy transition-colors">Identity</Link>}
          {(hasRole("admin") || hasRole("verifier")) && <Link to="/admin" className="hover:text-navy transition-colors">Admin</Link>}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <HomeLink />
          {user ? (
            <>
              <Link to="/dashboard" className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-navy">
                <LayoutDashboard className="h-3.5 w-3.5" /> {user.email?.split("@")[0]}
              </Link>
              {hasRole("rights_holder") && (
                <Link to="/listings/new" className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-2 text-sm font-medium text-navy hover:border-primary hover:text-primary transition">
                  <Plus className="h-4 w-4" /> List IP
                </Link>
              )}
              <Button
                disabled={signingOut}
                onClick={async () => {
                  setSigningOut(true);
                  try { await signOut(); await navigate({ to: "/" }); }
                  catch (error) { toast.error(error instanceof Error ? error.message : "Could not sign out. Please try again."); }
                  finally { setSigningOut(false); }
                }}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-emerald hover:opacity-95 transition"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth" search={{ mode: "signin" }} className="hidden sm:inline-flex text-sm font-medium text-foreground/70 hover:text-navy transition-colors">Sign in</Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-emerald hover:opacity-95 transition"
              >
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function VerifiedBadge({ label = "Verified" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
      <ShieldCheck className="h-3 w-3" /> {label}
    </span>
  );
}

export function GoldBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent-foreground">
      <ShieldCheck className="h-3 w-3 text-accent" /> {label}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "approved" || status === "verified" ? "bg-primary/10 text-primary border-primary/30"
    : status === "pending" || status === "pending_review" ? "bg-accent/10 text-accent-foreground border-accent/40"
    : status === "rejected" || status === "withdrawn" || status === "disputed" || status === "refunded" ? "bg-destructive/10 text-destructive border-destructive/30"
    : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${tone}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
