import { createFileRoute } from "@tanstack/react-router";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export const Route = createFileRoute("/api/ai/value")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { title: string; ip_type: string; abstract: string; industry_tags?: string; jurisdictions?: string };
          const key = process.env.LOVABLE_API_KEY;
          if (!key) return Response.json({ error: "Missing LOVABLE_API_KEY" }, { status: 500 });

          const r = await fetch(GATEWAY, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You are an IP valuation analyst for African markets. Return JSON only." },
                { role: "user", content: `Estimate value (USD) and commercial readiness for this ${body.ip_type}.
Title: ${body.title}
Abstract: ${body.abstract}
Industry: ${body.industry_tags || "—"}
Jurisdictions: ${body.jurisdictions || "—"}

Return JSON: {"valuation_low":<usd>,"valuation_high":<usd>,"readiness_score":<0-100>,"summary":"<2-sentence commercialization summary>"}` },
              ],
              response_format: { type: "json_object" },
            }),
          });
          if (!r.ok) {
            const t = await r.text();
            return Response.json({ error: `AI gateway ${r.status}: ${t.slice(0, 200)}` }, { status: 502 });
          }
          const j = await r.json();
          const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
          return Response.json(parsed);
        } catch (err) {
          return Response.json({ error: err instanceof Error ? err.message : "valuation failed" }, { status: 500 });
        }
      },
    },
  },
});
