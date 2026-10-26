import { describe, expect, it } from "vitest";

import { parseImprint } from "./imprint";

describe("parseImprint", () => {
  it("reads name, address and email from lines", () => {
    expect(parseImprint("Jane Doe\nExample St 1\n12345 Berlin\njane@example.com")).toEqual({
      name: "Jane Doe",
      address: ["Example St 1", "12345 Berlin"],
      email: "jane@example.com",
    });
  });

  it("accepts literal \\n separators and stray whitespace", () => {
    expect(parseImprint(" Jane Doe \\n jane@example.com \\n\\n Example St 1 ")).toEqual({
      name: "Jane Doe",
      address: ["Example St 1"],
      email: "jane@example.com",
    });
  });

  it("is null when unset or blank", () => {
    expect(parseImprint(undefined)).toBeNull();
    expect(parseImprint("  \n ")).toBeNull();
  });
});
