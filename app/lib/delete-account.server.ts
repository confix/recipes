import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { env } from "cloudflare:workers";

import { getAuth } from "~/lib/auth.server";
import { indexedSlugs } from "~/recipes/search-index.server";
import { deleteRecipeVectors } from "~/recipes/semantic.server";
import { deleteAllUserFiles, listRecipeSlugs } from "~/recipes/storage.server";

/**
 * Account deletion. Everything the account owns lives in four places, and
 * all of it goes:
 *
 *   KV          OAuth grants and tokens of connected MCP clients
 *   Vectorize   recipe embeddings, in the user's namespace
 *   R2          u/<user_id>/… — the recipes themselves
 *   D1          the user row; sessions, password, API tokens, share links,
 *               the search index and v1 data all cascade from it. recipe_fts
 *               is a virtual table without foreign keys and goes by hand.
 *
 * First every way in that could write new recipes behind the deletion is
 * closed: OAuth grants, API tokens and sessions (the password stays, so the
 * user can sign in again and retry). putRecipeFile also refuses users that
 * no longer exist, for a revoked token KV still serves from cache.
 *
 * The user row goes last. If a step fails the account still exists and can
 * delete itself again; every step is safe to repeat.
 *
 * Not better-auth's deleteUser: that would also open /api/auth/delete-user,
 * a second way in that skips the cleanup and the rate limit.
 */

/** True if `password` is the signed-in user's current password. */
export async function checkPassword(request: Request, password: string) {
  // Server-only in better-auth: not reachable over /api/auth.
  const response = await getAuth(request).api.verifyPassword({
    body: { password },
    headers: request.headers,
    asResponse: true,
  });
  return response.ok;
}

export async function deleteAccount(userId: string, oauth: OAuthHelpers) {
  await revokeAllGrants(oauth, userId);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM api_tokens WHERE user_id = ?`).bind(userId),
    env.DB.prepare(`DELETE FROM session WHERE user_id = ?`).bind(userId),
  ]);

  const slugs = new Set([...(await listRecipeSlugs(userId)), ...(await indexedSlugs(userId))]);
  try {
    await deleteRecipeVectors(userId, [...slugs]);
  } catch (error) {
    // Vectorize is unreachable in local dev, and an outage must not keep
    // anyone from leaving. A leftover vector is inert: results only ever go
    // through the D1 index, which is gone below. See docs/design.md.
    console.error("Could not delete recipe vectors:", error);
  }

  await deleteAllUserFiles(userId);

  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM recipe_fts WHERE rowid IN (SELECT id FROM recipe_index WHERE user_id = ?)`,
    ).bind(userId),
    // Pending password-reset tokens name the user in `value`.
    env.DB.prepare(`DELETE FROM verification WHERE value = ?`).bind(userId),
    env.DB.prepare(`DELETE FROM user WHERE id = ?`).bind(userId),
  ]);
}

/** Revoking a grant also deletes its access and refresh tokens. */
async function revokeAllGrants(oauth: OAuthHelpers, userId: string) {
  // List everything first: deleting keys under a live KV list cursor is not
  // something to rely on.
  const grantIds: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await oauth.listUserGrants(userId, { cursor });
    grantIds.push(...page.items.map((grant) => grant.id));
    cursor = page.cursor;
  } while (cursor);
  for (const id of grantIds) await oauth.revokeGrant(id, userId);
}
