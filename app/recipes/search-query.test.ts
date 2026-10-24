import { describe, expect, it } from "vitest";

import { ftsQuery } from "./search-query";

describe("ftsQuery", () => {
  it("quotes and prefixes every term", () => {
    expect(ftsQuery("Tomato  soup")).toBe('"tomato"* "soup"*');
    expect(ftsQuery("tomato soup", "any")).toBe('"tomato"* OR "soup"*');
  });

  it("strips FTS syntax so input cannot inject operators", () => {
    expect(ftsQuery('title:"x" OR NEAR(a b) *')).toBe(
      '"title"* "x"* "or"* "near"* "a"* "b"*',
    );
  });

  it("keeps non-ascii letters and returns null for no terms", () => {
    expect(ftsQuery("Crème brûlée")).toBe('"crème"* "brûlée"*');
    expect(ftsQuery("  !!  ")).toBeNull();
  });
});
