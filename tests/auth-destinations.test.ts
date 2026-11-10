import { describe, expect, it } from "bun:test";
import { postSignInDestination } from "../src/lib/auth-destinations";

describe("sign-in continuations", () => {
  it("returns administrator verification requests to Admin", () => {
    expect(postSignInDestination("admin-verification")).toEqual({ to: "/admin/ip-verification" });
  });
  it("ordinary verification continuations no longer open verification tools", () => {
    expect(postSignInDestination("verification-history")).toEqual({ to: "/dashboard" });
    expect(postSignInDestination("verify-ip")).toEqual({ to: "/dashboard" });
  });
  it("returns legacy professional sign-ins to their account profile, not the removed Services page", () => {
    expect(postSignInDestination("list-service")).toEqual({ to: "/profile" });
  });
  it("never follows an unrecognised or external destination", () => {
    for (const next of [undefined, "https://example.com", "//example.com", "/admin", "unknown"]) {
      expect(postSignInDestination(next)).toEqual({ to: "/dashboard" });
    }
  });
});