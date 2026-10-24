import * as v from "valibot";

import { getSessionUser } from "~/lib/auth.server";
import { RECIPE_KINDS } from "~/recipes/format";
import { MAX_SEARCH_LIMIT } from "~/recipes/search-index.server";
import {
  RecipeError,
  deleteRecipe,
  getRecipe,
  getRecipeSource,
  listTags,
  logCook,
  reindexAll,
  saveRecipe,
  searchRecipes,
} from "~/recipes/service.server";

import { createToken, listTokens, revokeToken, verifyToken } from "./tokens.server";

/**
 * REST API under /api (except /api/auth/*, which better-auth owns). A thin
 * adapter over app/recipes/service.server.ts: parse the request, call the
 * service, map errors to status codes.
 *
 *   GET    /api/recipes?q=&kind=&tag=&max_minutes=&limit=
 *   POST   /api/recipes                  markdown body → 201 { slug }
 *   GET    /api/recipes/:slug            JSON, or raw with Accept: text/markdown
 *   PUT    /api/recipes/:slug            create or replace; If-Match → 412 on mismatch
 *   DELETE /api/recipes/:slug
 *   POST   /api/recipes/:slug/log        { date?, rating?, notes? }
 *   GET    /api/tags
 *   POST   /api/reindex                  rebuild own index from R2
 *   GET    /api/tokens                   session only
 *   POST   /api/tokens                   session only, { name }
 *   DELETE /api/tokens/:id               session only
 *
 * Recipe bodies are either raw markdown or JSON { markdown }.
 */

const MAX_BODY_BYTES = 512 * 1024;

interface Caller {
  userId: string;
  via: "token" | "session";
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues?: string[],
  ) {
    super(message);
  }
}

function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, init);
}

function errorResponse(error: HttpError) {
  return json(
    { error: error.code, message: error.message, issues: error.issues },
    { status: error.status },
  );
}

async function authenticate(request: Request): Promise<Caller | null> {
  const header = request.headers.get("authorization");
  if (header) {
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    const userId = match ? await verifyToken(match[1]) : null;
    return userId ? { userId, via: "token" } : null;
  }

  const user = await getSessionUser(request);
  if (!user) return null;
  // Cookie-authenticated writes must come from our own pages. The session
  // cookie is SameSite=Lax already; this check does not rely on that.
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin !== new URL(request.url).origin) {
      throw new HttpError(403, "forbidden", "Cross-origin request rejected.");
    }
  }
  return { userId: user.id, via: "session" };
}

function issuesOf(issues: v.BaseIssue<unknown>[]) {
  return issues.map((issue) => {
    const path = v.getDotPath(issue);
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function validate<T extends v.GenericSchema>(schema: T, input: unknown) {
  const result = v.safeParse(schema, input);
  if (!result.success) {
    throw new HttpError(422, "invalid", "Invalid request.", issuesOf(result.issues));
  }
  return result.output as v.InferOutput<T>;
}

async function readText(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    throw new HttpError(413, "too_large", "Request body is too large.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new HttpError(413, "too_large", "Request body is too large.");
  }
  return text;
}

async function readJson(request: Request): Promise<unknown> {
  const text = await readText(request);
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "bad_request", "Body is not valid JSON.");
  }
}

function isJson(request: Request) {
  return (request.headers.get("content-type") ?? "").includes("application/json");
}

async function readMarkdown(request: Request) {
  if (!isJson(request)) return readText(request);
  return validate(
    v.object({ markdown: v.string() }),
    await readJson(request),
  ).markdown;
}

/** R2 etags are bare; HTTP etags are quoted and may be weak. */
function parseIfMatch(request: Request) {
  const value = request.headers.get("if-match");
  return value ? value.trim().replace(/^W\//, "").replace(/^"|"$/g, "") : undefined;
}

const SearchParamsSchema = v.object({
  q: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  kind: v.optional(v.picklist(RECIPE_KINDS)),
  tags: v.array(v.pipe(v.string(), v.trim(), v.toLowerCase(), v.nonEmpty())),
  max_minutes: v.optional(
    v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(0)),
  ),
  limit: v.optional(
    v.pipe(
      v.string(),
      v.toNumber(),
      v.integer(),
      v.minValue(1),
      v.maxValue(MAX_SEARCH_LIMIT),
    ),
  ),
});

const LogBodySchema = v.object({
  date: v.optional(
    v.pipe(v.string(), v.isoDate("date must be YYYY-MM-DD")),
  ),
  rating: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5)),
  ),
  notes: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2000))),
});

const TokenBodySchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxLength(100)),
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function route(request: Request, caller: Caller, path: string[]) {
  const { method } = request;
  const { userId } = caller;

  if (path[0] === "recipes") {
    const slug = path[1];

    if (path.length === 1 && method === "GET") {
      const params = new URL(request.url).searchParams;
      const input = validate(SearchParamsSchema, {
        q: params.get("q") || undefined,
        kind: params.get("kind") || undefined,
        // ?tag=a&tag=b and ?tag=a,b both work.
        tags: params.getAll("tag").flatMap((t) => t.split(",")),
        max_minutes: params.get("max_minutes") || undefined,
        limit: params.get("limit") || undefined,
      });
      const results = await searchRecipes(userId, {
        query: input.q,
        kind: input.kind,
        tags: input.tags,
        maxMinutes: input.max_minutes,
        limit: input.limit,
      });
      return json({ results });
    }

    if (path.length === 1 && method === "POST") {
      const saved = await saveRecipe(userId, await readMarkdown(request));
      return json(saved, {
        status: 201,
        headers: { Location: `/api/recipes/${saved.slug}`, ETag: `"${saved.etag}"` },
      });
    }

    if (path.length === 2 && method === "GET") {
      if ((request.headers.get("accept") ?? "").includes("text/markdown")) {
        const source = await getRecipeSource(userId, slug);
        return new Response(source.markdown, {
          headers: {
            ETag: `"${source.etag}"`,
            "Content-Type": "text/markdown; charset=utf-8",
          },
        });
      }
      const recipe = await getRecipe(userId, slug);
      return json(recipe, { headers: { ETag: `"${recipe.etag}"` } });
    }

    if (path.length === 2 && method === "PUT") {
      const saved = await saveRecipe(userId, await readMarkdown(request), {
        slug,
        ifMatch: parseIfMatch(request),
      });
      return json(saved, {
        status: saved.created ? 201 : 200,
        headers: { ETag: `"${saved.etag}"` },
      });
    }

    if (path.length === 2 && method === "DELETE") {
      await deleteRecipe(userId, slug);
      return new Response(null, { status: 204 });
    }

    if (path.length === 3 && path[2] === "log" && method === "POST") {
      const body = validate(LogBodySchema, await readJson(request));
      const logged = await logCook(userId, slug, {
        date: body.date ?? today(),
        rating: body.rating,
        notes: body.notes || undefined,
      });
      return json(logged, { status: 201 });
    }
  }

  if (path.length === 1 && path[0] === "tags" && method === "GET") {
    return json({ tags: await listTags(userId) });
  }

  if (path.length === 1 && path[0] === "reindex" && method === "POST") {
    return json(await reindexAll(userId));
  }

  if (path[0] === "tokens") {
    // A leaked token must not be able to mint more tokens.
    if (caller.via !== "session") {
      throw new HttpError(403, "forbidden", "Manage tokens from a signed-in session.");
    }
    if (path.length === 1 && method === "GET") {
      return json({ tokens: await listTokens(userId) });
    }
    if (path.length === 1 && method === "POST") {
      const body = validate(TokenBodySchema, await readJson(request));
      return json(await createToken(userId, body.name), { status: 201 });
    }
    if (path.length === 2 && method === "DELETE") {
      if (!(await revokeToken(userId, path[1]))) {
        throw new HttpError(404, "not_found", "No such token.");
      }
      return new Response(null, { status: 204 });
    }
  }

  throw new HttpError(404, "not_found", "No such endpoint.");
}

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new HttpError(400, "bad_request", "Malformed URL.");
  }
}

const RECIPE_ERROR_STATUS = {
  not_found: 404,
  invalid: 422,
  conflict: 409,
  precondition_failed: 412,
} as const;

export async function handleApi(request: Request): Promise<Response> {
  try {
    const caller = await authenticate(request);
    if (!caller) {
      throw new HttpError(401, "unauthorized", "Missing or invalid credentials.");
    }
    const path = new URL(request.url).pathname
      .replace(/^\/api\/?/, "")
      .split("/")
      .filter(Boolean)
      .map(decodeSegment);
    return await route(request, caller, path);
  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error);
    if (error instanceof RecipeError) {
      return errorResponse(
        new HttpError(
          RECIPE_ERROR_STATUS[error.code],
          error.code,
          error.message,
          error.issues,
        ),
      );
    }
    console.error(error);
    return json(
      { error: "internal", message: "Something went wrong." },
      { status: 500 },
    );
  }
}
