import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("logout", "routes/logout.tsx"),
  // OAuth consent for MCP clients; OAuthProvider (workers/app.ts) owns the
  // rest of the OAuth endpoints and /mcp itself.
  route("authorize", "routes/authorize.tsx"),
  route("r/:slug", "routes/recipe.tsx"),
  // better-auth owns everything under /api/auth/*
  route("api/auth/*", "routes/api.auth.$.ts"),
  // Everything else under /api is the recipes REST API.
  route("api/*", "routes/api.$.ts"),
] satisfies RouteConfig;
