import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["is_certificate", "document_language", "issuing_office", "document_format", "title", "ip_type", "registration_number", "registration_authority", "owner_name", "jurisdiction", "filing_date", "grant_date", "expiry_date", "applicant_address", "priority_date", "designated_states", "classes", "mismatches", "match_score", "summary"],
  properties: {
    is_certificate: { type: "boolean" },
    document_language: { type: "string", enum: ["en", "fr", "pt", "ar", "es", "sw", "mixed", "other"] },
    issuing_office: { type: "string", enum: ["KIPI", "ARIPO", "OAPI", "CIPC", "EGYPO", "NOTAP", "OTHER", "UNKNOWN"] },
    document_format: { type: ["string", "null"] },
    applicant_address: { type: ["string", "null"] },
    priority_date: { type: ["string", "null"] },
    designated_states: { type: "array", items: { type: "string" } },
    classes: { type: "array", items: { type: "string" } },
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

const SYSTEM_PROMPT = `You are an IP registry examiner for African IP offices. Read the registration certificate (it may be scanned, stamped, rotated, bilingual or partly handwritten) and compare it with the seller's listing.

Office formats to recognise:
- KIPI (Kenya Industrial Property Institute, Nairobi): English. Patents "KE/P/YYYY/NNNN" or plain numbers like "KE 1234"; utility models "KE/UM/..."; industrial designs "KE/ID/..."; trademarks "TMA No. NNNNNN" / "KE/T/YYYY/NNNNNN". Trademark registration lasts 10 years from filing, renewable; patents 20 years from filing (annual fees); utility models 10 years; designs 5 years + two 5-year renewals.
- ARIPO (African Regional IP Organization, Harare): English, sometimes with Portuguese. Patents "AP NNNN", utility models "AP UM...", designs "AP ID...", Banjul Protocol marks "AP/M/YYYY/NNNNNN". Lists designated states (e.g. KE, UG, TZ, GH, ZW, MZ). Patents 20 years; designs 10 years; marks 10 years renewable.
- OAPI (Organisation Africaine de la Propriété Intellectuelle, Yaoundé): French ("Certificat d'enregistrement", "Brevet d'invention", "Marque de produits et de services", "Modèle d'utilité", "Dessin ou modèle industriel", "Titulaire" = owner, "Date de dépôt" = filing date, "Date de délivrance" = grant date, "Classes"). Single title covering all 17 member states. Patents 20 years; marks 10 years renewable; utility models 10 years; designs 5 years + renewals.
- Also handle South Africa CIPC, Egypt, Nigeria and others; for Arabic or Portuguese documents translate field values to English except names and numbers.

Rules:
- Keep owner names and registration numbers exactly as printed (original script/accents); do not translate them.
- Dates as YYYY-MM-DD; convert from DD/MM/YYYY (the norm in Africa — never read as MM/DD), French month names, or Arabic numerals.
- If no expiry is printed, compute expiry_date from the filing date and the office's term above, and say so in summary.
- classes = Nice/Locarno/IPC classes printed. designated_states = ISO country codes for ARIPO designations or OAPI coverage.
- issuing_office: the office that issued the document. document_format: short description (e.g. "OAPI trademark certificate, French").
- Flag every mismatch with the listing (title wording, IP type, registration number, authority, jurisdiction vs designated states, owner name/organisation, expired or soon-expiring rights). Treat translation-only differences (e.g. French vs English title with the same meaning) as low severity.
- Use null for anything not on the document. match_score is 0-100 for how well the certificate supports the listing. Write summary and notes in English.`;

const toDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

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
        reasoning: { effort: "medium", summary: "auto" }, include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: "certificate_check", strict: true, schema: extractionSchema } },
        input: [
          { role: "system", content: SYSTEM_PROMPT },
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
    if (mismatches.length === 0) await supabase.from("certificate_checks").update({ review_status: "not_required" }).eq("id", row.id);
    await supabase.from("ip_listings").update({ cert_expiry_date: toDate(extracted.expiry_date), cert_grant_date: toDate(extracted.grant_date) }).eq("id", listing.id);
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

export const reviewCertificateCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    checkId: z.string().uuid(),
    decision: z.enum(["accepted", "rejected", "needs_info"]),
    notes: z.string().trim().min(3).max(2000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: isAdmin }, { data: isVerifier }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "verifier" }),
    ]);
    if (!isAdmin && !isVerifier) throw new Error("Only admins and verifiers can review certificates.");
    const { data: check, error } = await supabase.from("certificate_checks").update({
      review_status: data.decision, reviewer_id: userId, reviewer_notes: data.notes, reviewed_at: new Date().toISOString(),
    }).eq("id", data.checkId).select("id,listing_id,owner_id,match_score,mismatches").single();
    if (error || !check) throw new Error(error?.message ?? "Check not found.");
    await supabase.from("audit_logs").insert({
      actor_id: userId, action: `certificate.review_${data.decision}`, entity_type: "ip_listing", entity_id: check.listing_id,
      metadata: { check_id: check.id, notes: data.notes, match_score: check.match_score, mismatch_count: (check.mismatches as unknown[]).length },
    });
    const { data: listing } = await supabase.from("ip_listings").select("title").eq("id", check.listing_id).maybeSingle();
    const label = { accepted: "accepted", rejected: "rejected", needs_info: "needs more information" }[data.decision];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications").insert({
      user_id: check.owner_id, kind: "certificate_review", listing_id: check.listing_id,
      title: `Certificate review ${label}: ${listing?.title ?? "your asset"}`, body: data.notes,
    });
    return { ok: true };
  });
