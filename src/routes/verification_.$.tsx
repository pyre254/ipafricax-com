import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/verification_/$")({
  head: () => pageMeta("Verification tools moved", "IP verification tools are now available inside protected Admin."),
  beforeLoad: () => { throw redirect({ to: "/admin/ip-verification", statusCode: 301 }); },
});