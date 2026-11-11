import { describe, expect, it } from "vitest";

import {
  formatFactor,
  parseScale,
  scaleFormula,
  scaleIngredientSections,
  scaleLeadingQuantity,
  scaleServings,
} from "./scale";

describe("parseScale", () => {
  it("reads factors, with a decimal comma too", () => {
    expect(parseScale("2")).toBe(2);
    expect(parseScale("0,5")).toBe(0.5);
  });
  it("treats absent, 1 and junk as unscaled", () => {
    expect(parseScale(null)).toBeNull();
    expect(parseScale("1")).toBeNull();
    expect(parseScale("abc")).toBeNull();
    expect(parseScale("-2")).toBeNull();
  });
  it("clamps to a sane range", () => {
    expect(parseScale("1000")).toBe(20);
    expect(parseScale("0.001")).toBe(0.1);
  });
});

describe("scaleLeadingQuantity", () => {
  it.each([
    ["200 g red lentils", 2, "400 g red lentils"],
    ["200g flour", 0.5, "100g flour"],
    ["1/2 cup sugar", 2, "1 cup sugar"],
    ["1 1/2 cups milk", 2, "3 cups milk"],
    ["½ tsp salt", 3, "1½ tsp salt"],
    ["1½ tbsp oil", 2, "3 tbsp oil"],
    ["2–3 cloves garlic", 2, "4–6 cloves garlic"],
    ["2-3 Zehen Knoblauch", 0.5, "1-1.5 Zehen Knoblauch"],
    ["0,5 l Milch", 3, "1,5 l Milch"],
    ["3 eggs", 1.5, "4.5 eggs"],
    ["7 g yeast", 1.5, "10.5 g yeast"],
  ])("%s × %d → %s", (input, factor, expected) => {
    expect(scaleLeadingQuantity(input, factor)).toBe(expected);
  });

  it("leaves text without a leading quantity alone", () => {
    expect(scaleLeadingQuantity("salt, to taste", 2)).toBe("salt, to taste");
    expect(scaleLeadingQuantity("a pinch of nutmeg", 2)).toBe("a pinch of nutmeg");
  });
});

describe("scaleServings", () => {
  it("scales the leading number only", () => {
    expect(scaleServings("2 loaves", 2)).toBe("4 loaves");
    expect(scaleServings("4", 0.5)).toBe("2");
    expect(scaleServings("a crowd", 2)).toBe("a crowd");
  });
});

describe("scaleFormula", () => {
  it("multiplies grams, rounding sensibly", () => {
    const scaled = scaleFormula(
      [
        { name: "flour", grams: 500, role: "flour" },
        { name: "salt", grams: 3, role: "salt" },
      ],
      1.5,
    );
    expect(scaled.map((e) => e.grams)).toEqual([750, 4.5]);
  });
});

describe("scaleIngredientSections", () => {
  const body = [
    "A warming dal.",
    "",
    "## Ingredients",
    "- 200 g red lentils",
    "- 1 onion",
    "- salt",
    "",
    "### Tadka",
    "- 2 tbsp ghee",
    "",
    "## Method",
    "1. Simmer 20 min at 2 heat.",
    "- 3 times stir",
  ].join("\n");

  it("scales list items under ingredient headings, including subsections", () => {
    const out = scaleIngredientSections(body, 2);
    expect(out).toContain("- 400 g red lentils");
    expect(out).toContain("- 2 onion");
    expect(out).toContain("- salt");
    expect(out).toContain("- 4 tbsp ghee");
  });

  it("never touches the method", () => {
    const out = scaleIngredientSections(body, 2);
    expect(out).toContain("1. Simmer 20 min at 2 heat.");
    expect(out).toContain("- 3 times stir");
  });

  it("works for German headings and keeps line endings", () => {
    expect(scaleIngredientSections("## Zutaten\r\n- 100 g Mehl\r\n", 3)).toBe(
      "## Zutaten\r\n- 300 g Mehl\r\n",
    );
  });
});

describe("formatFactor", () => {
  it("writes factors as a cook would", () => {
    expect(formatFactor(2)).toBe("2×");
    expect(formatFactor(0.5)).toBe("½×");
    expect(formatFactor(1.5)).toBe("1½×");
  });
});
