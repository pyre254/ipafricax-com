import { describe, expect, test } from "bun:test";
import { validateResetPassword } from "../src/lib/password-recovery";

describe("password recovery validation", () => {
  test("requires the same eight-character minimum as existing accounts", () => {
    expect(validateResetPassword("Ab12!xy", "Ab12!xy")).not.toBeNull();
    expect(validateResetPassword("Ab12!xyz", "Ab12!xyz")).toBeNull();
  });
  test("requires matching confirmation", () => {
    expect(validateResetPassword("Ab12!xyz", "Ab12!xyZ")).not.toBeNull();
    expect(validateResetPassword("Ab12!xyz", "Ab12!xyz")).toBeNull();
  });
});