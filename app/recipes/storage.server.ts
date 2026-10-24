import { env } from "cloudflare:workers";

/**
 * R2 layout. Every key is prefixed by the owning user's id; the user id must
 * always come from the authenticated request, never from client input.
 *
 *   u/<user_id>/recipes/<slug>.md
 */

const MARKDOWN = { contentType: "text/markdown; charset=utf-8" };

function recipesPrefix(userId: string) {
  return `u/${userId}/recipes/`;
}

export function recipeKey(userId: string, slug: string) {
  return `${recipesPrefix(userId)}${slug}.md`;
}

export interface StoredRecipe {
  markdown: string;
  etag: string;
  uploaded: Date;
}

export async function getRecipeFile(
  userId: string,
  slug: string,
): Promise<StoredRecipe | null> {
  const object = await env.BUCKET.get(recipeKey(userId, slug));
  if (!object) return null;
  return {
    markdown: await object.text(),
    etag: object.etag,
    uploaded: object.uploaded,
  };
}

export async function recipeFileExists(userId: string, slug: string) {
  return (await env.BUCKET.head(recipeKey(userId, slug))) !== null;
}

/**
 * Writes the file. With `ifMatch`, the write only happens if the stored file
 * still has that etag; with `ifAbsent`, only if there is no file yet. Returns
 * null when the precondition fails.
 */
export async function putRecipeFile(
  userId: string,
  slug: string,
  markdown: string,
  options: { ifMatch?: string; ifAbsent?: boolean } = {},
): Promise<{ etag: string; uploaded: Date } | null> {
  const onlyIf = options.ifMatch
    ? { etagMatches: options.ifMatch }
    : options.ifAbsent
      ? new Headers({ "If-None-Match": "*" })
      : undefined;
  const object = await env.BUCKET.put(recipeKey(userId, slug), markdown, {
    httpMetadata: MARKDOWN,
    onlyIf,
  });
  return object ? { etag: object.etag, uploaded: object.uploaded } : null;
}

export async function deleteRecipeFile(userId: string, slug: string) {
  await env.BUCKET.delete(recipeKey(userId, slug));
}

/** All slugs in a user's library, following R2's list pagination. */
export async function listRecipeSlugs(userId: string): Promise<string[]> {
  const prefix = recipesPrefix(userId);
  const slugs: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.BUCKET.list({ prefix, cursor });
    for (const object of page.objects) {
      if (object.key.endsWith(".md")) {
        slugs.push(object.key.slice(prefix.length, -".md".length));
      }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return slugs;
}
