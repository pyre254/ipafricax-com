export const authDestinations = ["admin-verification", "list-service"] as const;

// Only known in-app destinations may continue after sign-in.
export function postSignInDestination(next: unknown) {
  switch (next) {
    case "admin-verification":
      return { to: "/admin/ip-verification" as const };
    case "list-service":
      return { to: "/profile" as const };
    default:
      return { to: "/dashboard" as const };
  }
}