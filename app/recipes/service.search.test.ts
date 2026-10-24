import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchHit } from "./search-index.server";

vi.mock("./storage.server", () => ({
  getRecipeFile: vi.fn(),
  putRecipeFile: vi.fn(async () => ({ etag: "e1", uploaded: new Date(0) })),
  deleteRecipeFile: vi.fn(),
  listRecipeSlugs: vi.fn(),
  recipeFileExists: vi.fn(async () => true),
}));
vi.mock("./search-index.server", () => ({
  MAX_SEARCH_LIMIT: 100,
  keywordSearch: vi.fn(async () => []),
  hitsForSlugs: vi.fn(async (_user: string, slugs: string[]) => slugs.map(hit)),
  indexRecipe: vi.fn(),
  indexedEtag: vi.fn(async () => "e1"),
  indexedSlugs: vi.fn(async () => []),
  listTags: vi.fn(),
  unindexRecipe: vi.fn(),
}));
vi.mock("./semantic.server", () => ({
  MAX_TOP_K: 50,
  embed: vi.fn(async () => [0.1, 0.2]),
  nearestRecipes: vi.fn(async () => []),
  storedVector: vi.fn(async () => ({ values: [0.3], hash: "old" })),
  upsertRecipeVector: vi.fn(),
  deleteRecipeVector: vi.fn(),
}));

function hit(slug: string): SearchHit {
  return {
    slug, title: slug, kind: "cook", summary: null, tags: [], servings: null,
    activeMinutes: null, totalMinutes: null, variantOf: null, cookCount: 0,
    lastCooked: null, avgRating: null, updatedAt: "",
  };
}

const index = await import("./search-index.server");
const semantic = await import("./semantic.server");
const storage = await import("./storage.server");
const { deleteRecipe, findSimilar, saveRecipe, searchRecipes } = await import(
  "./service.server"
);
const { embeddingText, sha256Hex } = await import("./semantic");
const { parseRecipe } = await import("./format");

const MD = "---\ntitle: Dal\nkind: cook\n---\n\nLentils.\n";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("searchRecipes", () => {
  it("lists newest first without a query, without embedding anything", async () => {
    vi.mocked(index.keywordSearch).mockResolvedValueOnce([hit("a")]);
    expect((await searchRecipes("u", {})).map((h) => h.slug)).toEqual(["a"]);
    expect(semantic.embed).not.toHaveBeenCalled();
  });

  it("merges keyword and semantic results", async () => {
    vi.mocked(index.keywordSearch).mockResolvedValueOnce([hit("a"), hit("b")]);
    vi.mocked(semantic.nearestRecipes).mockResolvedValueOnce([
      { slug: "c", similarity: 0.9 },
      { slug: "a", similarity: 0.8 },
    ]);
    const results = await searchRecipes("u", { query: "lentil", limit: 2 });
    expect(results.map((h) => h.slug)).toEqual(["a", "c"]);
    expect(results[0].similarity).toBe(0.8);
  });

  it("applies filters to semantic matches through the index", async () => {
    vi.mocked(semantic.nearestRecipes).mockResolvedValueOnce([
      { slug: "slow", similarity: 0.9 },
      { slug: "quick", similarity: 0.8 },
    ]);
    vi.mocked(index.hitsForSlugs).mockResolvedValueOnce([hit("quick")]);
    const results = await searchRecipes("u", { query: "stew", maxMinutes: 30, kind: "cook" });
    expect(index.hitsForSlugs).toHaveBeenCalledWith("u", ["slow", "quick"], {
      maxMinutes: 30,
      kind: "cook",
    });
    expect(semantic.nearestRecipes).toHaveBeenCalledWith("u", [0.1, 0.2], {
      kind: "cook",
      topK: 50,
    });
    expect(results.map((h) => h.slug)).toEqual(["quick"]);
  });

  it("falls back to keyword results when embeddings are unavailable", async () => {
    vi.mocked(index.keywordSearch).mockResolvedValueOnce([hit("a")]);
    vi.mocked(semantic.embed).mockRejectedValueOnce(new Error("not logged in"));
    expect((await searchRecipes("u", { query: "lentil" })).map((h) => h.slug)).toEqual(["a"]);
  });
});

