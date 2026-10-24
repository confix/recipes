import { and, desc, eq, isNull } from "drizzle-orm";

import { getDb, schema } from "~/db";

/**
 * Personal access tokens: `rcp_` + 32 random bytes (base64url). Only the
 * SHA-256 is stored, so a database leak does not leak usable tokens; the
 * plaintext is returned exactly once, from createToken().
 */

const TOKEN_PREFIX = "rcp_";
/** How stale last_used_at may get before a request refreshes it. */
const LAST_USED_RESOLUTION_MS = 60 * 60 * 1000;

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function looksLikeToken(value: string) {
  return value.startsWith(TOKEN_PREFIX);
}

export async function createToken(userId: string, name: string) {
  const token = TOKEN_PREFIX + base64url(crypto.getRandomValues(new Uint8Array(32)));
  const row = {
    id: crypto.randomUUID(),
    userId,
    name,
    tokenHash: await sha256Hex(token),
    prefix: token.slice(0, TOKEN_PREFIX.length + 6),
  };
  await getDb().insert(schema.apiTokens).values(row);
  return { id: row.id, name, prefix: row.prefix, token };
}

export async function listTokens(userId: string) {
  return getDb()
    .select({
      id: schema.apiTokens.id,
      name: schema.apiTokens.name,
      prefix: schema.apiTokens.prefix,
      createdAt: schema.apiTokens.createdAt,
      lastUsedAt: schema.apiTokens.lastUsedAt,
    })
    .from(schema.apiTokens)
    .where(
      and(
        eq(schema.apiTokens.userId, userId),
        isNull(schema.apiTokens.revokedAt),
      ),
    )
    .orderBy(desc(schema.apiTokens.createdAt));
}

/** Returns false when there is no such live token for this user. */
export async function revokeToken(userId: string, id: string) {
  const revoked = await getDb()
    .update(schema.apiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.apiTokens.id, id),
        eq(schema.apiTokens.userId, userId),
        isNull(schema.apiTokens.revokedAt),
      ),
    )
    .returning({ id: schema.apiTokens.id });
  return revoked.length > 0;
}

/** Resolves a presented token to its owner's user id, or null. */
export async function verifyToken(token: string): Promise<string | null> {
  if (!looksLikeToken(token)) return null;
  const db = getDb();
  const [row] = await db
    .select({
      id: schema.apiTokens.id,
      userId: schema.apiTokens.userId,
      lastUsedAt: schema.apiTokens.lastUsedAt,
    })
    .from(schema.apiTokens)
    .where(
      and(
        eq(schema.apiTokens.tokenHash, await sha256Hex(token)),
        isNull(schema.apiTokens.revokedAt),
      ),
    )
    .limit(1);
  if (!row) return null;

  const now = Date.now();
  if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await db
      .update(schema.apiTokens)
      .set({ lastUsedAt: new Date(now) })
      .where(eq(schema.apiTokens.id, row.id));
  }
  return row.userId;
}
