import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero-ip-africa.jpg";
import { SiteNav } from "@/components/site-nav";
import {
  ShieldCheck, Sparkles, ScrollText, Lock, Globe2, Gavel, Banknote,
  Search, FileSignature, Building2, Microscope, Palette, Tag, BookOpen,
  ArrowRight, CheckCircle2, TrendingUp, MessagesSquare, Brain, MapPin
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IPAfrica — Kenya & Africa's IP Commercialization Marketplace" },
      { name: "description", content: "Buy, sell, license and discover patents, trademarks, designs and copyrights across Kenya and Africa. Verified ownership, escrow payments, AI matchmaking." },
      { property: "og:title", content: "IPAfrica — Kenya & Africa's IP Marketplace" },
      { property: "og:description", content: "Africa's enterprise marketplace for intellectual property: patents, trademarks, designs, copyrights." },
    ],
  }),
  component: Landing,
});

const ipTypes = [
  { icon: Microscope, title: "Patents", desc: "Granted patents and pending applications across KIPI, ARIPO & OAPI." },
  { icon: Tag, title: "Trademarks", desc: "Registered marks, logos and brand portfolios across African jurisdictions." },
  { icon: Palette, title: "Industrial Designs", desc: "Product designs and aesthetic IP rights." },
  { icon: BookOpen, title: "Copyrights", desc: "Software, literary, musical and audiovisual works." },
  { icon: ScrollText, title: "Utility Models", desc: "Practical inventions with shorter protection cycles." },
  { icon: Sparkles, title: "Know-How & Trade Secrets", desc: "Confidential commercial knowledge under NDA." },
];

const features = [
  { icon: ShieldCheck, title: "Verified Ownership", desc: "Government registry checks, KYC, and admin review with audit logs and verification badges." },
  { icon: Lock, title: "Escrow Payments", desc: "Funds held securely until licensing or transfer milestones are met. Multi-currency settlement across African corridors." },
  { icon: Brain, title: "AI Matchmaking", desc: "Semantic search, similar-IP recommendations and buyer–seller matching tuned for African industry." },
  { icon: Gavel, title: "Licensing Engine", desc: "Exclusive, non-exclusive, territorial and time-based licenses with automated royalties." },
  { icon: FileSignature, title: "E-Signatures & Deal Rooms", desc: "Private, encrypted negotiation spaces with audit trails and binding e-signatures." },
  { icon: TrendingUp, title: "Valuation & Royalty Tracking", desc: "AI valuation estimates, commercial readiness scoring and live royalty reporting." },
];

const trust = [
  "KIPI, ARIPO & OAPI registry lookups",
  "KYC & organization verification",
  "Manual admin review of high-value listings",
  "Fraud detection on every transaction",
  "Immutable audit logs",
  "Bank-grade escrow",
];

const orgs = [
  { icon: Building2, label: "Universities & TTOs" },
  { icon: Sparkles, label: "Startups & Inventors" },
  { icon: Globe2, label: "Corporates" },
  { icon: Gavel, label: "Law Firms & Agents" },
];

