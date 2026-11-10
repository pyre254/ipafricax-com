import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageMeta } from "@/lib/page-meta";
export const Route = createFileRoute("/verification")({
 head: () => pageMeta("IP verification moved", "IP verification is available to authorized administrators in Admin."),
 beforeLoad: () => { throw redirect({ to: "/admin/ip-verification", statusCode: 301 }); },
});
