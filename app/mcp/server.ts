import { McpServer } from "@modelcontextprotocol/server";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { getMcpAuthContext } from "agents/mcp/server";
import * as v from "valibot";

import { bakersPercentages } from "~/lib/bakers-math";
import { RECIPE_KINDS, SlugSchema, parseRecipe } from "~/recipes/format";
import { MAX_SEARCH_LIMIT } from "~/recipes/search-index.server";
import {
  MAX_SIMILAR,
  RecipeError,
  deleteRecipe,
  findSimilar,
  getRecipeSource,
  listTags,
  logCook,
  saveRecipe,
  searchRecipes,
} from "~/recipes/service.server";

/**
 * The MCP server: the same operations as the REST API, as tools. A thin
 * adapter over app/recipes/service.server.ts. A fresh server is built per
 * request (see createMcpHandler in workers/app.ts); the user comes from the
 * OAuth grant's props, set in app/routes/authorize.tsx.
 */

const INSTRUCTIONS = `Manage the user's personal recipe collection.

Each recipe is one markdown file: YAML frontmatter, then a free-form body.

---
title: Country Sourdough        # required
kind: bake                      # required: bake | cook
tags: [bread, sourdough]        # lowercase
servings: 2 loaves              # free text
time: { active: 45, total: 1440 }   # minutes
source: https://…               # where it came from
variant_of: basic-sourdough     # slug of the recipe this is a variation of
formula:                        # bakes only: weights in grams + role
  - { name: bread flour, grams: 1000, role: flour }   # roles: flour liquid salt leaven fat sugar other
  - { name: water, grams: 750, role: liquid, note: 30 °C }
---

Short description paragraph (shown in search results).

## Ingredients
- 200 g red lentils             # cook recipes list ingredients here

## Method
1. …

## Log
- 2026-10-12 ★4 — notes          # maintained by log_cook; don't edit by hand

Use search_recipes before creating, to avoid duplicates. To edit, get_recipe,
change the markdown, and save_recipe with the same slug and the etag as
if_match. Record that the user made a recipe with log_cook rather than by
editing the Log section.`;

/** valibot schema → the Standard Schema + JSON Schema the MCP SDK expects. */
const input = <T extends v.GenericSchema>(schema: T) => toStandardJsonSchema(schema);

const Slug = v.pipe(SlugSchema, v.description("Recipe slug, e.g. country-sourdough"));

function userId(): string {
  const id = getMcpAuthContext()?.props.userId;
  // OAuthProvider rejects unauthenticated requests before they get here.
  if (typeof id !== "string" || !id) throw new Error("Not authenticated.");
  return id;
}

function text(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

/** Expected failures go back to the model as tool errors it can act on. */
async function run(fn: () => Promise<ReturnType<typeof text>>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof RecipeError) {
      const issues = error.issues?.length ? `\n- ${error.issues.join("\n- ")}` : "";
      return { ...text(`${error.code}: ${error.message}${issues}`), isError: true };
    }
    throw error;
  }
}

