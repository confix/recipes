import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
      // Workers AI and Vectorize only exist remotely, and connecting to them
      // needs `wrangler login`. Off by default so `pnpm dev` works without an
      // account; semantic search then degrades to keywords. Opt in with
      // REMOTE_BINDINGS=1 pnpm dev.
      remoteBindings: process.env.REMOTE_BINDINGS === "1",
    }),
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
