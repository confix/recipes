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
    shareRecipe: vi.fn(async () => "AAAAAAAAAAAAAAAAAAAAAA"),
    unshareRecipe: vi.fn(async () => true),
  };
});

const service = await import("~/recipes/service.server");
const { createRecipesMcpServer } = await import("./server");

async function connect(origin = "https://recipes.test") {
  const [client, server] = InMemoryTransport.createLinkedPair();
  const pending = new Map<number, (message: JSONRPCMessage) => void>();
  client.onmessage = (message) => {
    if ("id" in message) pending.get(message.id as number)?.(message);
  };
  await createRecipesMcpServer({ origin }).connect(server);
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

  it("links every recipe in a result to its web page", async () => {
    auth.props = { userId: "user-a" };
    vi.mocked(service.searchRecipes).mockResolvedValueOnce([{ slug: "dal" } as never]);
    const call = await connect();
    const { result } = await call("search_recipes", {});
    expect(JSON.parse(result.content[0].text)).toEqual([
      { slug: "dal", url: "https://recipes.test/r/dal" },
    ]);
  });

  it("share_recipe returns a public link on the connected origin", async () => {
    auth.props = { userId: "user-a" };
    const call = await connect();
    const { result } = await call("share_recipe", { slug: "dal" });
    expect(service.shareRecipe).toHaveBeenCalledWith("user-a", "dal");
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      share_url: "https://recipes.test/s/AAAAAAAAAAAAAAAAAAAAAA",
      url: "https://recipes.test/r/dal",
    });
  });

  it("scale_recipe scales ingredients by factor or to servings", async () => {
    auth.props = { userId: "user-a" };
    vi.mocked(service.getRecipeSource).mockResolvedValue({
      slug: "dal",
      etag: "e",
      markdown: "---\ntitle: Dal\nkind: cook\nservings: 2\n---\n\n## Ingredients\n- 200 g lentils\n\n## Log\n- 2026-01-01 ★5\n",
    });
    const call = await connect();

    const byServings = (await call("scale_recipe", { slug: "dal", servings: 6 })).result;
    expect(byServings.content[0].text).toContain("- 600 g lentils");
    expect(byServings.content[0].text).not.toContain("★5");
    expect(JSON.parse(byServings.content[1].text)).toMatchObject({
      factor: 3,
      servings: "6",
      url: "https://recipes.test/r/dal?scale=3",
    });

    const both = (await call("scale_recipe", { slug: "dal", factor: 2, servings: 4 })).result;
    expect(both.isError).toBe(true);
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
