import { InMemoryTransport, type JSONRPCMessage } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ props: undefined as Record<string, unknown> | undefined }));

vi.mock("agents/mcp/server", () => ({
  getMcpAuthContext: () => (auth.props ? { props: auth.props } : undefined),
}));
vi.mock("~/recipes/search-index.server", () => ({ MAX_SEARCH_LIMIT: 100 }));
vi.mock("~/recipes/service.server", () => {
  class RecipeError extends Error {
    constructor(
      readonly code: string,
      message: string,
      readonly issues?: string[],
    ) {
      super(message);
    }
  }
  return {
    RecipeError,
    searchRecipes: vi.fn(async () => []),
    findSimilar: vi.fn(async () => []),
    MAX_SIMILAR: 49,
    getRecipeSource: vi.fn(),
    saveRecipe: vi.fn(async () => {
      throw new RecipeError("invalid", "Recipe is not valid.", ["kind: bad"]);
    }),
    deleteRecipe: vi.fn(),
    listTags: vi.fn(async () => []),
    logCook: vi.fn(),
  };
});

const service = await import("~/recipes/service.server");
const { createRecipesMcpServer } = await import("./server");

async function connect() {
  const [client, server] = InMemoryTransport.createLinkedPair();
  const pending = new Map<number, (message: JSONRPCMessage) => void>();
  client.onmessage = (message) => {
    if ("id" in message) pending.get(message.id as number)?.(message);
  };
  await createRecipesMcpServer().connect(server);
  await client.start();

  let id = 0;
  const request = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<any>((resolve) => {
      pending.set(++id, resolve);
      void client.send({ jsonrpc: "2.0", id, method, params });
    });
  await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  });
  await client.send({ jsonrpc: "2.0", method: "notifications/initialized" });
  return (name: string, args: Record<string, unknown>) =>
    request("tools/call", { name, arguments: args });
}

describe("MCP tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.props = undefined;
  });

  it("acts as the user from the grant, never from tool input", async () => {
    auth.props = { userId: "user-a" };
    const call = await connect();
    await call("search_recipes", { query: " lentil ", userId: "user-b" });
    expect(service.searchRecipes).toHaveBeenCalledWith("user-a", {
      query: "lentil",
      kind: undefined,
      tags: undefined,
      maxMinutes: undefined,
      limit: undefined,
    });
  });

  it("refuses to run without an authenticated user", async () => {
    const call = await connect();
    const response = await call("list_tags", {});
    expect(JSON.stringify(response)).toMatch(/Not authenticated/);
    expect(service.listTags).not.toHaveBeenCalled();
  });

  it("returns recipe errors to the model as tool errors", async () => {
    auth.props = { userId: "user-a" };
    const call = await connect();
    const { result } = await call("save_recipe", { markdown: "x" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("invalid: Recipe is not valid.\n- kind: bad");
  });

  it("find_similar takes exactly one of slug or text", async () => {
    auth.props = { userId: "user-a" };
    const call = await connect();
    for (const args of [{}, { slug: "dal", text: "lentils" }]) {
      const { result } = await call("find_similar", args);
      expect(result.isError).toBe(true);
    }
    expect(service.findSimilar).not.toHaveBeenCalled();

    await call("find_similar", { text: " like dal ", kind: "cook", limit: 5 });
    expect(service.findSimilar).toHaveBeenCalledWith(
      "user-a",
      { text: "like dal" },
      { kind: "cook", limit: 5 },
    );
    const { result } = await call("find_similar", { slug: "dal", limit: 50 });
    expect(result.isError).toBe(true);
  });
});
