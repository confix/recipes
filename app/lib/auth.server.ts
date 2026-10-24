import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { getDb, schema } from "~/db";
import { isEmailAllowed } from "~/lib/allowed-emails";

/**
 * Build the auth instance for the current request.
 *
 * This is deliberately a function, not a module-scope constant. D1 is only
 * reachable through a binding, and `env.DB` throws if touched outside a
 * request context — so a top-level betterAuth({database: env.DB}) would blow
 * up at import time. Construction is cheap; per-request is correct.
 *
 * The schema-generation twin of this config lives in app/lib/auth.config.ts
 * (the CLI needs a statically importable config). Keep the two in sync.
 */
export function getAuth(request?: Request) {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
      // D1 cannot open interactive transactions. Drizzle exposes
      // db.transaction() and it compiles, but D1 cannot honour rollback — the
      // adapter must not attempt it. It uses D1's atomic batch() instead.
      transaction: false,
    }),
    secret: env.BETTER_AUTH_SECRET,
    // Derived from the request rather than configured, so local dev, preview
    // URLs, and production all work without a per-environment host var.
    baseURL: request ? new URL(request.url).origin : undefined,
    emailAndPassword: { enabled: true },
    databaseHooks: {
      user: {
        create: {
          // Every way of creating an account ends here, so this is the one
          // place sign-up is restricted. See app/lib/allowed-emails.ts.
          async before(user) {
            if (!isEmailAllowed(user.email, env.ALLOWED_EMAILS)) {
              throw new APIError("FORBIDDEN", {
                message: "Sign-up is invite-only, and this email is not on the list.",
              });
            }
          },
        },
      },
    },
  });
}

/** Returns the signed-in user, or null. */
export async function getSessionUser(request: Request) {
  const session = await getAuth(request).api.getSession({
    headers: request.headers,
  });
  return session?.user ?? null;
}

/**
 * Loader/action guard. Throws a redirect to /login when signed out, so callers
 * can treat the return value as always-present.
 */
export async function requireUser(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    const { pathname, search } = new URL(request.url);
    const next = pathname + search;
    throw new Response(null, {
      status: 302,
      headers: { Location: `/login?next=${encodeURIComponent(next)}` },
    });
  }
  return user;
}
