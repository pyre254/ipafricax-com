import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function SiteNav() {
  const { user, signOut, hasRole } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-gold text-primary-foreground font-bold">IP</div>
          <span className="font-display text-lg font-semibold">IPAfrica</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <Link to="/marketplace" className="hover:text-foreground transition-colors">Marketplace</Link>
          {user && <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>}
          {user && <Link to="/kyc" className="hover:text-foreground transition-colors">Verification</Link>}
          {hasRole("admin") && <Link to="/admin" className="hover:text-foreground transition-colors">Admin</Link>}
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[160px]">{user.email}</span>
              <button
                onClick={async () => { await signOut(); navigate({ to: "/" }); }}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-2 text-sm hover:bg-card transition"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/auth" className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground shadow-gold hover:opacity-95 transition"
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

export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
      <ShieldCheck className="h-3 w-3" /> Verified
    </span>
  );
}
