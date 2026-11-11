import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("logout", "routes/logout.tsx"),
  route("forgot-password", "routes/forgot-password.tsx"),
  route("reset-password", "routes/reset-password.tsx"),
  route("account/delete", "routes/account.delete.tsx"),
  route("imprint", "routes/imprint.tsx"),
  route("privacy", "routes/privacy.tsx"),
  // OAuth consent for MCP clients; OAuthProvider (workers/app.ts) owns the
  // rest of the OAuth endpoints and /mcp itself.
  route("authorize", "routes/authorize.tsx"),
  route("r/:slug", "routes/recipe.tsx"),
  // Public, session-independent share view; the token is the credential.
  route("s/:token", "routes/shared.tsx"),
  route("locale", "routes/locale.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("sitemap.xml", "routes/sitemap.ts"),
  // better-auth owns everything under /api/auth/*
  route("api/auth/*", "routes/api.auth.$.ts"),
  // Everything else under /api is the recipes REST API.
  route("api/*", "routes/api.$.ts"),
] satisfies RouteConfig;
