import { OAuthProvider, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { createMcpHandler } from "agents/mcp/server";
import { RouterContextProvider, createRequestHandler } from "react-router";

import { oauthHelpersContext } from "~/mcp/oauth-context";
import { createRecipesMcpServer } from "~/mcp/server";

type OAuthEnv = Env & { OAUTH_PROVIDER: OAuthHelpers };

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

const mcpHandler = createMcpHandler(createRecipesMcpServer, { route: "/mcp" });

/**
 * OAuthProvider owns the OAuth endpoints and guards /mcp: requests there must
 * carry an access token it issued, and the grant's props (`{ userId }`, set
 * in app/routes/authorize.tsx) reach the tools via getMcpAuthContext().
 * Everything else — pages, better-auth, the token-authenticated REST API —
 * falls through to React Router.
 *
 * The provider needs its canonical resource URL up front, so it is built per
 * origin rather than configured: local dev, preview URLs and production each
 * get one, and tokens are bound to the origin that issued them. On Workers
 * the origin is the routed hostname, not something a client can pick.
 */
function createProvider(origin: string) {
  return new OAuthProvider<OAuthEnv>({
    apiRoute: "/mcp",
    apiHandler: {
      fetch(request, env, ctx) {
        return mcpHandler(request, env, ctx);
      },
    },
    defaultHandler: {
      fetch(request, env) {
        const context = new RouterContextProvider();
        context.set(oauthHelpersContext, env.OAUTH_PROVIDER);
        return requestHandler(request, context);
      },
    },
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/oauth/token",
    clientRegistrationEndpoint: "/oauth/register",
    resourceMetadata: {
      resource: `${origin}/mcp`,
      authorization_servers: [origin],
      resource_name: "Recipes",
    },
  });
}

/** OAuth 2.1 only allows https, or http on loopback for local development. */
function canServeOAuth({ protocol, hostname }: URL) {
  return (
    protocol === "https:" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
  );
}

/** Origins seen by this isolate are few (prod, preview, dev); cap it anyway. */
const MAX_PROVIDERS = 16;
const providers = new Map<string, OAuthProvider<OAuthEnv>>();

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!canServeOAuth(url)) {
      // e.g. plain http on a custom domain: the pages and REST API still
      // work, there is just no MCP/OAuth here.
      return requestHandler(request, new RouterContextProvider());
    }

    let provider = providers.get(url.origin);
    if (!provider) {
      if (providers.size >= MAX_PROVIDERS) providers.clear();
      provider = createProvider(url.origin);
      providers.set(url.origin, provider);
    }
    // OAuthProvider caches its helpers on the env it is given
    // (`env.OAUTH_PROVIDER ??= …`), and the runtime reuses `env` across
    // requests. A per-request child object keeps one origin's helpers — with
    // its issuer and resource — from leaking into another origin's requests.
    return provider.fetch(request, Object.create(env) as OAuthEnv, ctx);
  },
} satisfies ExportedHandler<Env>;
