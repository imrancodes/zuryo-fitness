import { describe, expect, test } from "bun:test";
import { safeRedirect } from "@/lib/redirect";

describe("safeRedirect", () => {
  test("keeps paths inside the user's own area", () => {
    expect(safeRedirect("/customer/book?slot=1", "customer")).toBe("/customer/book?slot=1");
  });

  test.each(["//evil.com", "https://evil.com", "/\\evil.com", "/admin", "/customerx", "", null])(
    "falls back to the role home for %p",
    (next) => {
      expect(safeRedirect(next, "customer")).toBe("/customer");
    }
  );
});
