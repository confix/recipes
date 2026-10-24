import { env } from "cloudflare:workers";

import type { RecipeKind } from "./format";
import { vectorId } from "./semantic";

/**
 * Embeddings (Workers AI) and the vector index (Vectorize). Each user's
 * vectors live in a Vectorize namespace named after their user id, so a
 * query can only ever see that user's recipes.
 *
 * Everything here may fail — no `wrangler login` in local dev, or a service
 * hiccup — and callers treat that as "no semantic results", never as a
 * failed save or search.
 */

/** Multilingual (recipes aren't all English), 1024 dimensions, cosine. */
const MODEL = "@cf/baai/bge-m3";

/**
 * Cosine similarity below which a match is treated as unrelated. A vector
 * index always returns its nearest neighbours, however far; without a floor
 * every query would pull in the whole collection. 0.45 is a starting point
 * for bge-m3, not a measured value — tune it against real recipes.
 */
export const MIN_SIMILARITY = 0.45;

/** Vectorize's topK limit when metadata is returned. */
export const MAX_TOP_K = 50;

export async function embed(text: string): Promise<number[]> {
  const output = await env.AI.run(MODEL, { text: [text], truncate_inputs: true });
  const vector = "data" in output ? output.data?.[0] : undefined;
  if (!vector?.length) throw new Error("Embedding model returned no vector.");
  return vector;
}

export interface VectorMetadata {
  slug: string;
  kind: RecipeKind;
  /** SHA-256 of the embedded text, to skip re-embedding unchanged content. */
  hash: string;
}

export async function upsertRecipeVector(
  userId: string,
  values: number[],
  metadata: VectorMetadata,
) {
  await env.VECTORIZE.upsert([
    {
      id: await vectorId(userId, metadata.slug),
      namespace: userId,
      values,
      metadata: { ...metadata },
    },
  ]);
}

export async function deleteRecipeVector(userId: string, slug: string) {
  await env.VECTORIZE.deleteByIds([await vectorId(userId, slug)]);
}

/** The stored vector for a recipe, or null if it has none (yet). */
export async function storedVector(
  userId: string,
  slug: string,
): Promise<{ values: number[]; hash: string | null } | null> {
  const [vector] = await env.VECTORIZE.getByIds([await vectorId(userId, slug)]);
  if (!vector) return null;
  // The id is derived from the user id, so this cannot match another user's
  // vector; the namespace check is defence in depth (and tolerates a runtime
  // that omits the field).
  if (vector.namespace !== undefined && vector.namespace !== userId) return null;
  const hash = vector.metadata?.hash;
  return { values: Array.from(vector.values), hash: typeof hash === "string" ? hash : null };
}

export interface SemanticMatch {
  slug: string;
  similarity: number;
}

export async function nearestRecipes(
  userId: string,
  vector: number[],
  options: { kind?: RecipeKind; topK: number },
): Promise<SemanticMatch[]> {
  const { matches } = await env.VECTORIZE.query(vector, {
    namespace: userId,
    topK: Math.min(options.topK, MAX_TOP_K),
    returnMetadata: "all",
    filter: options.kind ? { kind: options.kind } : undefined,
  });
  return matches.flatMap((match) =>
    match.score >= MIN_SIMILARITY && typeof match.metadata?.slug === "string"
      ? [{ slug: match.metadata.slug, similarity: match.score }]
      : [],
  );
}