export function createRecipesMcpServer() {
  const server = new McpServer(
    { name: "recipes", version: "1.0.0" },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "search_recipes",
    {
      title: "Search recipes",
      description:
        "Search by keywords and by meaning at once: 'lentil' and 'something warming for a cold evening' both work. Optional filters narrow the results. Without a query, lists recipes most recently updated first.",
      inputSchema: input(
        v.object({
          query: v.optional(
            v.pipe(
              v.string(),
              v.trim(),
              v.maxLength(500),
              v.description("Keywords, e.g. 'lentil coconut'"),
            ),
          ),
          kind: v.optional(v.picklist(RECIPE_KINDS)),
          tags: v.optional(
            v.pipe(v.array(v.string()), v.maxLength(10), v.description("Every tag must match")),
          ),
          max_minutes: v.optional(
            v.pipe(
              v.number(),
              v.integer(),
              v.minValue(0),
              v.description("Maximum total time in minutes"),
            ),
          ),
          limit: v.optional(
            v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_SEARCH_LIMIT)),
          ),
        }),
      ),
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      run(async () =>
        text(
          await searchRecipes(userId(), {
            query: args.query,
            kind: args.kind,
            tags: args.tags?.map((t) => t.trim().toLowerCase()).filter(Boolean),
            maxMinutes: args.max_minutes,
            limit: args.limit,
          }),
        ),
      ),
  );

  server.registerTool(
    "find_similar",
    {
      title: "Find similar recipes",
      description:
        "Recipes most like a given recipe (slug) or a description (text), most similar first, with a similarity score. Give exactly one of slug or text.",
      inputSchema: input(
        v.object({
          slug: v.optional(Slug),
          text: v.optional(
            v.pipe(
              v.string(),
              v.trim(),
              v.nonEmpty(),
              v.maxLength(2000),
              v.description("e.g. 'like a focaccia but with rye'"),
            ),
          ),
          kind: v.optional(v.picklist(RECIPE_KINDS)),
          limit: v.optional(
            v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_SIMILAR)),
          ),
        }),
      ),
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      run(async () => {
        if (!args.slug === !args.text) {
          return { ...text("invalid: Give exactly one of slug or text."), isError: true };
        }
        return text(
          await findSimilar(
            userId(),
            args.slug ? { slug: args.slug } : { text: args.text! },
            { kind: args.kind, limit: args.limit },
          ),
        );
      }),
  );

  server.registerTool(
    "get_recipe",
    {
      title: "Get recipe",
      description:
        "The recipe's markdown, plus its etag (for save_recipe's if_match) and, for bakes with a formula, baker's percentages and hydration.",
      inputSchema: input(v.object({ slug: Slug })),
      annotations: { readOnlyHint: true },
    },
    async ({ slug }) =>
      run(async () => {
        const source = await getRecipeSource(userId(), slug);
        const parsed = parseRecipe(source.markdown);
        const formula = parsed.ok ? parsed.recipe.frontmatter.formula : undefined;
        const details = {
          slug,
          etag: source.etag,
          ...(parsed.ok ? {} : { invalid: parsed.issues }),
          ...(formula ? { bakers: bakersPercentages(formula) } : {}),
        };
        return {
          content: [
            { type: "text" as const, text: source.markdown },
            { type: "text" as const, text: JSON.stringify(details, null, 2) },
          ],
        };
      }),
  );

  server.registerTool(
    "save_recipe",
    {
      title: "Save recipe",
      description:
        "Create a recipe (omit slug; one is derived from the title) or replace one (give its slug). Pass the etag from get_recipe as if_match when editing, so concurrent changes are not overwritten.",
      inputSchema: input(
        v.object({
          markdown: v.pipe(
            v.string(),
            v.description("The full recipe file: frontmatter + body"),
          ),
          slug: v.optional(Slug),
          if_match: v.optional(v.string()),
        }),
      ),
      // Replacing by slug overwrites the stored recipe.
      annotations: { destructiveHint: true, idempotentHint: false },
    },
    async (args) =>
      run(async () =>
        text(
          await saveRecipe(userId(), args.markdown, {
            slug: args.slug,
            ifMatch: args.if_match,
          }),
        ),
      ),
  );

  server.registerTool(
    "log_cook",
    {
      title: "Log a cook",
      description: "Record that the recipe was made, with an optional rating and notes.",
      inputSchema: input(
        v.object({
          slug: Slug,
          date: v.optional(
            v.pipe(v.string(), v.isoDate(), v.description("YYYY-MM-DD; defaults to today")),
          ),
          rating: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5))),
          notes: v.optional(v.pipe(v.string(), v.maxLength(2000))),
        }),
      ),
    },
    async (args) =>
      run(async () =>
        text(
          await logCook(userId(), args.slug, {
            date: args.date ?? new Date().toISOString().slice(0, 10),
            rating: args.rating,
            notes: args.notes?.trim() || undefined,
          }),
        ),
      ),
  );

  server.registerTool(
    "list_tags",
    {
      title: "List tags",
      description: "All tags in use with their recipe counts. Reuse these for consistent tagging.",
      annotations: { readOnlyHint: true },
    },
    async () => run(async () => text(await listTags(userId()))),
  );

  server.registerTool(
    "delete_recipe",
    {
      title: "Delete recipe",
      description: "Permanently delete a recipe, including its cooking log.",
      inputSchema: input(v.object({ slug: Slug })),
      annotations: { destructiveHint: true },
    },
    async ({ slug }) =>
      run(async () => {
        await deleteRecipe(userId(), slug);
        return text(`Deleted ${slug}.`);
      }),
  );

  return server;
}
