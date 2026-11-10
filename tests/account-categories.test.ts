import { describe, expect, it } from "bun:test";
import { accountCategoryGroups } from "../src/lib/account-categories";

describe("professional account categories", () => {
  const categories = accountCategoryGroups.flatMap((group) => [...group.options]);

  for (const profession of ["ip_valuer", "lawyer", "patent_agent", "consultant", "other"]) {
    it(`includes ${profession} in the shared registration/profile categories`, () => {
      expect(categories.filter((category) => category.value === profession)).toHaveLength(1);
    });
  }
});