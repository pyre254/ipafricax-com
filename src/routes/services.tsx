import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/services")({
  head: () => pageMeta("Professional accounts", "IP professionals register through IP Africa Exchange account creation."),
  beforeLoad: () => {
    throw redirect({ to: "/auth", search: { mode: "signup" }, replace: true });
  },
});
