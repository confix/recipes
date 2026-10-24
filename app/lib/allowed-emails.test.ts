import { describe, expect, it } from "vitest";

import { isEmailAllowed } from "./allowed-emails";

describe("isEmailAllowed", () => {
  it("allows listed addresses, case-insensitively", () => {
    const list = "fp@quebi.de, Friend@Example.com\nother@example.com";
    expect(isEmailAllowed("FP@quebi.de", list)).toBe(true);
    expect(isEmailAllowed("friend@example.com", list)).toBe(true);
    expect(isEmailAllowed("other@example.com", list)).toBe(true);
    expect(isEmailAllowed("stranger@example.com", list)).toBe(false);
  });

  it("fails closed when unset or empty", () => {
    expect(isEmailAllowed("fp@quebi.de", undefined)).toBe(false);
    expect(isEmailAllowed("fp@quebi.de", " , ")).toBe(false);
  });

  it("opens sign-up only for an explicit *", () => {
    expect(isEmailAllowed("anyone@example.com", "*")).toBe(true);
  });

  it("matches whole addresses only", () => {
    expect(isEmailAllowed("x@quebi.de.evil.com", "x@quebi.de")).toBe(false);
    expect(isEmailAllowed("evilx@quebi.de", "x@quebi.de")).toBe(false);
  });
});