function Landing() {
  return (
    <div className="min-h-screen text-foreground bg-background">
      <SiteNav />
      <Hero />
      <Logos />
      <Section id="assets" eyebrow="IP Asset Classes" title="Every form of intellectual property, in one African exchange.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ipTypes.map((t) => (
            <Card key={t.title}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <t.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-navy">{t.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="platform" eyebrow="The Platform" title="Built like fintech. Governed like legaltech.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-emerald text-white shadow-emerald">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-navy">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="trust" eyebrow="Trust & Verification" title="Provenance you can prove. Deals you can defend.">
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          <div className="rounded-3xl border border-border bg-white p-8 shadow-elegant">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-trust text-white">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Verification Stack</p>
                <p className="text-lg font-semibold text-navy">Multi-layer ownership proof</p>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {trust.map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-2xl md:text-3xl font-semibold text-navy">From registration certificate to wired royalty — one chain of custody.</h3>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Every asset on IPAfrica is linked to a verified rights-holder, registered jurisdiction, and a tamper-evident transaction history.
              Buyers see a verification badge before they ever open a deal room.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Verified Owner", "Registry Confirmed", "KYC Passed", "Escrow Ready"].map((b) => (
                <span key={b} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {b}
                </span>
              ))}
              <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Institutional</span>
            </div>
          </div>
        </div>
      </Section>

      <Section id="licensing" eyebrow="Licensing Engine" title="Structure any deal. Automate every royalty.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "Exclusive", d: "Single licensee, full market rights." },
            { t: "Non-Exclusive", d: "Parallel licensees, scalable revenue." },
            { t: "Territorial", d: "Country, region or AU-bloc scope." },
            { t: "Time-Based", d: "Term, renewal and milestone gating." },
            { t: "Royalty %", d: "Auto-calculated from reported revenue." },
            { t: "Revenue Share", d: "Tiered splits with audit reporting." },
            { t: "Lump Sum", d: "Upfront transfer with escrow release." },
            { t: "Hybrid", d: "Combined upfront + ongoing royalty." },
          ].map((x) => (
            <Card key={x.t}>
              <p className="text-xs uppercase tracking-widest text-primary font-semibold">License</p>
              <h3 className="mt-2 text-lg font-semibold text-navy">{x.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{x.d}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="ai" eyebrow="AI Engine" title="Semantic search built for innovation, not keywords.">
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            { icon: Search, t: "Semantic Tech Search", d: "Describe a problem in plain language — surface the IP that solves it." },
            { icon: Brain, t: "Buyer–Seller Matching", d: "Match listings to corporate R&D briefs and investment theses with explainability." },
            { icon: TrendingUp, t: "Valuation & Readiness", d: "AI valuation bands and commercial readiness scoring per asset." },
          ].map((x) => (
            <Card key={x.t}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <x.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-navy">{x.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{x.d}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="who" eyebrow="Built For" title="Who's on IPAfrica">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {orgs.map((o) => (
            <Card key={o.label}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-white">
                <o.icon className="h-5 w-5" />
              </div>
              <p className="mt-4 font-semibold text-navy">{o.label}</p>
            </Card>
          ))}
        </div>
      </Section>

      <CTA />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-hero text-white">
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-6 pt-16 pb-24 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            <MapPin className="h-3 w-3 text-accent" />
            Headquartered in Nairobi · serving 54 African markets
          </span>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] md:text-6xl lg:text-7xl text-white">
            Kenya &amp; Africa's marketplace for <span className="text-gradient-gold">intellectual property</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/75 leading-relaxed">
            Buy, sell, license and discover patents, trademarks, designs and copyrights — with verified ownership,
            escrow-backed deals and AI matchmaking. Built like fintech. Governed like legaltech.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/marketplace" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-emerald hover:opacity-95 transition">
              Explore the marketplace <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/auth" search={{ mode: "signup" }} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15 transition">
              <ShieldCheck className="h-4 w-4 text-accent" /> List your IP
            </Link>
          </div>
          <dl className="mt-12 grid grid-cols-3 gap-6 max-w-lg">
            {[
              { k: "12,400+", v: "IP assets indexed" },
              { k: "$48M", v: "In escrow lifetime" },
              { k: "54", v: "African markets" },
            ].map((s) => (
              <div key={s.v}>
                <dt className="font-display text-2xl font-semibold text-gradient-gold">{s.k}</dt>
                <dd className="mt-1 text-xs text-white/60">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative">
          <div className="absolute -inset-8 bg-accent opacity-20 blur-3xl rounded-full" />
          <div className="relative rounded-3xl border border-white/10 bg-white/5 p-2 shadow-elegant animate-float backdrop-blur">
            <img
              src={heroImg}
              alt="Network of intellectual property assets across Africa"
              width={1600}
              height={1100}
              className="rounded-2xl w-full h-auto"
            />
          </div>
          <div className="absolute -bottom-6 -left-6 hidden sm:flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-elegant">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Registry verified</p>
              <p className="text-sm font-semibold text-navy">Patent · KIPI/AP/2024</p>
            </div>
          </div>
          <div className="absolute -top-4 -right-4 hidden sm:flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-elegant">
            <Banknote className="h-5 w-5 text-accent" />
            <div>
              <p className="text-xs text-muted-foreground">Escrow released</p>
              <p className="text-sm font-semibold text-navy">$120,000 · Royalty Q1</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Logos() {
  return (
    <div className="border-b border-border bg-white">
      <div className="mx-auto max-w-7xl px-6 py-8 flex flex-wrap items-center justify-between gap-6 text-xs uppercase tracking-widest text-muted-foreground">
        <span className="font-semibold">Aligned with</span>
        {["KIPI", "ARIPO", "OAPI", "WIPO Green", "AfDB", "Smart Africa"].map((l) => (
          <span key={l} className="font-display text-base font-semibold text-navy/70">{l}</span>
        ))}
      </div>
    </div>
  );
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-7xl px-6 py-24">
      <div className="max-w-3xl mb-12">
        <p className="text-xs uppercase tracking-widest text-primary font-semibold">{eyebrow}</p>
        <h2 className="mt-3 font-display text-3xl md:text-4xl lg:text-5xl font-semibold text-navy">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="group relative rounded-2xl border border-border bg-white p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-elegant hover:border-primary/30">
      {children}
    </div>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-3xl bg-navy p-10 md:p-16 shadow-elegant">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-accent opacity-20 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">Get started</p>
            <h2 className="mt-3 font-display text-3xl md:text-5xl font-semibold leading-tight text-white">
              Turn ideas into <span className="text-gradient-gold">income</span>. Turn portfolios into <span className="text-gradient-gold">deals</span>.
            </h2>
            <p className="mt-4 max-w-xl text-white/70">
              Join universities, startups, corporates and inventors monetizing their IP across Kenya and Africa.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link to="/auth" search={{ mode: "signup" }} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-emerald">
              Create an account <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="mailto:hello@ipafrica.co" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white">
              <MessagesSquare className="h-4 w-4" /> Talk to sales
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-navy text-white text-xs font-bold">IP</div>
          <span>© {new Date().getFullYear()} IPAfrica · Nairobi, Kenya. All rights reserved.</span>
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-navy">Privacy</a>
          <a href="#" className="hover:text-navy">Terms</a>
          <a href="#" className="hover:text-navy">Security</a>
          <a href="#" className="hover:text-navy">Contact</a>
        </div>
      </div>
    </footer>
  );
}
