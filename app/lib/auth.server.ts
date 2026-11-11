import { env, waitUntil } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { getDb, schema } from "~/db";
import { DEFAULT_LOCALE } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n.server";
import { type AccountMail, sendAccountMail } from "~/lib/mail.server";

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
  const origin = request ? new URL(request.url).origin : undefined;
  // Emails go out in the language of the page that triggered them.
  const locale = request ? getLocale(request) : DEFAULT_LOCALE;
  // Never throws: a mail error that only happens for some addresses would
  // tell the visitor which ones have an account.
  const mailQuietly = async (...[kind, user, vars]: [AccountMail, { name: string; email: string }, Record<string, string>]) => {
    try {
      await sendAccountMail(kind, user, locale, vars);
    } catch (error) {
      console.error(`Could not send ${kind} mail:`, error);
    }
  };

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
    baseURL: origin,
    // Anyone can sign up, so an account only becomes usable once its owner
    // has clicked the link sent to the address. Until then nobody can sign
    // in with it, and signing up again with a taken address looks exactly
    // like a fresh sign-up (the owner gets an email instead), so the form
    // does not reveal who has an account.
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, url }) {
        await mailQuietly("reset", user, { url });
      },
      async onExistingUserSignUp({ user }) {
        await mailQuietly("existing", user, {
          login: `${origin}/login`,
          reset: `${origin}/forgot-password`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // Signing in unverified sends a fresh link: the way to get a new one.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      async sendVerificationEmail({ user, url }) {
        await mailQuietly("verify", user, { url });
      },
    },
    advanced: {
      // Cloudflare's header for the client IP. better-auth's own rate limiter
      // (in-memory, so per isolate) keys on it for direct /api/auth calls;
      // the real limits are in app/lib/rate-limit.server.ts.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      // Mail goes out after the response. Awaiting it would make a known
      // address measurably slower to answer than an unknown one.
      backgroundTasks: { handler: waitUntil },
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
