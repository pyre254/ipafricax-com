import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/services_/new")({
  head: () => pageMeta("Professional account registration", "Join IP Africa Exchange as an IP valuer, lawyer, patent agent or consultant."),
  beforeLoad: () => {
    throw redirect({ to: "/auth", search: { mode: "signup" }, replace: true });
  },
});