describe("findSimilar", () => {
  it("excludes the recipe itself", async () => {
    vi.mocked(semantic.nearestRecipes).mockResolvedValueOnce([
      { slug: "dal", similarity: 1 },
      { slug: "chana", similarity: 0.7 },
    ]);
    const results = await findSimilar("u", { slug: "dal" });
    expect(results.map((h) => h.slug)).toEqual(["chana"]);
    expect(semantic.storedVector).toHaveBeenCalledWith("u", "dal");
  });

  it("tells a missing recipe apart from a missing embedding", async () => {
    vi.mocked(index.indexedEtag).mockResolvedValueOnce(null);
    await expect(findSimilar("u", { slug: "nope" })).rejects.toMatchObject({ code: "not_found" });
    vi.mocked(semantic.storedVector).mockResolvedValueOnce(null);
    await expect(findSimilar("u", { slug: "dal" })).rejects.toMatchObject({ code: "unavailable" });
  });

  it("ignores a vector whose recipe is gone", async () => {
    vi.mocked(index.indexedEtag).mockResolvedValueOnce(null);
    await expect(findSimilar("u", { slug: "deleted" })).rejects.toMatchObject({
      code: "not_found",
    });
    expect(semantic.storedVector).not.toHaveBeenCalled();
  });

  it("rejects an invalid slug as not found, before touching the services", async () => {
    await expect(findSimilar("u", { slug: "../x" })).rejects.toMatchObject({ code: "not_found" });
    expect(index.indexedEtag).not.toHaveBeenCalled();
  });

  it("reports the service being down as unavailable", async () => {
    vi.mocked(semantic.embed).mockRejectedValueOnce(new Error("down"));
    await expect(findSimilar("u", { text: "like dal" })).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});

describe("keeping vectors in sync", () => {
  it("still saves when the embedding fails", async () => {
    vi.mocked(semantic.embed).mockRejectedValueOnce(new Error("down"));
    await expect(saveRecipe("u", MD, { slug: "dal" })).resolves.toMatchObject({ slug: "dal" });
    expect(index.indexRecipe).toHaveBeenCalled();
    expect(semantic.upsertRecipeVector).not.toHaveBeenCalled();
  });

  it("embeds and stores the content hash", async () => {
    await saveRecipe("u", MD, { slug: "dal" });
    const parsed = parseRecipe(MD);
    if (!parsed.ok) throw new Error();
    expect(semantic.upsertRecipeVector).toHaveBeenCalledWith("u", [0.1, 0.2], {
      slug: "dal",
      kind: "cook",
      hash: await sha256Hex(embeddingText(parsed.recipe)),
    });
  });

  it("skips the embedding when the text is unchanged", async () => {
    const parsed = parseRecipe(MD);
    if (!parsed.ok) throw new Error();
    vi.mocked(semantic.storedVector).mockResolvedValueOnce({
      values: [0.3],
      hash: await sha256Hex(embeddingText(parsed.recipe)),
    });
    await saveRecipe("u", MD, { slug: "dal" });
    expect(semantic.embed).not.toHaveBeenCalled();
  });

  it("does not embed a version a newer save has already replaced", async () => {
    vi.mocked(index.indexedEtag).mockResolvedValueOnce("newer");
    await saveRecipe("u", MD, { slug: "dal" });
    expect(semantic.embed).not.toHaveBeenCalled();
  });

  it("drops the embedding if a newer save lands while embedding", async () => {
    vi.mocked(index.indexedEtag).mockResolvedValueOnce("e1").mockResolvedValueOnce("newer");
    await saveRecipe("u", MD, { slug: "dal" });
    expect(semantic.embed).toHaveBeenCalled();
    expect(semantic.upsertRecipeVector).not.toHaveBeenCalled();
  });

  it("deletes the vector with the recipe, and deletes even if that fails", async () => {
    vi.mocked(semantic.deleteRecipeVector).mockRejectedValueOnce(new Error("down"));
    await expect(deleteRecipe("u", "dal")).resolves.toBeUndefined();
    expect(index.unindexRecipe).toHaveBeenCalledWith("u", "dal");
    expect(semantic.deleteRecipeVector).toHaveBeenCalledWith("u", "dal");
  });
});
