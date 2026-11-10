import { describe, expect, it } from "bun:test";
import { postSignInDestination } from "../src/lib/auth-destinations";

describe("sign-in continuations", () => {
  it("returns verification submissions to their form", () => {
    expect(postSignInDestination("verify-ip")).toEqual({ to: "/verification/new", search: { listing: undefined } });
  });
  it("returns verification history requests to their private history", () => {
    expect(postSignInDestination("verification-history")).toEqual({ to: "/verification/history" });
  });
  it("returns service submissions to their form", () => {
    expect(postSignInDestination("list-service")).toEqual({ to: "/services/new" });
  });
  it("never follows an unrecognised or external destination", () => {
    for (const next of [undefined, "https://example.com", "//example.com", "/admin", "unknown"]) {
      expect(postSignInDestination(next)).toEqual({ to: "/dashboard" });
    }
  });
});