import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HomeLink } from "@/components/home-link";

export function AccountPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-4">
          <Link to="/" aria-label="IP Africa Exchange home" className="flex items-center gap-3 text-sm font-semibold text-navy">
            <img src="/favicon.svg" alt="" className="h-9 w-9 shrink-0" />
            IP Africa Exchange
          </Link>
          <HomeLink />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md px-6 py-12 sm:py-20">{children}</main>
    </div>
  );
}