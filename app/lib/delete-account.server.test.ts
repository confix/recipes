import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const batch = vi.fn(async (statements: { sql: string; args: unknown[] }[]) => {
  calls.push("d1");
  return statements;
});

vi.mock("cloudflare:workers", () => ({
  env: {
    DB: {
      prepare: (sql: string) => ({ bind: (...args: unknown[]) => ({ sql, args }) }),
      batch,
    },
  },
}));
vi.mock("~/lib/auth.server", () => ({ getAuth: vi.fn() }));
vi.mock("~/recipes/search-index.server", () => ({
  indexedSlugs: vi.fn(async () => ["dal", "orphan-row"]),
}));
vi.mock("~/recipes/semantic.server", () => ({
  deleteRecipeVectors: vi.fn(async () => void calls.push("vectors")),
}));
vi.mock("~/recipes/storage.server", () => ({
  listRecipeSlugs: vi.fn(async () => ["dal", "bread"]),
  deleteAllUserFiles: vi.fn(async () => void calls.push("r2")),
}));

const semantic = await import("~/recipes/semantic.server");
const storage = await import("~/recipes/storage.server");
const { deleteAccount } = await import("./delete-account.server");

function oauthWith(pages: string[][]) {
  return {
    listUserGrants: vi.fn(async (_user: string, { cursor }: { cursor?: string } = {}) => {
      const i = cursor ? Number(cursor) : 0;
      return {
        items: pages[i].map((id) => ({ id })),
        cursor: i + 1 < pages.length ? String(i + 1) : undefined,
      };
    }),
    revokeGrant: vi.fn(async () => void calls.push("grant")),
  };
}

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
});

describe("deleteAccount", () => {
  it("revokes every grant first and deletes the user row last", async () => {
    const oauth = oauthWith([["g1", "g2"], ["g3"]]);
    await deleteAccount("u1", oauth as never);

    expect(oauth.revokeGrant.mock.calls).toEqual([
      ["g1", "u1"],
      ["g2", "u1"],
      ["g3", "u1"],
    ]);
    expect(calls).toEqual(["grant", "grant", "grant", "d1", "vectors", "r2", "d1"]);

    // API tokens and sessions go before any file does.
    expect(batch.mock.calls[0][0].map((s) => s.sql)).toEqual([
      "DELETE FROM api_tokens WHERE user_id = ?",
      "DELETE FROM session WHERE user_id = ?",
    ]);
    const statements = batch.mock.calls[1][0];
    expect(statements.at(-1)).toEqual({ sql: "DELETE FROM user WHERE id = ?", args: ["u1"] });
    expect(statements.some((s) => s.sql.includes("recipe_fts"))).toBe(true);
  });

  it("deletes vectors for slugs in R2 or the index, once each", async () => {
    await deleteAccount("u1", oauthWith([[]]) as never);
    expect(vi.mocked(semantic.deleteRecipeVectors)).toHaveBeenCalledWith("u1", ["dal", "bread", "orphan-row"]);
    expect(vi.mocked(storage.deleteAllUserFiles)).toHaveBeenCalledWith("u1");
  });

  it("still deletes the account when Vectorize is down", async () => {
    vi.mocked(semantic.deleteRecipeVectors).mockRejectedValueOnce(new Error("no vectorize"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    await deleteAccount("u1", oauthWith([[]]) as never);
    expect(calls).toEqual(["d1", "r2", "d1"]);
  });

  it("keeps the account when deleting files fails, so it can try again", async () => {
    vi.mocked(storage.deleteAllUserFiles).mockRejectedValueOnce(new Error("r2 down"));
    await expect(deleteAccount("u1", oauthWith([[]]) as never)).rejects.toThrow("r2 down");
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0].some((s) => s.sql.includes("FROM user"))).toBe(false);
  });
});
