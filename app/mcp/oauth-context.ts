import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { createContext } from "react-router";

/**
 * OAuthProvider hands its helpers to the default handler as
 * `env.OAUTH_PROVIDER` — on the per-request env, not on the global one from
 * `cloudflare:workers`. workers/app.ts copies them into the router context so
 * the /authorize route can reach them.
 */
export const oauthHelpersContext = createContext<OAuthHelpers>();
