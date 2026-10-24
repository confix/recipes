import { describe, expect, it } from "vitest";

import { safeNext } from "./safe-next";

const BASE = "https://recipes.example/login";

describe("safeNext", () => {
  it("keeps same-origin paths with their query", () => {
    expect(safeNext("/authorize?client_id=a&state=b", BASE)).toBe(
      "/authorize?client_id=a&state=b",
    );
  });

  it("rejects other origins, however they are spelled", () => {
    for (const next of [
      "https://evil.example/",
      "//evil.example/",
      "/\\evil.example/",
      "\\\\evil.example",
      "javascript:alert(1)",
    ]) {
      expect(safeNext(next, BASE)).toBe("/");
    }
  });
});
