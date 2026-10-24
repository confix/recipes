import { describe, expect, it } from "vitest";

import { bakersPercentages, formatPercent } from "./bakers-math";

describe("bakersPercentages", () => {
  it("expresses everything relative to total flour", () => {
    const math = bakersPercentages([
      { name: "bread flour", grams: 800, role: "flour" },
      { name: "rye", grams: 200, role: "flour" },
      { name: "water", grams: 700, role: "liquid" },
      { name: "milk", grams: 50, role: "liquid" },
      { name: "salt", grams: 20, role: "salt" },
    ]);
    expect(math?.flourGrams).toBe(1000);
    expect(math?.hydration).toBe(75);
    expect(math?.entries.map((e) => e.percent)).toEqual([80, 20, 70, 5, 2]);
  });

  it("is null without flour", () => {
    expect(bakersPercentages([{ name: "water", grams: 100, role: "liquid" }])).toBeNull();
  });

  it("formats to one decimal", () => {
    expect(formatPercent(62.5)).toBe("62.5%");
    expect(formatPercent(75.04)).toBe("75%");
  });
});
