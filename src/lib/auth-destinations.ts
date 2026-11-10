export const authDestinations = ["verify-ip", "verification-history", "list-service"] as const;

// Only known in-app destinations may continue after sign-in.
export function postSignInDestination(next: unknown) {
  switch (next) {
    case "verify-ip":
      return { to: "/verification/new" as const, search: { listing: undefined } };
    case "verification-history":
      return { to: "/verification/history" as const };
    case "list-service":
      return { to: "/services/new" as const };
    default:
      return { to: "/dashboard" as const };
  }
}