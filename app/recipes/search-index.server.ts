import { env } from "cloudflare:workers";

import { type RecipeKind, type ParsedRecipe, ingredientText, summarize } from "./format";
import { ftsQuery } from "./search-query";

/**
 * Maintains the D1 search index (recipe_index, recipe_index_tags, recipe_fts)
 * for files in R2. Raw SQL rather than Drizzle: the FTS5 table is not in the
 * Drizzle schema, and every write here is one atomic D1 batch keyed by
 * (user_id, slug) — sub-selects resolve the row id inside the batch, since
 * D1 batches cannot feed one statement's RETURNING into the next.
 */

const ROW_ID = `(SELECT id FROM recipe_index WHERE user_id = ?1 AND slug = ?2)`;
/**
 * The row id, but only if the row was built from this file version (?3 =
 * etag). Used to skip the FTS/tag rewrite when the upsert below was a no-op
 * because a newer version had already been indexed.
 */
const ROW_ID_FOR_ETAG = `(SELECT id FROM recipe_index WHERE user_id = ?1 AND slug = ?2 AND etag = ?3)`;

export async function indexRecipe(
  userId: string,
  slug: string,
  recipe: ParsedRecipe,
  file: { etag: string; uploaded: Date },
) {
  const fm = recipe.frontmatter;
  const ratings = recipe.log.flatMap((e) => (e.rating ? [e.rating] : []));
  const lastCooked = recipe.log.reduce<string | null>(
    (max, e) => (max === null || e.date > max ? e.date : max),
    null,
  );

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO recipe_index (
         user_id, slug, title, kind, summary, servings, active_minutes,
         total_minutes, source, variant_of, cook_count, last_cooked,
         avg_rating, etag, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
       ON CONFLICT (user_id, slug) DO UPDATE SET
         title = excluded.title, kind = excluded.kind,
         summary = excluded.summary, servings = excluded.servings,
         active_minutes = excluded.active_minutes,
         total_minutes = excluded.total_minutes, source = excluded.source,
         variant_of = excluded.variant_of, cook_count = excluded.cook_count,
         last_cooked = excluded.last_cooked, avg_rating = excluded.avg_rating,
         etag = excluded.etag, updated_at = excluded.updated_at
       -- Concurrent saves can finish indexing out of order; never let an
       -- older file version overwrite a newer one.
       WHERE excluded.updated_at >= recipe_index.updated_at`,
    ).bind(
      userId,
      slug,
      fm.title,
      fm.kind,
      summarize(recipe.body),
      fm.servings ?? null,
      fm.time?.active ?? null,
      fm.time?.total ?? null,
      fm.source ?? null,
      fm.variant_of ?? null,
      recipe.log.length,
      lastCooked,
      ratings.length
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : null,
      file.etag,
      file.uploaded.getTime(),
    ),
    env.DB.prepare(
      `DELETE FROM recipe_fts WHERE rowid = ${ROW_ID_FOR_ETAG}`,
    ).bind(userId, slug, file.etag),
    env.DB.prepare(
      `INSERT INTO recipe_fts (rowid, title, tags, ingredients, body)
       SELECT id, ?4, ?5, ?6, ?7 FROM recipe_index
       WHERE user_id = ?1 AND slug = ?2 AND etag = ?3`,
    ).bind(
      userId,
      slug,
      file.etag,
      fm.title,
      fm.tags.join(" "),
      ingredientText(recipe),
      recipe.body,
    ),
    env.DB.prepare(
      `DELETE FROM recipe_index_tags WHERE recipe_id = ${ROW_ID_FOR_ETAG}`,
    ).bind(userId, slug, file.etag),
    env.DB.prepare(
      `INSERT INTO recipe_index_tags (recipe_id, user_id, tag)
       SELECT r.id, r.user_id, j.value FROM recipe_index r, json_each(?4) j
       WHERE r.user_id = ?1 AND r.slug = ?2 AND r.etag = ?3`,
    ).bind(userId, slug, file.etag, JSON.stringify(fm.tags)),
  ]);
}

export async function unindexRecipe(userId: string, slug: string) {
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM recipe_fts WHERE rowid = ${ROW_ID}`).bind(
      userId,
      slug,
    ),
    env.DB.prepare(
      `DELETE FROM recipe_index_tags WHERE recipe_id = ${ROW_ID}`,
    ).bind(userId, slug),
    env.DB.prepare(
      `DELETE FROM recipe_index WHERE user_id = ?1 AND slug = ?2`,
    ).bind(userId, slug),
  ]);
}

