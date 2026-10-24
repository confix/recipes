import { describe, expect, it } from "vitest";

import {
  appendLogEntry,
  withoutLog,
  ingredientText,
  parseLog,
  parseRecipe,
  slugify,
  summarize,
} from "./format";

const SOURDOUGH = `---
title: Country Sourdough
kind: bake
tags: [Bread, sourdough, bread]
servings: 2
time: { active: 45, total: 1440 }
variant_of: basic-sourdough
cuisine: french
formula:
  - { name: bread flour, grams: 900, role: flour }
  - { name: water, grams: 750, role: liquid }
  - { name: salt, grams: 20 }
---

A crusty everyday loaf with a long cold retard.

## Method

Mix, fold, shape.

## Log

- 2026-10-01 ★3 — a bit flat
- 2026-10-12 ★4 — 78% hydration; better ear.
`;

describe("parseRecipe", () => {
  it("parses and normalizes frontmatter", () => {
    const result = parseRecipe(SOURDOUGH);
    if (!result.ok) throw new Error(result.issues.join("\n"));
    const fm = result.recipe.frontmatter;
    expect(fm.title).toBe("Country Sourdough");
    expect(fm.kind).toBe("bake");
    expect(fm.tags).toEqual(["bread", "sourdough"]);
    expect(fm.servings).toBe("2");
    expect(fm.time).toEqual({ active: 45, total: 1440 });
    expect(fm.formula?.[2]).toEqual({ name: "salt", grams: 20, role: "other" });
    expect(fm.cuisine).toBe("french");
    expect(result.recipe.log).toHaveLength(2);
  });

  it("reports every problem with its path", () => {
    const result = parseRecipe(
      "---\ntitle: ''\nkind: grill\nformula:\n  - { name: x, grams: -1 }\n---\n",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join("\n")).toMatch(/title/);
    expect(result.issues.join("\n")).toMatch(/kind/);
    expect(result.issues.join("\n")).toMatch(/formula\.0\.grams/);
  });

  it("rejects missing frontmatter and broken YAML", () => {
    expect(parseRecipe("# Just markdown").ok).toBe(false);
    const broken = parseRecipe("---\ntitle: [unclosed\n---\n");
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.issues[0]).toMatch(/not valid YAML/);
  });

  it("rejects invalid variant_of slugs", () => {
    expect(
      parseRecipe("---\ntitle: X\nkind: cook\nvariant_of: Not A Slug\n---\n").ok,
    ).toBe(false);
  });
});

describe("log", () => {
  it("parses entries with optional rating and notes", () => {
    expect(
      parseLog("## Log\n\n- 2026-01-02\n- 2026-01-03 ★5\n- 2026-01-04 — ok\nnot a line\n"),
    ).toEqual([
      { date: "2026-01-02" },
      { date: "2026-01-03", rating: 5 },
      { date: "2026-01-04", notes: "ok" },
    ]);
  });

  it("ignores list items outside the log section", () => {
    expect(parseLog("## Notes\n- 2026-01-02 ★5\n")).toEqual([]);
  });

  it("appends to an existing section, before any following section", () => {
    const md = "---\ntitle: X\nkind: cook\n---\n\n## Log\n\n- 2026-01-01\n\n## Notes\n\nkeep me\n";
    const out = appendLogEntry(md, { date: "2026-02-02", rating: 4, notes: "nice\nreally" });
    expect(out).toBe(
      "---\ntitle: X\nkind: cook\n---\n\n## Log\n\n- 2026-01-01\n- 2026-02-02 ★4 — nice really\n\n## Notes\n\nkeep me\n",
    );
    expect(parseLog(out)).toHaveLength(2);
  });

  it("creates the section when missing", () => {
    const out = appendLogEntry("---\ntitle: X\nkind: cook\n---\n\nBody.\n", { date: "2026-02-02" });
    expect(out).toBe("---\ntitle: X\nkind: cook\n---\n\nBody.\n\n## Log\n\n- 2026-02-02\n");
  });

  it("fills an empty section", () => {
    const out = appendLogEntry("---\ntitle: X\nkind: cook\n---\n\n## Log\n", { date: "2026-02-02" });
    expect(out).toBe("---\ntitle: X\nkind: cook\n---\n\n## Log\n\n- 2026-02-02\n");
  });

  it("does not mistake a '## Log' inside frontmatter for the section", () => {
    const md = "---\ntitle: X\nkind: cook\n---\nBody\n";
    expect(appendLogEntry(md, { date: "2026-02-02" })).toContain("Body\n\n## Log");
  });
});

describe("withoutLog", () => {
  it("removes only the log section", () => {
    expect(withoutLog("Intro\n\n## Log\n\n- 2026-01-01\n\n## Notes\n\nkeep\n")).toBe(
      "Intro\n\n## Notes\n\nkeep\n",
    );
    expect(withoutLog("No log here\n")).toBe("No log here\n");
  });
});

describe("derived text", () => {
  it("summarizes the first prose paragraph", () => {
    expect(summarize("# Title\n\n- item\n\nFirst  para\nline two.\n\nSecond.")).toBe(
      "First para line two.",
    );
    expect(summarize("## Only headings")).toBeNull();
    expect(summarize("x".repeat(400), 10)).toBe("xxxxxxxxx…");
  });

  it("collects formula and ingredient-section items", () => {
    const parsed = parseRecipe(
      "---\ntitle: Dal\nkind: cook\n---\n\n## Ingredients\n\n- 200 g red lentils\n- 1 onion\n\n## Method\n\n- stir\n",
    );
    if (!parsed.ok) throw new Error();
    expect(ingredientText(parsed.recipe)).toBe("200 g red lentils\n1 onion");
  });

  it("includes grouped ingredients under subheadings", () => {
    const parsed = parseRecipe(
      "---\ntitle: F\nkind: bake\nformula:\n  - { name: flour, grams: 500, role: flour }\n---\n\n## Ingredients\n\n### Topping\n\n- olive oil\n\n## Method\n\n- bake\n",
    );
    if (!parsed.ok) throw new Error();
    expect(ingredientText(parsed.recipe)).toBe("flour\nolive oil");
  });
});

describe("slugify", () => {
  it("produces url-safe slugs", () => {
    expect(slugify("Crème Brûlée")).toBe("creme-brulee");
    expect(slugify("Großmutters Käsekuchen!")).toBe("grossmutters-kasekuchen");
    expect(slugify("  --  ")).toBe("recipe");
    expect(slugify("a".repeat(100))).toHaveLength(80);
  });
});
