import { env } from "cloudflare:workers";

/**
 * Removes accounts whose email address was never confirmed, once their
 * confirmation link (24 hours, app/lib/auth.server.ts) has run out. Run
 * daily by the cron trigger in wrangler.jsonc.
 *
 * Without this, anyone could sign up with someone else's address and hold it
 * for good. An unconfirmed account cannot sign in, so it owns no recipes,
 * tokens or grants; the user row and any pending reset token are all there is.
 */
export const UNVERIFIED_TTL_MS = 2 * 24 * 60 * 60 * 1000;

export async function purgeUnverifiedAccounts(now = Date.now()) {
  const cutoff = now - UNVERIFIED_TTL_MS;
  const [, users] = await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM verification WHERE value IN
         (SELECT id FROM user WHERE email_verified = 0 AND created_at < ?)`,
    ).bind(cutoff),
    // RETURNING, because D1 counts the cascaded account rows in `changes`.
    env.DB.prepare(`DELETE FROM user WHERE email_verified = 0 AND created_at < ? RETURNING id`).bind(cutoff),
  ]);
  return users.results.length;
}
