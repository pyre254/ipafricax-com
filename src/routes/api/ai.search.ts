import { createFileRoute } from "@tanstack/react-router";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export const Route = createFileRoute("/api/ai/search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { query, listings } = (await request.json()) as { query: string; listings: { id: string; title: string; abstract: string; ip_type: string; industry_tags: string[] }[] };
          if (!query || !Array.isArray(listings)) return Response.json({ error: "Invalid input" }, { status: 400 });
          const key = process.env.LOVABLE_API_KEY;
          if (!key) return Response.json({ error: "Missing LOVABLE_API_KEY" }, { status: 500 });

          const corpus = listings.map((l) => `ID:${l.id} | ${l.ip_type} | ${l.title} :: ${l.abstract.slice(0, 220)} | tags: ${(l.industry_tags || []).join(",")}`).join("\n");

          const r = await fetch(GATEWAY, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You are a semantic IP search engine. Return JSON only." },
                { role: "user", content: `Query: "${query}"\n\nListings:\n${corpus}\n\nReturn the top 12 most semantically relevant listing IDs ranked by relevance. For each, give a one-sentence reasoning. Return JSON: {"results":[{"id":"<id>","reasoning":"..."}]}` },
              ],
              response_format: { type: "json_object" },
            }),
          });
          if (!r.ok) {
            const t = await r.text();
            return Response.json({ error: `AI gateway ${r.status}: ${t.slice(0, 200)}` }, { status: 502 });
          }
          const j = await r.json();
          const content = j.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(content);
          return Response.json({ results: parsed.results ?? [] });
        } catch (err) {
          return Response.json({ error: err instanceof Error ? err.message : "search failed" }, { status: 500 });
        }
      },
    },
  },
});
