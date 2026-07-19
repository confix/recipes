/**
 * Schema-generation config for `@better-auth/cli generate` ONLY.
 *
 * The CLI needs a statically importable betterAuth() call, but the real
 * runtime config cannot be built at module scope: D1 is only reachable via a
 * binding, and `env.DB` throws if touched outside a request. So the runtime
 * config lives in app/lib/auth.server.ts and is constructed per-request.
 *
 * Keep the auth-behaviour options here in sync with auth.server.ts. Only the
 * options that affect the *database shape* matter for generation — the
 * database itself is stubbed out below.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
  database: drizzleAdapter({} as never, {
    provider: "sqlite",
    // D1 cannot open interactive transactions; the adapter must not try.
    transaction: false,
  }),
  emailAndPassword: { enabled: true },
});
