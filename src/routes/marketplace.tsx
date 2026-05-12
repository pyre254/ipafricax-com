import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { Search, Sparkles, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/marketplace")({
  component: Marketplace,
});

type Listing = {
  id: string; title: string; ip_type: string; abstract: string;
  cover_image_url: string | null; asking_price: number | null; currency: string;
  jurisdictions: string[]; industry_tags: string[]; license_types: string[];
  verification_status: string; ai_readiness_score: number | null;
};

const TYPES = ["all", "patent", "trademark", "industrial_design", "copyright", "utility_model", "trade_secret"];

function Marketplace() {
  const [all, setAll] = useState<Listing[]>([]);
  const [filtered, setFiltered] = useState<Listing[]>([]);
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResult, setAiResult] = useState<{ id: string; reasoning: string }[] | null>(null);

  useEffect(() => {
    supabase.from("ip_listings").select("*").eq("status", "active").order("created_at", { ascending: false })
      .then(({ data }) => { setAll((data ?? []) as Listing[]); setFiltered((data ?? []) as Listing[]); });
  }, []);

  useEffect(() => {
    setFiltered(type === "all" ? all : all.filter((l) => l.ip_type === type));
    setAiResult(null);
  }, [type, all]);

  const runAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setAiSearching(true);
    setAiResult(null);
    try {
      const candidates = (type === "all" ? all : all.filter((l) => l.ip_type === type)).slice(0, 40);
      const r = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, listings: candidates.map((l) => ({ id: l.id, title: l.title, abstract: l.abstract, ip_type: l.ip_type, industry_tags: l.industry_tags })) }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Search failed");
      setAiResult(json.results || []);
      const ids = new Set((json.results || []).map((x: { id: string }) => x.id));
      setFiltered(candidates.filter((l) => ids.has(l.id)).sort((a, b) => {
        const ai = (json.results || []).findIndex((r: { id: string }) => r.id === a.id);
        const bi = (json.results || []).findIndex((r: { id: string }) => r.id === b.id);
        return ai - bi;
      }));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Semantic search failed");
    } finally {
      setAiSearching(false);
    }
  };

  return (
    <div className="min-h-screen">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-xs uppercase tracking-widest text-primary">Marketplace</p>
        <h1 className="mt-2 font-display text-3xl md:text-5xl font-semibold">Discover IP across Africa</h1>

        <form onSubmit={runAi} className="mt-8 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe what you're looking for — e.g. solar irrigation patent for smallholder farms"
              className="w-full rounded-full border border-border bg-card/60 pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <button disabled={aiSearching} className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-gold px-6 py-3 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-50">
            {aiSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            AI search
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button key={t} onClick={() => setType(t)} className={`rounded-full px-3 py-1 text-xs capitalize border ${type === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
              {t.replace("_", " ")}
            </button>
          ))}
        </div>

        {aiResult && aiResult.length > 0 && (
          <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/5 p-4 text-sm">
            <div className="flex items-center gap-2 text-accent font-medium"><Sparkles className="h-4 w-4" /> AI matched {aiResult.length} listings</div>
            <p className="mt-1 text-xs text-muted-foreground">Ranked by semantic relevance to your query.</p>
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => {
            const why = aiResult?.find((r) => r.id === l.id)?.reasoning;
            return (
              <Link key={l.id} to="/listings/$id" params={{ id: l.id }} className="group rounded-2xl border-hairline bg-gradient-card overflow-hidden hover:shadow-glow transition">
                {l.cover_image_url ? (
                  <img src={l.cover_image_url} alt={l.title} className="w-full h-40 object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-40 bg-gradient-hero flex items-center justify-center text-xs text-muted-foreground capitalize">{l.ip_type.replace("_", " ")}</div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-widest text-primary">{l.ip_type.replace("_", " ")}</span>
                    {l.verification_status === "verified" && <ShieldCheck className="h-3.5 w-3.5 text-accent" />}
                  </div>
                  <h3 className="mt-1 font-semibold leading-tight line-clamp-2">{l.title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{l.abstract}</p>
                  {why && <p className="mt-3 text-xs text-accent border-l-2 border-accent/40 pl-2 line-clamp-2 italic">"{why}"</p>}
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{l.jurisdictions.slice(0, 2).join(", ")}</span>
                    <span className="font-mono">{l.asking_price ? `${l.currency} ${Number(l.asking_price).toLocaleString()}` : "POA"}</span>
                  </div>
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No active listings match yet.
              <Link to="/auth" search={{ mode: "signup" }} className="text-primary hover:underline ml-1 inline-flex items-center gap-1">Be the first to list <ArrowRight className="h-3 w-3" /></Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
