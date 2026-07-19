import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

/**
 * Build a Drizzle client for the current request.
 *
 * Call this inside a loader/action — never at module scope. `env.DB` is an I/O
 * binding and throws if touched outside a request context. Construction is
 * cheap, so per-request is the correct granularity.
 *
 * Note we use `import { env } from "cloudflare:workers"` rather than
 * context.cloudflare.env: React Router 8 types the load context as
 * RouterContextProvider and removed AppLoadContext entirely, so the old
 * Cloudflare pattern is both a type error and a runtime error. The Vite plugin
 * runs SSR inside workerd, so this resolves in dev too.
 */
export function getDb() {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
