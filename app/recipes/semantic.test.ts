import { describe, expect, it } from "vitest";

import { parseRecipe } from "./format";
import { embeddingText, reciprocalRankFusion, vectorId } from "./semantic";

describe("embeddingText", () => {
  const parsed = parseRecipe(
    "---\ntitle: Dal\nkind: cook\ntags: [indian]\n---\n\nWarming lentils.\n\n## Ingredients\n\n- red lentils\n- ginger\n\n## Log\n\n- 2026-01-01 ★5 — more salt\n\n## Notes\n\nfreezes well\n",
  );
  if (!parsed.ok) throw new Error(parsed.issues.join());
  const text = embeddingText(parsed.recipe);

  it("leads with what the dish is", () => {
    expect(text.split("\n").slice(0, 4)).toEqual([
      "Dal",
      "Cooking",
      "Tags: indian",
      "Ingredients: red lentils, ginger",
    ]);
  });

  it("keeps the body but drops the cooking log", () => {
    expect(text).toContain("Warming lentils.");
    expect(text).toContain("freezes well");
    expect(text).not.toContain("more salt");
  });

  it("is capped", () => {
    const long = parseRecipe(`---\ntitle: X\nkind: cook\n---\n\n${"word ".repeat(5000)}`);
    if (!long.ok) throw new Error();
    expect(embeddingText(long.recipe).length).toBe(4000);
  });
});

describe("vectorId", () => {
  it("fits Vectorize's 64-byte id limit and is stable per user and slug", async () => {
    const id = await vectorId("user-a", "x".repeat(80));
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(await vectorId("user-a", "dal")).toBe(await vectorId("user-a", "dal"));
    expect(await vectorId("user-a", "dal")).not.toBe(await vectorId("user-b", "dal"));
  });
});

describe("reciprocalRankFusion", () => {
  it("rewards items ranked well in several lists", () => {
    expect(reciprocalRankFusion([["a", "b", "c"], ["c", "a"]])).toEqual(["a", "c", "b"]);
  });

  it("passes a single list through", () => {
    expect(reciprocalRankFusion([["x", "y"], []])).toEqual(["x", "y"]);
  });
});
