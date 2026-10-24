import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Separate from vite.config.ts: unit tests cover pure modules and must not
// boot the Cloudflare / React Router plugins.
export default defineConfig({
  resolve: {
    alias: { "~": fileURLToPath(new URL("./app", import.meta.url)) },
  },
  test: { include: ["app/**/*.test.ts"] },
});
