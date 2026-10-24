import { bakersPercentages, type BakersMath } from "~/lib/bakers-math";

import {
  type Frontmatter,
  type LogEntry,
  appendLogEntry,
  isValidSlug,
  parseRecipe,
  slugify,
} from "./format";
import {
  type SearchFilters,
  type SearchHit,
  indexRecipe,
  indexedSlugs,
  listTags as listIndexedTags,
  searchRecipes as searchIndex,
  unindexRecipe,
} from "./search-index.server";
import {
  deleteRecipeFile,
  getRecipeFile,
  listRecipeSlugs,
  putRecipeFile,
  recipeFileExists,
} from "./storage.server";

/**
 * The one entry point for recipe operations. The REST API and the MCP server
 * are both thin adapters over this module; neither touches storage or the
 * index directly. Every function takes the authenticated user's id first —
 * it is the tenancy boundary and must never come from request input.
 *
 * Writes go to R2 first, then the index. If indexing fails the file is still
 * safe, and reindexAll() repairs the index from R2.
 */

export class RecipeError extends Error {
  constructor(
    readonly code: "not_found" | "invalid" | "conflict" | "precondition_failed",
    message: string,
    readonly issues?: string[],
  ) {
    super(message);
  }
}

export interface Recipe {
  slug: string;
  etag: string;
  markdown: string;
  frontmatter: Frontmatter;
  log: LogEntry[];
  /** Present when the recipe has a formula with flour in it. */
  bakers: BakersMath | null;
}

/** Recipes are text; anything larger is a mistake (or abuse). */
export const MAX_RECIPE_BYTES = 512 * 1024;

function parseOrThrow(markdown: string) {
  const parsed = parseRecipe(markdown);
  if (!parsed.ok) {
    throw new RecipeError("invalid", "Recipe is not valid.", parsed.issues);
  }
  return parsed.recipe;
}

function assertSlug(slug: string) {
  if (!isValidSlug(slug)) {
    throw new RecipeError("not_found", `No recipe "${slug}".`);
  }
}

/**
 * Writes a new file under the title's slug, or the first free "-2", "-3", …
 * suffix. Each attempt is a create-only-if-absent write, so concurrent creates
 * with the same title can never overwrite each other.
 */
async function createWithFreeSlug(userId: string, title: string, markdown: string) {
  const base = slugify(title);
  for (let n = 1; n < 100; n++) {
    const slug = n === 1 ? base : `${base.slice(0, 75)}-${n}`;
    const file = await putRecipeFile(userId, slug, markdown, { ifAbsent: true });
    if (file) return { slug, file };
  }
  throw new RecipeError("conflict", `Too many recipes titled "${title}".`);
}

export async function getRecipe(userId: string, slug: string): Promise<Recipe> {
  assertSlug(slug);
  const file = await getRecipeFile(userId, slug);
  if (!file) throw new RecipeError("not_found", `No recipe "${slug}".`);
  const recipe = parseOrThrow(file.markdown);
  return {
    slug,
    etag: file.etag,
    markdown: file.markdown,
    frontmatter: recipe.frontmatter,
    log: recipe.log,
    bakers: recipe.frontmatter.formula
      ? bakersPercentages(recipe.frontmatter.formula)
      : null,
  };
}

/**
 * The stored file as-is, without parsing — so a file that no longer
 * validates can still be fetched and fixed.
 */
export async function getRecipeSource(userId: string, slug: string) {
  assertSlug(slug);
  const file = await getRecipeFile(userId, slug);
  if (!file) throw new RecipeError("not_found", `No recipe "${slug}".`);
  return { slug, etag: file.etag, markdown: file.markdown };
}

/**
 * Creates a recipe (no slug: derived from the title, suffixed if taken) or
 * creates-or-replaces one (slug given). The markdown is stored verbatim. With
 * `ifMatch`, the replace only happens if the stored file still has that etag.
 */
