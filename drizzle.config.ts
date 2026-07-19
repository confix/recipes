import { defineConfig } from "drizzle-kit";

/**
 * Generate-only. drizzle-kit writes SQL into ./drizzle; wrangler owns applying
 * it (`wrangler d1 migrations apply recipes-db --local|--remote`), which is
 * why `migrations_dir` in wrangler.jsonc must stay pointed at `out` below.
 *
 * Deliberately NOT using driver: "d1-http". That driver talks to D1's REST API
 * and cannot see the local Miniflare database, so `drizzle-kit push`/`migrate`
 * would silently operate against production.
 */
export default defineConfig({
  out: "./drizzle",
  schema: "./app/db/schema/index.ts",
  dialect: "sqlite",
});
