import { McpServer } from "@modelcontextprotocol/server";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { getMcpAuthContext } from "agents/mcp/server";
import * as v from "valibot";

import { bakersPercentages } from "~/lib/bakers-math";
import { RECIPE_KINDS, SlugSchema, parseRecipe, withoutLog } from "~/recipes/format";
import {
  MAX_SCALE,
  MIN_SCALE,
  scaleFormula,
  scaleIngredientSections,
  scaleServings,
} from "~/recipes/scale";
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
  shareRecipe,
  unshareRecipe,
} from "~/recipes/service.server";

/**
 * The MCP server: the same operations as the REST API, as tools. A thin
 * adapter over app/recipes/service.server.ts. A fresh server is built per
 * request (see createMcpHandler in workers/app.ts); the user comes from the
 * OAuth grant's props, set in app/routes/authorize.tsx.
 *
 * Results carry web links (`url`) built from the origin the client connected
 * to, so the model can hand the user a clickable link to a recipe instead of
 * a bare slug.
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

Every recipe in a result has a \`url\`: its page on the web, for the signed-in
owner. When you mention a recipe to the user, link its title to that url. To
let someone else read a recipe, share_recipe returns a public link anyone can
open (and import a copy from, if they have an account).

To cook a different amount, scale_recipe returns the ingredients scaled by a
factor or to a number of servings. It is for reading out; never save the
scaled text back over the recipe.

Use search_recipes before creating, to avoid duplicates. To edit, get_recipe,
change the markdown, and save_recipe with the same slug and the etag as
if_match. Record that the user made a recipe with log_cook rather than by
editing the Log section.`;

/**
 * valibot schema → the Standard Schema + JSON Schema the MCP SDK expects.
 * Input schemas must not contain transforms (v.trim, v.toLowerCase, …): JSON
 * Schema cannot express them, the conversion throws, and tools/list fails —
 * clients then see a server without tools. Normalize in the handler instead.
 */
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

export interface McpServerOptions {
  /** Origin of the deployment, e.g. https://recipes.confix.run. */
  origin?: string;
}

export function createRecipesMcpServer({ origin = "" }: McpServerOptions = {}) {
  const recipeUrl = (slug: string) => `${origin}/r/${slug}`;
  const withUrls = <T extends { slug: string }>(hits: T[]) =>
    hits.map((hit) => ({ ...hit, url: recipeUrl(hit.slug) }));

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
          withUrls(
            await searchRecipes(userId(), {
              query: args.query?.trim() || undefined,
              kind: args.kind,
              tags: args.tags?.map((t) => t.trim().toLowerCase()).filter(Boolean),
              maxMinutes: args.max_minutes,
              limit: args.limit,
            }),
          ),
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
        const description = args.text?.trim();
        if (!args.slug === !description) {
          return { ...text("invalid: Give exactly one of slug or text."), isError: true };
        }
        return text(
          withUrls(
            await findSimilar(
              userId(),
              args.slug ? { slug: args.slug } : { text: description! },
              { kind: args.kind, limit: args.limit },
            ),
          ),
        );
      }),
  );

  server.registerTool(
    "get_recipe",
    {
      title: "Get recipe",
      description:
        "The recipe's markdown, plus its web url, its etag (for save_recipe's if_match) and, for bakes with a formula, baker's percentages and hydration.",
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
          url: recipeUrl(slug),
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
      run(async () => {
        const saved = await saveRecipe(userId(), args.markdown, {
          slug: args.slug,
          ifMatch: args.if_match,
        });
        return text({ ...saved, url: recipeUrl(saved.slug) });
      }),
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
      run(async () => {
        const logged = await logCook(userId(), args.slug, {
          date: args.date ?? new Date().toISOString().slice(0, 10),
          rating: args.rating,
          notes: args.notes?.trim() || undefined,
        });
        return text({ ...logged, url: recipeUrl(args.slug) });
      }),
  );

  server.registerTool(
    "scale_recipe",
    {
      title: "Scale recipe",
      description:
        "The recipe with its ingredient amounts scaled: by a factor (2 = double), or to a number of servings when the recipe states a numeric servings count. Scales formula grams, servings and the leading quantity of each line under an Ingredients heading; method text is unchanged. Read-only: never save the result back.",
      inputSchema: input(
        v.object({
          slug: Slug,
          factor: v.optional(
            v.pipe(v.number(), v.minValue(MIN_SCALE), v.maxValue(MAX_SCALE), v.description("e.g. 2, 0.5, 1.5")),
          ),
          servings: v.optional(
            v.pipe(v.number(), v.minValue(0.5), v.description("Target servings, instead of a factor")),
          ),
        }),
      ),
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      run(async () => {
        if ((args.factor === undefined) === (args.servings === undefined)) {
          return { ...text("invalid: Give exactly one of factor or servings."), isError: true };
        }
        const source = await getRecipeSource(userId(), args.slug);
        const parsed = parseRecipe(source.markdown);
        if (!parsed.ok) {
          return { ...text(`invalid: The recipe file has problems:\n- ${parsed.issues.join("\n- ")}`), isError: true };
        }
        const fm = parsed.recipe.frontmatter;
        let factor = args.factor ?? 1;
        if (args.servings !== undefined) {
          const base = Number.parseFloat(fm.servings ?? "");
          if (!(base > 0)) {
            return {
              ...text(`invalid: "${args.slug}" has no numeric servings to scale from; give a factor instead.`),
              isError: true,
            };
          }
          factor = args.servings / base;
        }
        factor = Math.min(Math.max(factor, MIN_SCALE), MAX_SCALE);
        const scaled = {
          slug: args.slug,
          url: `${recipeUrl(args.slug)}?scale=${Number(factor.toFixed(3))}`,
          factor: Number(factor.toFixed(3)),
          servings: fm.servings ? scaleServings(fm.servings, factor) : undefined,
          formula: fm.formula ? scaleFormula(fm.formula, factor) : undefined,
        };
        return {
          content: [
            { type: "text" as const, text: scaleIngredientSections(withoutLog(parsed.recipe.body), factor).trim() },
            { type: "text" as const, text: JSON.stringify(scaled, null, 2) },
          ],
        };
      }),
  );

  server.registerTool(
    "share_recipe",
    {
      title: "Share recipe",
      description:
        "A public link to the recipe that anyone can open without an account; people with an account can import their own copy. The cooking log is never shared. Sharing an already shared recipe returns the same link.",
      inputSchema: input(v.object({ slug: Slug })),
      annotations: { idempotentHint: true },
    },
    async ({ slug }) =>
      run(async () => {
        const token = await shareRecipe(userId(), slug);
        return text({ slug, share_url: `${origin}/s/${token}`, url: recipeUrl(slug) });
      }),
  );

  server.registerTool(
    "unshare_recipe",
    {
      title: "Stop sharing recipe",
      description:
        "Disable the recipe's public link. Copies others already imported stay theirs.",
      inputSchema: input(v.object({ slug: Slug })),
      annotations: { idempotentHint: true },
    },
    async ({ slug }) =>
      run(async () =>
        text((await unshareRecipe(userId(), slug)) ? `Stopped sharing ${slug}.` : `${slug} was not shared.`),
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
