import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  submissionSchema,
  normalizeNumber,
  validateDocument,
  compareEvidence,
  reportDisclaimer,
} from "./ip-verification";
import { ownershipDetailsSchema, printedOwnershipRules } from "./certificate-ownership";

export const ownsVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ip_verification_requests")
      .select("id")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Could not check request access.");
    return Boolean(row);
  });

export const listVerifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ page: z.number().int().min(1).default(1), admin: z.boolean().default(false) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.admin) {
      const { data: allowed } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!allowed) throw new Error("Administrator MFA required.");
    }
    let query = context.supabase
      .from("ip_verification_requests")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (!data.admin) query = query.eq("user_id", context.userId);
    const {
      data: rows,
      error,
      count,
    } = await query.range((data.page - 1) * 25, data.page * 25 - 1);
    if (error) throw error;
    let statsQuery = context.supabase
      .from("ip_verification_requests")
      .select("verification_status,submission_status");
    if (!data.admin) statsQuery = statsQuery.eq("user_id", context.userId);
    const { data: stats, error: statsError } = await statsQuery;
    if (statsError) throw statsError;
    return { rows: rows ?? [], count: count ?? 0, stats: stats ?? [] };
  });
export const getVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: request, error } = await context.supabase
      .from("ip_verification_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !request) throw new Error("Verification not found or access denied.");
    const [results, documents, reviews, audit] = await Promise.all([
      context.supabase
        .from("ip_verification_results")
        .select("*")
        .eq("verification_request_id", data.id)
        .order("generated_at", { ascending: false }),
      context.supabase
        .from("ip_verification_documents")
        .select("*")
        .eq("verification_request_id", data.id),
      context.supabase
        .from("ip_verification_reviews")
        .select("*")
        .eq("verification_request_id", data.id)
        .order("reviewed_at", { ascending: false }),
      context.supabase
        .from("ip_verification_audit_logs")
        .select("*")
        .eq("verification_request_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    if (results.error || documents.error || reviews.error || audit.error)
      throw new Error("Could not read verification evidence.");
    const latest = results.data?.[0] ?? null;
    const evidence = latest
      ? await context.supabase
          .from("ip_verification_evidence")
          .select("*")
          .eq("verification_result_id", latest.id)
      : { data: [] };
    const record = latest?.matched_record_id
      ? await context.supabase
          .from("kipi_ip_records")
          .select("*")
          .eq("id", latest.matched_record_id)
          .maybeSingle()
      : { data: null };
    return {
      request,
      result: latest,
      documents: documents.data ?? [],
      reviews: reviews.data ?? [],
      audit: audit.data ?? [],
      evidence: evidence.data ?? [],
      record: record.data,
    };
  });
export const submitVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("Invalid submission.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !allowed) throw new Error("Administrator MFA required.");
    const facts = submissionSchema.parse(JSON.parse(String(data.get("facts") || "{}")));
    const files: { file: File; kind: "certificate" | "supporting" }[] = [
      ...data
        .getAll("certificate")
        .filter((f): f is File => f instanceof File && f.size > 0)
        .map((file) => ({ file, kind: "certificate" as const })),
      ...data
        .getAll("supporting")
        .filter((f): f is File => f instanceof File && f.size > 0)
        .map((file) => ({ file, kind: "supporting" as const })),
    ];
    if (files.length > 4) throw new Error("Upload no more than four documents.");
    const validated = [];
    for (const { file, kind } of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = validateDocument(bytes, file.type);
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      validated.push({ file, kind, bytes, mime, hash });
    }
    let ownerId = context.userId;
    if (facts.listing_id) {
      const { data: listing, error } = await context.supabase
        .from("ip_listings")
        .select("owner_id")
        .eq("id", facts.listing_id)
        .single();
      if (error || !listing) throw new Error("Listing not found or access denied.");
      ownerId = listing.owner_id;
    }
    const { data: request, error } = await context.supabase
      .from("ip_verification_requests")
      .insert({
        ...facts,
        certificate_number: facts.certificate_number || null,
        ip_title: facts.ip_title || null,
        application_date: facts.application_date || null,
        claimed_registration_date: facts.claimed_registration_date || null,
        user_id: ownerId,
        normalized_registration_number: normalizeNumber(facts.registration_number),
      })
      .select("*")
      .single();
    if (error || !request) throw new Error(error?.message || "Could not submit verification.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      for (const item of validated) {
        const path = `${ownerId}/requests/${request.id}/${item.kind}-${crypto.randomUUID()}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from("ip-verification-private")
          .upload(path, item.bytes, { contentType: item.mime });
        if (uploadError) throw uploadError;
        const { error: docError } = await supabaseAdmin
          .from("ip_verification_documents")
          .insert({
            verification_request_id: request.id,
            document_type: item.kind,
            storage_path: path,
            original_filename: item.file.name,
            mime_type: item.mime,
            file_size: item.file.size,
            sha256_hash: item.hash,
            uploaded_by: context.userId,
          });
        if (docError) throw docError;
      }
      const { error: auditError } = await supabaseAdmin
        .from("ip_verification_audit_logs")
        .insert({
          verification_request_id: request.id,
          actor_id: context.userId,
          action: "verification.submitted",
          details: { document_count: validated.length },
        });
      if (auditError) throw auditError;
      await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: ownerId,
          kind: "ip_verification",
          title: "IP verification submitted",
          body: `Reference ${request.verification_reference}`,
          listing_id: request.listing_id,
        });
      return { id: request.id };
    } catch (error) {
      await supabaseAdmin
        .from("ip_verification_requests")
        .update({
          submission_status: "failed",
          processing_error: "Submission documents could not all be stored.",
        })
        .eq("id", request.id);
      throw error;
    }
  });

const certificateSchema = ownershipDetailsSchema;
export const runVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!allowed) throw new Error("Administrator MFA required.");
    const { data: request, error: requestError } = await context.supabase
      .from("ip_verification_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (requestError || !request) throw new Error("Verification not found or access denied.");
    const { data: claimed, error: claimError } = await context.supabase.rpc(
      "claim_ip_verification",
      { p_id: data.id },
    );
    if (claimError || !claimed)
      throw new Error("This request is already processed, reviewed or currently running.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const { data: journals } = await context.supabase
        .from("kipi_journals")
        .select(
          "id,journal_title,publication_year,processed_pages,processing_status,last_synced_at",
        );
      const pages = journals?.reduce((n, j) => n + j.processed_pages, 0) ?? 0;
      const { data: records, error: searchError } = await context.supabase
        .from("kipi_ip_records")
        .select("*")
        .eq("ip_category", request.ip_category)
        .eq("normalized_registration_number", request.normalized_registration_number)
        .order("extraction_confidence", { ascending: false })
        .limit(20);
      if (searchError) throw searchError;
      const record = records?.[0] ?? null;
      const { data: documents } = await context.supabase
        .from("ip_verification_documents")
        .select("*")
        .eq("verification_request_id", request.id)
        .eq("document_type", "certificate");
      const certificate = documents?.[0];
      let fields: z.infer<typeof certificateSchema> | undefined;
      if (certificate) {
        const { data: blob, error } = await context.supabase.storage
          .from("ip-verification-private")
          .download(certificate.storage_path);
        if (error || !blob) throw new Error("Could not read your certificate.");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        validateDocument(bytes, certificate.mime_type);
        const { generateResponse } = await import("@lovable.dev/ai-gateway");
        const base64 = Buffer.from(bytes).toString("base64");
        const response = await generateResponse({
          model: "openai/gpt-6-astra",
          reasoning: { effort: "medium" },
          input: [
            { role: "system", content: printedOwnershipRules },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: "Return JSON with is_certificate, registration_number, owner_name, certificate_number, title, issuing_office, document_language, jurisdiction, filing_date, grant_date, expiry_date, quality (0–100 legibility, not authenticity), summary. No external verification has been performed.",
                },
                certificate.mime_type === "application/pdf"
                  ? {
                      type: "input_file",
                      filename: certificate.original_filename,
                      file_data: `data:application/pdf;base64,${base64}`,
                    }
                  : {
                      type: "input_image",
                      detail: "auto",
                      image_url: `data:${certificate.mime_type};base64,${base64}`,
                    },
              ],
            },
          ],
          text: { format: { type: "json_object" } },
        });
        let text = "";
        for (const item of response.output ?? []) {
          if (item.type !== "message") continue;
          for (const part of item.content) {
            if (part.type === "refusal")
              throw new Error(
                "The AI declined to extract this certificate. Manual review is required.",
              );
            if (part.type === "output_text") text += part.text;
          }
        }
        fields = certificateSchema.parse(JSON.parse(text));
        const { error: extractError } = await supabaseAdmin
          .from("ip_verification_documents")
          .update({ extracted_fields: fields })
          .eq("id", certificate.id);
        if (extractError) throw new Error("Could not save the extracted ownership details.");
      }
      const assessment = compareEvidence(request, record, pages, fields);
      if (
        fields?.certificate_number &&
        request.certificate_number &&
        normalizeNumber(fields.certificate_number) !== normalizeNumber(request.certificate_number)
      ) {
        assessment.comparisons.push({
          field: "Certificate identifier",
          submitted: request.certificate_number,
          official: fields.certificate_number,
          outcome: "different",
        });
        assessment.status = "DISCREPANCY_DETECTED";
      }
      if (certificate) {
        const { count } = await supabaseAdmin
          .from("ip_verification_documents")
          .select("id", { count: "exact", head: true })
          .eq("sha256_hash", certificate.sha256_hash)
          .neq("verification_request_id", request.id);
        if (count)
          assessment.risks.push(
            "The same document fingerprint occurs in another submission. This is a review indicator, not proof of fraud.",
          );
      }
      const coverage = {
        from_year: 2008,
        indexed_pages: pages,
        journals_indexed:
          journals
            ?.filter((j) => j.processed_pages > 0)
            .map((j) => ({
              title: j.journal_title,
              year: j.publication_year,
              pages: j.processed_pages,
            })) ?? [],
        complete: false,
      };
      const summary = record
        ? `An exact normalized number matched an official publication passage. ${assessment.risks.join(" ")}`
        : assessment.risks.join(" ");
      const { data: result, error } = await supabaseAdmin
        .from("ip_verification_results")
        .insert({
          verification_request_id: request.id,
          matched_record_id: record?.id ?? null,
          result_status: assessment.status,
          record_match: Boolean(record),
          certificate_consistency: fields
            ? assessment.comparisons.some(
                (c) => c.field.startsWith("Certificate") && c.outcome === "different",
              )
              ? "discrepancy"
              : "extracted_not_authenticated"
            : "not_uploaded",
          registration_status: record?.recorded_status ?? "unconfirmed",
          field_comparison: assessment.comparisons,
          risk_indicators: assessment.risks,
          evidence_summary: summary,
          evidence_completeness: assessment.completeness,
          ai_model: fields ? "openai/gpt-6-astra" : null,
          coverage_snapshot: coverage,
        })
        .select("*")
        .single();
      if (error || !result) throw new Error(error?.message || "Could not save assessment.");
      if (record) {
        const { data: journal } = await context.supabase
          .from("kipi_journals")
          .select("journal_title,source_url")
          .eq("id", record.journal_id)
          .single();
        if (journal) {
          const { error: evidenceError } = await supabaseAdmin
            .from("ip_verification_evidence")
            .insert({
              verification_result_id: result.id,
              source_type: "official_kipi_journal",
              source_title: journal.journal_title,
              source_url: journal.source_url,
              journal_id: record.journal_id,
              page_number: record.source_page_number,
              supporting_extract: record.extracted_text.slice(0, 1500),
              evidence_hash: record.record_hash,
            });
          if (evidenceError) throw evidenceError;
        }
      }
      const { error: updateError } = await supabaseAdmin
        .from("ip_verification_requests")
        .update({
          verification_status: assessment.status,
          submission_status: "completed",
          completed_at: new Date().toISOString(),
          lease_until: null,
          processing_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);
      if (updateError) throw updateError;
      await supabaseAdmin
        .from("ip_verification_audit_logs")
        .insert({
          verification_request_id: request.id,
          actor_id: context.userId,
          action: "verification.assessed",
          details: { result: assessment.status, indexed_pages: pages },
        });
      await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: request.user_id,
          kind: "ip_verification",
          title: "IP verification assessment ready",
          body: `${request.verification_reference}: ${assessment.status.replace(/_/g, " ")}`,
          listing_id: request.listing_id,
        });
      return { status: assessment.status };
    } catch (error) {
      await supabaseAdmin
        .from("ip_verification_requests")
        .update({
          submission_status: "failed",
          lease_until: null,
          processing_error: error instanceof Error ? error.message : "Assessment failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);
      throw error;
    }
  });
export const reviewVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum([
          "approve",
          "reject",
          "needs_documents",
          "kipi_confirmation",
          "inconclusive",
          "reopen",
        ]),
        notes: z.string().trim().min(3).max(3000),
        confirmationUrl: z.string().url().optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !allowed || context.claims.aal !== "aal2")
      throw new Error(
        "Confirm your administrator sign-in with an authenticator code before reviewing IP verification.",
      );
    const { error } = await context.supabase.rpc("review_ip_verification", {
      p_id: data.id,
      p_decision: data.decision,
      p_notes: data.notes,
      p_confirmation_url: data.confirmationUrl || undefined,
    });
    if (error) throw error;
    return { saved: true };
  });
export const downloadVerificationReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: request } = await context.supabase
      .from("ip_verification_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!request) throw new Error("Report not found or access denied.");
    const { data: result } = await context.supabase
      .from("ip_verification_results")
      .select("*")
      .eq("verification_request_id", data.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();
    if (!result) throw new Error("Run the assessment before downloading a report.");
    const { data: evidence } = await context.supabase
      .from("ip_verification_evidence")
      .select("*")
      .eq("verification_result_id", result.id);
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595, 842]),
      y = 790;
    const write = (value: string, strong = false) => {
      const safe = value.normalize("NFKD").replace(/[^\x20-\x7E\n]/g, "?");
      for (const paragraph of safe.split("\n")) {
        let line = "";
        for (const word of paragraph.split(" ")) {
          if (font.widthOfTextAtSize(`${line} ${word}`, 10) > 485) {
            if (y < 65) {
              page = pdf.addPage([595, 842]);
              y = 790;
            }
            page.drawText(line, { x: 50, y, size: 10, font: strong ? bold : font });
            y -= 16;
            line = word;
          } else line = line ? `${line} ${word}` : word;
        }
        if (y < 65) {
          page = pdf.addPage([595, 842]);
          y = 790;
        }
        page.drawText(line, { x: 50, y, size: 10, font: strong ? bold : font });
        y -= 20;
      }
    };
    write("IP AFRICA EXCHANGE", true);
    write("INTELLECTUAL PROPERTY EVIDENCE VERIFICATION REPORT", true);
    write(`Reference: ${request.verification_reference}`);
    write(`Generated: ${new Date().toISOString()}`);
    write(`IP category: ${request.ip_category}`);
    write(`Number: ${request.registration_number}`);
    write(`Applicant: ${request.applicant_name}`);
    write(`Title: ${request.ip_title || "Not supplied"}`);
    write(`AI / evidence assessment: ${result.result_status}`);
    write(`Administrator decision: ${request.administrator_decision || "Not reviewed"}`);
    write(`Certificate authenticity: ${result.certificate_authenticity}`);
    write(`Recorded status: ${result.registration_status}`);
    write(result.evidence_summary);
    write("FIELD COMPARISONS", true);
    for (const item of Array.isArray(result.field_comparison) ? result.field_comparison : []) {
      if (item && typeof item === "object" && !Array.isArray(item))
        write(
          `${item.field}: ${item.submitted || "Not supplied"} / ${item.official || "Unconfirmed"} (${item.outcome})`,
        );
    }
    write("OFFICIAL EVIDENCE", true);
    for (const e of evidence ?? []) {
      write(`${e.source_title}, PDF page ${e.page_number}`);
      write(e.source_url);
      write(e.supporting_extract.slice(0, 700));
    }
    write("COVERAGE AND LIMITATIONS", true);
    write(JSON.stringify(result.coverage_snapshot));
    write(reportDisclaimer);
    const bytes = await pdf.save();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const reportPath = `${request.user_id}/reports/${request.id}/${result.id}.pdf`;
    const { error: saveError } = await supabaseAdmin.storage
      .from("ip-verification-private")
      .upload(reportPath, bytes, { contentType: "application/pdf", upsert: true });
    if (saveError) throw new Error("Could not securely save the report.");
    const { error: pathError } = await supabaseAdmin
      .from("ip_verification_results")
      .update({ report_path: reportPath })
      .eq("id", result.id);
    if (pathError) throw pathError;
    return {
      base64: Buffer.from(bytes).toString("base64"),
      filename: `${request.verification_reference}.pdf`,
    };
  });
