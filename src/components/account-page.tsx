import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Mail, Phone } from "lucide-react";
import { HomeLink } from "@/components/home-link";
import {
  CONTACT_EMAIL, CONTACT_EMAIL_HREF, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_HREF,
} from "@/lib/contact";

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
      <footer className="mx-auto w-full max-w-md px-6 pb-10 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          <a href={CONTACT_EMAIL_HREF} className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
            <Mail className="h-3.5 w-3.5 text-primary" /> {CONTACT_EMAIL}
          </a>
          <a href={CONTACT_PHONE_HREF} className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
            <Phone className="h-3.5 w-3.5 text-primary" /> {CONTACT_PHONE_DISPLAY}
          </a>
        </div>
      </footer>
    </div>
  );
}