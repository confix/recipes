import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "~/db";
import { recipeShares } from "~/db/schema/app";

/**
 * Share links, the table side only. Reading and importing the shared recipe
 * lives in service.server.ts, next to the rest of the recipe operations.
 * Every function that takes a userId is owner-scoped; resolveShare is the one
 * entry point that starts from a token instead.
 */

/** 128 random bits, base64url. */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** The live share token for a recipe, if it is shared. */
export async function getShareToken(userId: string, slug: string): Promise<string | null> {
  const row = await getDb().query.recipeShares.findFirst({
    where: and(
      eq(recipeShares.userId, userId),
      eq(recipeShares.slug, slug),
      isNull(recipeShares.revokedAt),
    ),
    columns: { token: true },
  });
  return row?.token ?? null;
}

/**
 * Idempotent: sharing an already shared recipe returns its existing token,
 * so the link someone already has keeps working. The caller checks that the
 * recipe exists.
 */
export async function createShare(userId: string, slug: string): Promise<string> {
  const existing = await getShareToken(userId, slug);
  if (existing) return existing;
  const token = newToken();
  await getDb().insert(recipeShares).values({ token, userId, slug });
  return token;
}

/** Revokes every live link to the recipe. Returns whether there was one. */
export async function revokeShares(userId: string, slug: string): Promise<boolean> {
  const revoked = await getDb()
    .update(recipeShares)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(recipeShares.userId, userId),
        eq(recipeShares.slug, slug),
        isNull(recipeShares.revokedAt),
      ),
    )
    .returning({ token: recipeShares.token });
  return revoked.length > 0;
}

/** Owner and slug behind a live token, or null. */
export async function resolveShare(
  token: string,
): Promise<{ userId: string; slug: string } | null> {
  // Tokens are 22 base64url characters; anything else can't be one, and
  // there is no point asking the database.
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) return null;
  const row = await getDb().query.recipeShares.findFirst({
    where: and(eq(recipeShares.token, token), isNull(recipeShares.revokedAt)),
    columns: { userId: true, slug: true },
  });
  return row ?? null;
}
