import { localhostAllowedHostnames } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";

import { createRecipesMcpServer } from "./server";

/**
 * The /mcp endpoint. OAuthProvider (workers/app.ts) has already checked the
 * bearer token and put the grant's props on ctx by the time a request gets
 * here.
 *
 * The handler rejects browser Origins it does not know. Setting this list
 * replaces its defaults, so localhost (MCP Inspector, local tools) is listed
 * again next to the hosted clients that connect from their web apps. Bearer
 * tokens are not ambient credentials, so an allowed Origin grants nothing by
 * itself.
 */
export const MCP_ALLOWED_ORIGIN_HOSTNAMES = [
  ...localhostAllowedHostnames(),
  "claude.ai",
  "claude.com",
];

export function createRecipesMcpHandler() {
  return createMcpHandler(createRecipesMcpServer, {
    route: "/mcp",
    allowedOriginHostnames: MCP_ALLOWED_ORIGIN_HOSTNAMES,
  });
}
