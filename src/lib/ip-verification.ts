import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export const KIPI_START_YEAR = 2008;
export const KIPI_SOURCE = "https://www.kipi.go.ke/ip-journal";
export const MAX_CERTIFICATE_BYTES = 10 * 1024 * 1024;
export const categories = [
  { value: "patent", label: "Patent", authority: "KIPI" },
  { value: "utility_model", label: "Utility model", authority: "KIPI" },
  { value: "industrial_design", label: "Industrial design", authority: "KIPI" },
  { value: "trademark", label: "Trademark", authority: "KIPI" },
  { value: "copyright", label: "Copyright", authority: "KECOBO" },
  { value: "trade_secret", label: "Know-how / trade secret", authority: "Manual review" },
] as const;
export const resultLabels: Record<string, string> = {
  VERIFIED: "Verified", PARTIALLY_VERIFIED: "Partially verified",
  DISCREPANCY_DETECTED: "Discrepancy detected", NOT_FOUND: "Not found in indexed sources",
  MANUAL_REVIEW_REQUIRED: "Manual verification required",
};
export const reportDisclaimer = "This report represents an evidence-based assessment of information available from the cited sources at the time of verification. A KIPI journal match does not independently authenticate an uploaded certificate or establish current legal ownership. Final legal status and certificate authenticity may require direct confirmation from KIPI.";
export function normalizeNumber(value: string) { return value.normalize("NFKC").toUpperCase().replace(/[\s\-\/\.]/g, ""); }
export function comparableName(value: string) { return value.normalize("NFKC").toUpperCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim(); }
export function officialFileUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !["kipi.go.ke", "www.kipi.go.ke"].includes(url.hostname) || url.port || url.username || url.password || !url.pathname.startsWith("/sites/default/files/")) throw new Error("An official KIPI document URL is required.");
  return url.href;
}
export function validateDocument(bytes: Uint8Array, claimedMime: string) {
  if (!bytes.length || bytes.length > MAX_CERTIFICATE_BYTES) throw new Error("Documents must be between 1 byte and 10 MB.");
  const pdf = new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  const png = [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n);
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const mime = pdf ? "application/pdf" : png ? "image/png" : jpg ? "image/jpeg" : null;
  if (!mime || mime !== claimedMime) throw new Error("The document signature must match PDF, JPG or PNG format.");
  return mime;
}
export const submissionSchema = z.object({
  ip_category: z.enum(["patent","utility_model","industrial_design","trademark","copyright","trade_secret"]),
  registration_number: z.string().trim().min(1).max(120), applicant_name: z.string().trim().min(2).max(250),
  certificate_number: z.string().trim().max(120).optional(), ip_title: z.string().trim().max(500).optional(),
  application_date: z.string().date().optional().or(z.literal("")), claimed_registration_date: z.string().date().optional().or(z.literal("")),
  listing_id: z.string().uuid().optional(), declared_authorized: z.literal(true),
});
export type RequestRow = Database["public"]["Tables"]["ip_verification_requests"]["Row"];
export type ResultRow = Database["public"]["Tables"]["ip_verification_results"]["Row"];
export type JournalRow = Database["public"]["Tables"]["kipi_journals"]["Row"];
export type RecordRow = Database["public"]["Tables"]["kipi_ip_records"]["Row"];
export type Comparison = { field: string; submitted: string | null; official: string | null; outcome: "match" | "different" | "unconfirmed" };
export function compareEvidence(request: Pick<RequestRow,"registration_number"|"applicant_name"|"ip_title"|"claimed_registration_date"|"ip_category">, record: RecordRow | null, indexedPages: number, certificate?: { registration_number?: string | null; owner_name?: string | null; certificate_number?: string | null; expiry_date?: string | null; quality?: number }, today = new Date().toISOString().slice(0,10)) {
  const comparisons: Comparison[] = [];
  const risks: string[] = [];
  if (["copyright","trade_secret"].includes(request.ip_category)) return { status: "MANUAL_REVIEW_REQUIRED", comparisons, risks: [request.ip_category === "copyright" ? "Refer copyright to KECOBO; KIPI journal evidence does not apply." : "Trade secrets require confidential manual review."], completeness: 0 };
  if (!record) return { status: indexedPages > 0 ? "NOT_FOUND" : "MANUAL_REVIEW_REQUIRED", comparisons, risks: [indexedPages > 0 ? "No exact record in the indexed pages. Historical coverage is incomplete; this is not proof of fraud or nonexistence." : "No official journal pages have been indexed yet."], completeness: 0 };
  comparisons.push({ field: "Registration / application number", submitted: request.registration_number, official: record.original_registration_number, outcome: normalizeNumber(request.registration_number) === record.normalized_registration_number ? "match" : "different" });
  const name = record.proprietor_name || record.applicant_name;
  comparisons.push({ field: "Applicant / proprietor", submitted: request.applicant_name, official: name, outcome: !name ? "unconfirmed" : comparableName(name) === comparableName(request.applicant_name) ? "match" : "different" });
  if (request.ip_title) comparisons.push({ field: "IP title", submitted: request.ip_title, official: record.ip_title, outcome: !record.ip_title ? "unconfirmed" : comparableName(request.ip_title) === comparableName(record.ip_title) ? "match" : "different" });
  if (request.claimed_registration_date) comparisons.push({ field: "Claimed grant / registration date", submitted: request.claimed_registration_date, official: record.registration_date, outcome: !record.registration_date ? "unconfirmed" : request.claimed_registration_date === record.registration_date ? "match" : "different" });
  if (certificate?.registration_number) comparisons.push({ field: "Certificate number vs submitted IP number", submitted: certificate.registration_number, official: request.registration_number, outcome: normalizeNumber(certificate.registration_number) === normalizeNumber(request.registration_number) ? "match" : "different" });
  if (certificate?.owner_name) comparisons.push({ field: "Certificate proprietor vs submitted proprietor", submitted: certificate.owner_name, official: request.applicant_name, outcome: comparableName(certificate.owner_name) === comparableName(request.applicant_name) ? "match" : "different" });
  if (certificate?.expiry_date && certificate.expiry_date < today) risks.push("The certificate's printed expiry date has passed; current renewal status is unconfirmed.");
  if (!record.registration_date) risks.push("Publication does not establish grant or registration; direct KIPI confirmation may be needed.");
  risks.push("Certificate authenticity and current ownership are not independently confirmed by journal evidence.");
  const poor = record.extraction_confidence < 60 || (certificate?.quality !== undefined && certificate.quality < 60);
  if (poor) risks.push("Extraction quality requires manual review.");
  const status = poor ? "MANUAL_REVIEW_REQUIRED" : comparisons.some(c => c.outcome === "different") ? "DISCREPANCY_DETECTED" : "PARTIALLY_VERIFIED";
  return { status, comparisons, risks, completeness: Math.round(comparisons.filter(c => c.outcome === "match").length / Math.max(comparisons.length + 2, 1) * 100) };
}