export async function indexedSlugs(userId: string): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT slug FROM recipe_index WHERE user_id = ?`,
  )
    .bind(userId)
    .all<{ slug: string }>();
  return results.map((r) => r.slug);
}

export interface SearchFilters {
  query?: string;
  kind?: RecipeKind;
  /** Every tag must be present. */
  tags?: string[];
  maxMinutes?: number;
  limit?: number;
}

export interface SearchHit {
  slug: string;
  title: string;
  kind: RecipeKind;
  summary: string | null;
  tags: string[];
  servings: string | null;
  activeMinutes: number | null;
  totalMinutes: number | null;
  variantOf: string | null;
  cookCount: number;
  lastCooked: string | null;
  avgRating: number | null;
  updatedAt: string;
}

interface HitRow {
  slug: string;
  title: string;
  kind: RecipeKind;
  summary: string | null;
  tags: string;
  servings: string | null;
  active_minutes: number | null;
  total_minutes: number | null;
  variant_of: string | null;
  cook_count: number;
  last_cooked: string | null;
  avg_rating: number | null;
  updated_at: number;
}

export const MAX_SEARCH_LIMIT = 100;

/**
 * Keyword search plus structured filters. With a query, results are ranked by
 * BM25 with title > tags > ingredients > body; without one, most recently
 * updated first. If requiring every term finds nothing, retries matching any.
 */
export async function searchRecipes(
  userId: string,
  filters: SearchFilters,
): Promise<SearchHit[]> {
  const all = filters.query ? ftsQuery(filters.query, "all") : null;
  const hits = await runSearch(userId, filters, all);
  if (hits.length > 0 || !filters.query) return hits;
  const any = ftsQuery(filters.query, "any");
  return any && any !== all ? runSearch(userId, filters, any) : hits;
}

async function runSearch(
  userId: string,
  filters: SearchFilters,
  match: string | null,
): Promise<SearchHit[]> {
  const where = ["r.user_id = ?"];
  const params: unknown[] = [userId];

  if (match) {
    where.push("recipe_fts MATCH ?");
    params.push(match);
  }
  if (filters.kind) {
    where.push("r.kind = ?");
    params.push(filters.kind);
  }
  if (filters.maxMinutes !== undefined) {
    where.push("r.total_minutes <= ?");
    params.push(filters.maxMinutes);
  }
  const tags = [...new Set(filters.tags ?? [])];
  if (tags.length > 0) {
    where.push(
      `r.id IN (SELECT recipe_id FROM recipe_index_tags
                WHERE user_id = ? AND tag IN (${tags.map(() => "?").join(", ")})
                GROUP BY recipe_id HAVING count(*) = ?)`,
    );
    params.push(userId, ...tags, tags.length);
  }

  const limit = Math.min(Math.max(filters.limit ?? 20, 1), MAX_SEARCH_LIMIT);
  params.push(limit);

  const sql = `
    SELECT r.slug, r.title, r.kind, r.summary, r.servings, r.active_minutes,
           r.total_minutes, r.variant_of, r.cook_count, r.last_cooked,
           r.avg_rating, r.updated_at,
           (SELECT json_group_array(tag) FROM recipe_index_tags t
            WHERE t.recipe_id = r.id) AS tags
    FROM ${match ? "recipe_fts JOIN recipe_index r ON r.id = recipe_fts.rowid" : "recipe_index r"}
    WHERE ${where.join(" AND ")}
    ORDER BY ${match ? "bm25(recipe_fts, 10.0, 5.0, 3.0, 1.0)" : "r.updated_at DESC"}
    LIMIT ?`;

  const { results } = await env.DB.prepare(sql)
    .bind(...params)
    .all<HitRow>();

  return results.map((row) => ({
    slug: row.slug,
    title: row.title,
    kind: row.kind,
    summary: row.summary,
    tags: (JSON.parse(row.tags) as string[]).sort(),
    servings: row.servings,
    activeMinutes: row.active_minutes,
    totalMinutes: row.total_minutes,
    variantOf: row.variant_of,
    cookCount: row.cook_count,
    lastCooked: row.last_cooked,
    avgRating: row.avg_rating,
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

export async function listTags(
  userId: string,
): Promise<Array<{ tag: string; count: number }>> {
  const { results } = await env.DB.prepare(
    `SELECT tag, count(*) AS count FROM recipe_index_tags
     WHERE user_id = ? GROUP BY tag ORDER BY count DESC, tag`,
  )
    .bind(userId)
    .all<{ tag: string; count: number }>();
  return results;
}
