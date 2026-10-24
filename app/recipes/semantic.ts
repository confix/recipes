import { type ParsedRecipe, ingredientText, withoutLog } from "./format";

/**
 * Pure helpers for semantic search; the I/O lives in semantic.server.ts.
 */

/** Keeps embedding input well inside the model's context and cost. */
const MAX_EMBEDDING_CHARS = 4000;

/**
 * What a recipe "means" for similarity: name, kind, tags and ingredients
 * first, then as much of the body as fits. The log is left out — "made it
 * again, more salt" says nothing about the dish.
 */
export function embeddingText(recipe: ParsedRecipe): string {
  const fm = recipe.frontmatter;
  const body = withoutLog(recipe.body);
  const parts = [
    fm.title,
    fm.kind === "bake" ? "Baking" : "Cooking",
    fm.tags.length ? `Tags: ${fm.tags.join(", ")}` : "",
    `Ingredients: ${ingredientText(recipe).replace(/\n/g, ", ")}`,
    body.trim(),
  ];
  return parts.filter(Boolean).join("\n").slice(0, MAX_EMBEDDING_CHARS);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Vector ids are capped at 64 bytes, too short for user id + slug, so the id
 * is their SHA-256 (64 hex chars). The slug travels in metadata.
 */
export function vectorId(userId: string, slug: string): Promise<string> {
  return sha256Hex(`${userId}/${slug}`);
}

/**
 * Reciprocal rank fusion: merges ranked lists without having to make BM25
 * and cosine scores comparable. Each list contributes 1 / (k + rank); k = 60
 * is the customary constant that keeps any single list from dominating.
 */
export function reciprocalRankFusion(lists: string[][], k = 60): string[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((key, rank) => {
      scores.set(key, (scores.get(key) ?? 0) + 1 / (k + rank + 1));
    });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);
}
