import { requireVerificationAdministrator } from "@/components/admin-verification-access";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Download,
  FileSearch,
  Loader2,
  ShieldCheck,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import {
  getVerification,
  runVerification,
  reviewVerification,
  downloadVerificationReport,
} from "@/lib/ip-verification.functions";
import { pageMeta } from "@/lib/page-meta";
import { reportDisclaimer } from "@/lib/ip-verification";
import { useAuth } from "@/lib/auth";
import { VerificationHeader, VerificationStatus } from "@/components/verification-ui";
import { PrivateDocument } from "@/components/private-document";
import { AdminMfaGate } from "@/components/admin-mfa-gate";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
const detailOptions = (id: string) =>
  queryOptions({
    queryKey: ["verification-detail", id],
    queryFn: () => getVerification({ data: { id } }),
  });
export const Route = createFileRoute("/_authenticated/admin_/ip-verification_/$id")({
  head: () =>
    pageMeta(
      "IP verification report",
      "Private evidence comparisons, journal citations and administrator decisions.",
    ),
  beforeLoad: requireVerificationAdministrator,
  component: Detail,
});
function Detail() {
  const { id } = Route.useParams();
  return (
    <AdminMfaGate>
      <Report id={id} />
    </AdminMfaGate>
  );
}
function Report({ id }: { id: string }) {
  const { data } = useSuspenseQuery(detailOptions(id));
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const run = useServerFn(runVerification),
    review = useServerFn(reviewVerification),
    download = useServerFn(downloadVerificationReport);
  const [busy, setBusy] = useState(false),
    [notes, setNotes] = useState(""),
    [decision, setDecision] = useState<
      "approve" | "reject" | "needs_documents" | "kipi_confirmation" | "inconclusive" | "reopen"
    >("inconclusive");
  const request = data.request;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["verification-detail", id] });
  return (
    <>
      <VerificationHeader
        title="IP verification report"
        subtitle={request.verification_reference}
        action={false}
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <VerificationStatus status={request.verification_status} />
            <p className="mt-2 text-xs text-muted-foreground">
              Submitted {new Date(request.created_at).toLocaleString()} ·{" "}
              {request.submission_status.replace(/_/g, " ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["submitted", "failed"].includes(request.submission_status) && (
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await run({ data: { id } });
                    toast.success("Evidence assessment saved.");
                    await refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Assessment failed.");
                    await refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <Loader2 className="animate-spin" /> : <FileSearch />}
                {busy ? "Checking evidence…" : "Run evidence check"}
              </Button>
            )}
            {data.result && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const report = await download({ data: { id } });
                    const bytes = Uint8Array.from(atob(report.base64), (c) => c.charCodeAt(0));
                    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = report.filename;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Report unavailable.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Download />
                Download PDF
              </Button>
            )}
          </div>
        </div>
        {request.processing_error && (
          <p className="mt-5 border-l-2 border-destructive bg-destructive/5 p-4 text-sm text-destructive">
            {request.processing_error}
          </p>
        )}
        <div className="mt-7 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <h2 className="text-xl font-semibold">Submitted IP details</h2>
            <dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {[
                ["Category", request.ip_category.replace(/_/g, " ")],
                ["Registration / application number", request.registration_number],
                ["Applicant / proprietor", request.applicant_name],
                ["Title", request.ip_title],
                ["Certificate identifier", request.certificate_number],
                ["Claimed grant date", request.claimed_registration_date],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-medium">
                    {value || "Not supplied"}
                  </dd>
                </div>
              ))}
            </dl>
            {data.result && (
              <>
                <h2 className="mt-9 text-xl font-semibold">Evidence assessment</h2>
                <div className="mt-3 flex flex-wrap gap-3">
                  <VerificationStatus status={data.result.result_status} />
                  <span className="text-xs text-muted-foreground">
                    {data.result.ai_model
                      ? "Certificate extracted with AI"
                      : "Number-only evidence comparison"}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed">{data.result.evidence_summary}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Evidence completeness: {data.result.evidence_completeness}/100 · not an
                  authenticity probability
                </p>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-y border-border text-xs text-muted-foreground">
                      <tr>
                        {["Field", "Submitted", "Evidence", "Result"].map((h) => (
                          <th key={h} className="px-2 py-3 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(Array.isArray(data.result.field_comparison)
                        ? data.result.field_comparison
                        : []
                      ).map((c, i) =>
                        c && typeof c === "object" && !Array.isArray(c) ? (
                          <tr key={i}>
                            <td className="px-2 py-3">{String(c.field)}</td>
                            <td className="max-w-52 break-words px-2 py-3">
                              {String(c.submitted || "—")}
                            </td>
                            <td className="max-w-52 break-words px-2 py-3">
                              {String(c.official || "Unconfirmed")}
                            </td>
                            <td className="px-2 py-3 text-xs">{String(c.outcome)}</td>
                          </tr>
                        ) : null,
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {data.evidence.length > 0 && (
              <>
                <h2 className="mt-9 text-xl font-semibold">Official journal evidence</h2>
                {data.evidence.map((e) => (
                  <div key={e.id} className="mt-4 border-l-2 border-primary pl-4">
                    <a
                      href={e.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm font-semibold text-primary"
                    >
                      {e.source_title}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Physical PDF page {e.page_number} · official KIPI publication
                    </p>
                    <blockquote className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {e.supporting_extract}
                    </blockquote>
                  </div>
                ))}
              </>
            )}
          </div>
          <aside>
            <h2 className="text-lg font-semibold">Private documents</h2>
            <div className="mt-4 space-y-4">
              {data.documents.length ? (
                data.documents.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border bg-card p-4">
                    <PrivateDocument
                      bucket="ip-verification-private"
                      path={d.storage_path}
                      label={d.original_filename}
                    />
                    <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">
                      SHA-256 {d.sha256_hash}
                    </p>
                    {d.extracted_fields &&
                      typeof d.extracted_fields === "object" &&
                      !Array.isArray(d.extracted_fields) && (
                        <dl className="mt-4 space-y-3">
                          {[
                            ["Printed proprietor", "owner_name"],
                            ["Registration number", "registration_number"],
                            ["Certificate number", "certificate_number"],
                            ["Issuing office", "issuing_office"],
                            ["Jurisdiction", "jurisdiction"],
                            ["Filing date", "filing_date"],
                            ["Grant date", "grant_date"],
                            ["Printed expiry", "expiry_date"],
                          ].map(([label, key]) => (
                            <div key={key}>
                              <dt className="text-xs text-muted-foreground">{label}</dt>
                              <dd className="mt-1 break-words text-sm">
                                {d.extracted_fields &&
                                typeof d.extracted_fields === "object" &&
                                !Array.isArray(d.extracted_fields)
                                  ? String(d.extracted_fields[key] || "Not printed / unreadable")
                                  : "—"}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Number-only submission; no certificate uploaded.
                </p>
              )}
            </div>
            <div className="mt-7 border-t border-border pt-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Administrator decision
              </h2>
              <p className="mt-3 text-sm">
                {request.administrator_decision?.replace(/_/g, " ") || "Not yet reviewed"}
              </p>
              {request.administrator_notes && (
                <p className="mt-2 text-sm text-muted-foreground">{request.administrator_notes}</p>
              )}
              {hasRole("admin") && user?.id !== request.user_id && (
                <form
                  className="mt-5 space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    try {
                      await review({ data: { id, decision, notes } });
                      window.__lovableEvents?.track?.("project.verification_reviewed_v2", {
                        decision,
                        asset_category: request.ip_category,
                      });
                      await Promise.all([
                        queryClient.invalidateQueries({ queryKey: ["admin-verifications"] }),
                        queryClient.invalidateQueries({ queryKey: ["verifications"] }),
                      ]);
                      toast.success("Review decision recorded.");
                      await refresh();
                    } catch (error) {
                      toast.error(
                        error instanceof Error ? error.message : "Could not save decision.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label className="block text-xs text-muted-foreground" htmlFor="decision">
                    Decision
                  </label>
                  <select
                    id="decision"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value as typeof decision)}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    {[
                      ["approve", "Approve matched publication"],
                      ["reject", "Reject"],
                      ["needs_documents", "Request more documents"],
                      ["kipi_confirmation", "Request direct KIPI confirmation"],
                      ["inconclusive", "Mark inconclusive"],
                      ["reopen", "Reopen assessment"],
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="review-notes" className="block text-xs text-muted-foreground">
                    Review notes (required)
                  </label>
                  <textarea
                    id="review-notes"
                    required
                    minLength={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-24 w-full rounded-md border border-input bg-card p-3 text-sm"
                  />
                  <Button disabled={busy} type="submit">
                    Record decision
                  </Button>
                </form>
              )}
            </div>
          </aside>
        </div>
        <div className="mt-10 border-t border-border pt-6">
          <h2 className="text-lg font-semibold">Audit history</h2>
          <div className="mt-4 divide-y divide-border">
            {data.audit.map((a) => (
              <div key={a.id} className="flex flex-wrap justify-between gap-3 py-3 text-xs">
                <span>{a.action.replace(/\./g, " · ").replace(/_/g, " ")}</span>
                <time className="text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </time>
              </div>
            ))}
          </div>
          <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {reportDisclaimer}
          </p>
        </div>
      </main>
    </>
  );
}