export async function saveRecipe(
  userId: string,
  markdown: string,
  options: { slug?: string; ifMatch?: string } = {},
): Promise<{ slug: string; etag: string; created: boolean }> {
  if (new TextEncoder().encode(markdown).byteLength > MAX_RECIPE_BYTES) {
    throw new RecipeError("invalid", "Recipe is too large.", [
      `markdown: must be at most ${MAX_RECIPE_BYTES / 1024} KiB`,
    ]);
  }
  const recipe = parseOrThrow(markdown);

  if (options.slug !== undefined && !isValidSlug(options.slug)) {
    throw new RecipeError("invalid", `"${options.slug}" is not a valid slug.`, [
      "slug: must be lowercase letters, digits and single dashes",
    ]);
  }
  if (options.slug !== undefined && recipe.frontmatter.variant_of === options.slug) {
    throw new RecipeError("invalid", "A recipe cannot be a variant of itself.", [
      "variant_of: must not be the recipe's own slug",
    ]);
  }

  let slug: string;
  let file: { etag: string; uploaded: Date } | null;
  let created: boolean;

  if (options.slug === undefined) {
    ({ slug, file } = await createWithFreeSlug(
      userId,
      recipe.frontmatter.title,
      markdown,
    ));
    created = true;
  } else if (options.ifMatch) {
    slug = options.slug;
    file = await putRecipeFile(userId, slug, markdown, { ifMatch: options.ifMatch });
    if (!file) {
      if (!(await recipeFileExists(userId, slug))) {
        throw new RecipeError("not_found", `No recipe "${slug}".`);
      }
      throw new RecipeError(
        "precondition_failed",
        `Recipe "${slug}" changed since it was read; fetch it again and retry.`,
      );
    }
    created = false;
  } else {
    // Upsert. Try create first so `created` is reported truthfully.
    slug = options.slug;
    file = await putRecipeFile(userId, slug, markdown, { ifAbsent: true });
    created = file !== null;
    file ??= await putRecipeFile(userId, slug, markdown);
  }
  if (!file) throw new Error("unconditional R2 put returned null");
  if (created && recipe.frontmatter.variant_of === slug) {
    // A derived slug collided with variant_of; undo rather than store a self-loop.
    await deleteRecipeFile(userId, slug);
    throw new RecipeError("invalid", "A recipe cannot be a variant of itself.", [
      "variant_of: must not be the recipe's own slug",
    ]);
  }

  await indexRecipe(userId, slug, recipe, file);
  return { slug, etag: file.etag, created };
}

export async function deleteRecipe(userId: string, slug: string) {
  assertSlug(slug);
  if (!(await recipeFileExists(userId, slug))) {
    throw new RecipeError("not_found", `No recipe "${slug}".`);
  }
  await deleteRecipeFile(userId, slug);
  await unindexRecipe(userId, slug);
}

/**
 * Appends to the recipe's `## Log` section. Read-modify-write guarded by the
 * R2 etag, retried a few times so two concurrent logs both land.
 */
export async function logCook(
  userId: string,
  slug: string,
  entry: LogEntry,
): Promise<{ etag: string; entry: LogEntry }> {
  assertSlug(slug);
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await getRecipeFile(userId, slug);
    if (!current) throw new RecipeError("not_found", `No recipe "${slug}".`);
    const markdown = appendLogEntry(current.markdown, entry);
    const recipe = parseOrThrow(markdown);
    const file = await putRecipeFile(userId, slug, markdown, {
      ifMatch: current.etag,
    });
    if (file) {
      await indexRecipe(userId, slug, recipe, file);
      return { etag: file.etag, entry };
    }
  }
  throw new RecipeError(
    "conflict",
    `Recipe "${slug}" kept changing while logging; try again.`,
  );
}

export function searchRecipes(
  userId: string,
  filters: SearchFilters,
): Promise<SearchHit[]> {
  return searchIndex(userId, filters);
}

export function listTags(userId: string) {
  return listIndexedTags(userId);
}

/** Enough to hide R2/D1 latency without approaching subrequest limits. */
const REINDEX_CONCURRENCY = 8;

async function forEachConcurrently<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

/**
 * Rebuilds the user's index from R2: (re)indexes every file and drops index
 * rows whose file is gone. Files that no longer parse are reported, and left
 * out of the index.
 */
export async function reindexAll(userId: string) {
  const slugs = await listRecipeSlugs(userId);
  const invalid: Array<{ slug: string; issues: string[] }> = [];
  const live = new Set<string>();

  await forEachConcurrently(slugs, REINDEX_CONCURRENCY, async (slug) => {
    if (!isValidSlug(slug)) {
      invalid.push({ slug, issues: ["file name is not a valid slug"] });
      return;
    }
    const file = await getRecipeFile(userId, slug);
    if (!file) return;
    const parsed = parseRecipe(file.markdown);
    if (!parsed.ok) {
      invalid.push({ slug, issues: parsed.issues });
      return;
    }
    await indexRecipe(userId, slug, parsed.recipe, file);
    live.add(slug);
  });

  let removed = 0;
  for (const slug of await indexedSlugs(userId)) {
    if (!live.has(slug)) {
      await unindexRecipe(userId, slug);
      removed++;
    }
  }

  return { indexed: live.size, removed, invalid };
}

export type { SearchFilters, SearchHit };
