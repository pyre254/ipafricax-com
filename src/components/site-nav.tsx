import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, LogOut, ShieldCheck, LayoutDashboard, Plus, Menu, UserRound, BriefcaseBusiness, FileSearch, Store, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { HomeLink } from "@/components/home-link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

function PrimaryLinks() {
  return <>
    <Button asChild variant="ghost" className="h-11 min-w-0 flex-1 rounded-none px-2 text-xs sm:px-3 sm:text-sm lg:flex-none">
      <Link to="/marketplace" activeOptions={{ exact: true }} activeProps={{ className: "bg-primary/5 text-primary" }}><Store />Marketplace</Link>
    </Button>
    <Button asChild variant="ghost" className="h-11 min-w-0 flex-1 rounded-none px-2 text-xs sm:px-3 sm:text-sm lg:flex-none">
      <Link to="/verification" activeProps={{ className: "bg-primary/5 text-primary" }}><FileSearch />IP Verification</Link>
    </Button>
    <Button asChild variant="ghost" className="h-11 min-w-0 flex-1 rounded-none px-2 text-xs sm:px-3 sm:text-sm lg:flex-none">
      <Link to="/services" activeProps={{ className: "bg-primary/5 text-primary" }}><BriefcaseBusiness />Services</Link>
    </Button>
  </>;
}

export function SiteNav() {
  const { user, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const handleSignOut = async () => {
    setSigningOut(true);
    try { await signOut(); await navigate({ to: "/" }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not sign out. Please try again."); }
    finally { setSigningOut(false); }
  };

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
        <nav aria-label="Main navigation" className="hidden lg:flex items-center text-foreground/70">
          <PrimaryLinks />
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <HomeLink />
          {!user && (
            <>
              <Link to="/auth" search={{ mode: "signin" }} className="hidden sm:inline-flex text-sm font-medium text-foreground/70 hover:text-navy transition-colors">Sign in</Link>
              <Button asChild className="rounded-full shadow-emerald">
                <Link to="/auth" search={{ mode: "signup" }}><span className="sm:hidden">Join</span><span className="hidden sm:inline">Get started</span><ArrowRight className="hidden sm:block" /></Link>
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title={user ? "Account menu" : "Open menu"} aria-label={user ? "Account menu" : "Open menu"} className={user ? "sm:w-auto sm:px-3" : "sm:hidden"}>
                {user ? <UserRound /> : <Menu />}{user && <><span className="hidden sm:inline">Account</span><ChevronDown className="hidden sm:block" /></>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {user ? <>
                <DropdownMenuLabel>My account</DropdownMenuLabel>
                <DropdownMenuItem asChild><Link to="/dashboard"><LayoutDashboard />Dashboard</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/profile"><UserRound />Profile</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/kyc"><ShieldCheck />Identity verification</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/verification/history"><FileSearch />My verifications</Link></DropdownMenuItem>
                {hasRole("rights_holder") && <DropdownMenuItem asChild><Link to="/listings/new"><Plus />List IP</Link></DropdownMenuItem>}
                <DropdownMenuItem asChild><Link to="/services/new"><BriefcaseBusiness />List a service</Link></DropdownMenuItem>
                {(hasRole("admin") || hasRole("verifier")) && <DropdownMenuItem asChild><Link to="/admin"><ShieldCheck />Review submissions</Link></DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={signingOut} onSelect={() => { void handleSignOut(); }}><LogOut />{signingOut ? "Signing out…" : "Sign out"}</DropdownMenuItem>
              </> : <>
                <DropdownMenuItem asChild><Link to="/auth" search={{ mode: "signin" }}><UserRound />Sign in</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/auth" search={{ mode: "signup" }}><Plus />Create an account</Link></DropdownMenuItem>
              </>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <nav aria-label="Main navigation" className="flex border-t border-border px-2 text-foreground/70 sm:px-4 lg:hidden">
        <PrimaryLinks />
      </nav>
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
