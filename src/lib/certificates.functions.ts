import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["is_certificate", "title", "ip_type", "registration_number", "registration_authority", "owner_name", "jurisdiction", "filing_date", "grant_date", "expiry_date", "mismatches", "match_score", "summary"],
  properties: {
    is_certificate: { type: "boolean" },
    title: { type: ["string", "null"] },
    ip_type: { type: ["string", "null"] },
    registration_number: { type: ["string", "null"] },
    registration_authority: { type: ["string", "null"] },
    owner_name: { type: ["string", "null"] },
    jurisdiction: { type: ["string", "null"] },
    filing_date: { type: ["string", "null"] },
    grant_date: { type: ["string", "null"] },
    expiry_date: { type: ["string", "null"] },
    mismatches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "listing_value", "certificate_value", "severity", "note"],
        properties: {
          field: { type: "string" },
          listing_value: { type: ["string", "null"] },
          certificate_value: { type: ["string", "null"] },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          note: { type: "string" },
        },
      },
    },
    match_score: { type: "integer" },
    summary: { type: "string" },
  },
};

async function sha256Hex(bytes: ArrayBuffer | Uint8Array) {
  const d = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return { hex: [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join(""), raw: new Uint8Array(d) };
}

/** Reads the streamed Responses output and returns the final text. */
async function readResponseText(res: Response) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", err: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const ev = JSON.parse(data);
          if (ev.type === "response.output_text.delta") text += ev.delta;
          if (ev.type === "response.failed" || ev.type === "error") err = ev.response?.error?.message ?? ev.message ?? "AI request failed";
          if (ev.type === "response.output_item.done" && ev.item?.content) {
            for (const c of ev.item.content) if (c.type === "refusal") err = "The AI declined to read this document.";
          }
        } catch { /* partial */ }
      }
    }
  }
  if (err) throw new Error(err);
  if (!text) throw new Error("The AI returned no result.");
  return text;
}

export const analyzeCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ listingId: z.string().uuid(), path: z.string().min(1), mimeType: z.string(), fileName: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: listing } = await supabase.from("ip_listings").select("*").eq("id", data.listingId).maybeSingle();
    if (!listing || listing.owner_id !== userId) throw new Error("Only the listing owner can check a certificate.");
    if (!data.path.startsWith(`${userId}/`)) throw new Error("Invalid file.");
    const { data: profile } = await supabase.from("profiles").select("full_name,organization").eq("id", userId).maybeSingle();

    const { data: blob, error } = await supabase.storage.from("ip-documents").download(data.path);
    if (error || !blob) throw new Error("Could not read the uploaded file.");
    if (blob.size > 15 * 1024 * 1024) throw new Error("File is too large (max 15 MB).");
    const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    const isPdf = data.mimeType === "application/pdf";
    if (!isPdf && !data.mimeType.startsWith("image/")) throw new Error("Upload a PDF or an image.");
    const filePart = isPdf
      ? { type: "input_file", filename: data.fileName, file_data: `data:application/pdf;base64,${b64}` }
      : { type: "input_image", image_url: `data:${data.mimeType};base64,${b64}` };

    const listingFacts = {
      title: listing.title, ip_type: listing.ip_type, registration_number: listing.registration_number,
      registration_authority: listing.registration_authority, jurisdictions: listing.jurisdictions,
      owner_name: profile?.full_name, owner_organization: profile?.organization,
    };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured.");
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODEL, stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: "certificate_check", strict: true, schema: extractionSchema } },
        input: [
          { role: "system", content: "You are an IP registry examiner for Kenya (KIPI), ARIPO, OAPI and other African offices. Extract the details printed on the registration certificate and compare them with the seller's listing. Flag every mismatch (title wording, IP type, registration number, authority, jurisdiction, owner name/organisation, expired rights). Use null for anything not on the document. match_score is 0-100 for how well the certificate supports the listing. Dates as YYYY-MM-DD." },
          { role: "user", content: [
            { type: "input_text", text: `Listing details:\n${JSON.stringify(listingFacts, null, 2)}` },
            filePart,
          ] },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 402) throw new Error("AI credits are used up. Add credits to continue.");
      if (res.status === 429) throw new Error("AI is busy right now. Try again in a minute.");
      throw new Error(`AI check failed (${res.status}): ${t.slice(0, 160)}`);
    }
    const result = JSON.parse(await readResponseText(res));
    const { mismatches, match_score, ...extracted } = result;
    const { data: row, error: insErr } = await supabase.from("certificate_checks").insert({
      listing_id: listing.id, owner_id: userId, file_path: data.path, extracted, mismatches, match_score,
    }).select("*").single();
    if (insErr) throw new Error(insErr.message);
    await supabase.from("audit_logs").insert({ actor_id: userId, action: "certificate.ai_checked", entity_type: "ip_listing", entity_id: listing.id, metadata: { match_score, mismatch_count: mismatches.length } });
    return row;
  });

export const anchorCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: listing } = await supabase.from("ip_listings").select("id,owner_id,verification_status,documents").eq("id", data.listingId).maybeSingle();
    if (!listing) throw new Error("Listing not found.");
    if (listing.verification_status !== "verified") throw new Error("Only verified assets can be recorded.");
    const docs = (listing.documents as { kind?: string; path?: string; name?: string }[]) ?? [];
    const cert = [...docs].reverse().find((d) => d.kind === "registration_certificate" && d.path);
    if (!cert?.path) throw new Error("This listing has no registration certificate on file.");
    const { data: blob, error } = await supabase.storage.from("ip-documents").download(cert.path);
    if (error || !blob) throw new Error("Could not read the certificate.");
    const { hex, raw } = await sha256Hex(await blob.arrayBuffer());

    const { data: prev } = await supabase.from("certificate_proofs").select("record_hash").eq("listing_id", listing.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const createdAt = new Date().toISOString();
    const record = await sha256Hex(new TextEncoder().encode(`${listing.id}|${hex}|${createdAt}|${prev?.record_hash ?? ""}`));

    // Public Bitcoin timestamp via OpenTimestamps (no wallet needed). Optional: failure doesn't block the record.
    let ots: string | null = null, calendar: string | null = null;
    for (const cal of ["https://a.pool.opentimestamps.org", "https://b.pool.opentimestamps.org"]) {
      try {
        const r = await fetch(`${cal}/digest`, { method: "POST", body: raw, headers: { Accept: "application/vnd.opentimestamps.v1", "Content-Type": "application/x-www-form-urlencoded" } });
        if (r.ok) { ots = Buffer.from(await r.arrayBuffer()).toString("base64"); calendar = cal; break; }
      } catch { /* try next */ }
    }

    const { data: row, error: insErr } = await supabase.from("certificate_proofs").insert({
      listing_id: listing.id, file_name: cert.name ?? null, sha256: hex, prev_record_hash: prev?.record_hash ?? null,
      record_hash: record.hex, ots_proof: ots, ots_calendar: calendar, created_by: userId, created_at: createdAt,
    }).select("*").single();
    if (insErr) throw new Error(insErr.message);
    await supabase.from("audit_logs").insert({ actor_id: userId, action: "certificate.anchored", entity_type: "ip_listing", entity_id: listing.id, metadata: { sha256: hex, bitcoin: !!ots } });
    return row;
  });
