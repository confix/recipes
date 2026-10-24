import { describe, expect, it, vi } from "vitest";

vi.mock("~/recipes/search-index.server", () => ({ MAX_SEARCH_LIMIT: 100 }));
vi.mock("~/recipes/service.server", () => ({
  RecipeError: class extends Error {},
  MAX_SIMILAR: 49,
}));

const { createRecipesMcpHandler } = await import("./handler");

/**
 * Drives the handler exactly as deployed: over HTTP, on the production host,
 * with what OAuthProvider puts on ctx. A tool whose schema cannot be turned
 * into JSON Schema breaks tools/list for every client — which is what a
 * connected client reports as "no tools" — so list them here.
 */
const handler = createRecipesMcpHandler();
const ctx = {
  props: { userId: "user-a" },
  waitUntil() {},
  passThroughOnException() {},
} as unknown as ExecutionContext;

async function rpc(method: string, headers: Record<string, string> = {}) {
  const response = await handler(
    new Request("https://recipes.confix.run/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params:
          method === "initialize"
            ? {
                protocolVersion: "2025-06-18",
                capabilities: {},
                clientInfo: { name: "test", version: "1" },
              }
            : {},
      }),
    }),
    {},
    ctx,
  );
  const body = await response.text();
  const data = body.startsWith("{")
    ? body
    : body
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5))
        .join("");
  return { status: response.status, message: JSON.parse(data) };
}

describe("/mcp", () => {
  it("lists every tool with a JSON Schema for its input", async () => {
    const { status, message } = await rpc("tools/list");
    expect(status).toBe(200);
    expect(message.error).toBeUndefined();
    const tools = message.result.tools as Array<{ name: string; inputSchema: unknown }>;
    expect(tools.map((t) => t.name).sort()).toEqual([
      "delete_recipe",
      "find_similar",
      "get_recipe",
      "list_tags",
      "log_cook",
      "save_recipe",
      "search_recipes",
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema).toMatchObject({ type: "object" });
    }
  });

  it("accepts requests from Claude's web app", async () => {
    for (const origin of ["https://claude.ai", "https://claude.com"]) {
      const { status, message } = await rpc("initialize", { origin });
      expect(status).toBe(200);
      expect(message.result.serverInfo.name).toBe("recipes");
    }
  });

  it("keeps the default localhost allowance (MCP Inspector)", async () => {
    const { status } = await rpc("initialize", { origin: "http://localhost:6274" });
    expect(status).toBe(200);
  });

  it("still rejects unknown browser origins", async () => {
    const { status } = await rpc("initialize", { origin: "https://evil.example" });
    expect(status).toBe(403);
  });
});
