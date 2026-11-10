import { Link } from "@tanstack/react-router";
import { ArrowUpRight, FileSearch, ShieldCheck, History, LibraryBig, ArrowLeft } from "lucide-react";
import { resultLabels, KIPI_SOURCE, type RequestRow } from "@/lib/ip-verification";
import { Button } from "./ui/button";

export function VerificationHeader({ title, subtitle, action = true }: { title: string; subtitle: string; action?: boolean }) {
  return <div className="border-b border-border bg-card"><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><ShieldCheck className="h-4 w-4" />Independent evidence review · Kenya</p>
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div className="min-w-0"><h1 className="font-display text-2xl font-semibold sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p></div>
      {action && <Button asChild><Link to="/admin/ip-verification/new" search={{ listing: undefined }}><FileSearch />Verify an IP asset</Link></Button>}
    </div>
    <nav aria-label="Verification navigation" className="mt-7 flex flex-wrap gap-5 text-sm">
      <Link to="/admin" className="flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Admin</Link>
      <Link to="/admin/ip-verification" activeProps={{ className: "text-primary" }} activeOptions={{ exact: true }} className="flex items-center gap-2"><LibraryBig className="h-4 w-4" />Verification & journals</Link>
      <Link to="/admin/ip-verification/history" className="flex items-center gap-2"><History className="h-4 w-4" />Verification history</Link>
      <a href={KIPI_SOURCE} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-muted-foreground">KIPI source<ArrowUpRight className="h-4 w-4" /></a>
    </nav>
  </div></div>;
}
export function VerificationStatus({status}:{status:string}){const tone=status==="VERIFIED"?"border-primary/30 bg-primary/10 text-primary":status==="DISCREPANCY_DETECTED"?"border-destructive/30 bg-destructive/10 text-destructive":status==="PARTIALLY_VERIFIED"?"border-accent/40 bg-accent/10 text-accent-foreground":"border-border bg-muted text-muted-foreground";return <span className={`inline-flex max-w-full items-center rounded-md border px-2 py-1 text-xs font-medium ${tone}`}>{resultLabels[status]||status.replace(/_/g," ")}</span>;}
export function VerificationRows({rows}:{rows:RequestRow[]}){if(!rows.length)return <div className="border-y border-dashed border-border py-14 text-center"><FileSearch className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><p className="text-sm text-muted-foreground">No verification requests yet.</p></div>;return <div className="divide-y divide-border">{rows.map(row=><Link key={row.id} to="/admin/ip-verification/$id" params={{id:row.id}} className="flex flex-wrap items-center justify-between gap-4 py-5"><div className="min-w-0"><p className="text-xs font-mono text-muted-foreground">{row.verification_reference}</p><p className="mt-1 break-words font-semibold">{row.registration_number}</p><p className="mt-1 text-xs text-muted-foreground">{row.applicant_name} · {row.ip_category.replace(/_/g," ")} · {new Date(row.created_at).toLocaleDateString()}</p></div><VerificationStatus status={row.verification_status}/></Link>)}</div>;}