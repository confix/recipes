import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  // better-auth owns everything under /api/auth/*
  route("api/auth/*", "routes/api.auth.$.ts"),
  // Everything else under /api is the recipes REST API.
  route("api/*", "routes/api.$.ts"),
] satisfies RouteConfig;
