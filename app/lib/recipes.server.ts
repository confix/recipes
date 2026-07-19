import { and, asc, desc, eq } from "drizzle-orm";

import { getDb } from "~/db";
import {
  attempts,
  ingredients,
  recipes,
  steps,
  type NewIngredient,
  type NewStep,
} from "~/db/schema/app";

/**
 * D1 caps bound parameters at 100 per statement. Drizzle emits one placeholder
 * per column per row, so a multi-row insert blows the cap faster than the row
 * count suggests: ingredients has 9 columns, so 12 rows already hits 108.
 * Chunk conservatively.
 */
function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

const INGREDIENT_CHUNK = 10; // 9 cols → 90 params
const STEP_CHUNK = 16; // 6 cols → 96 params

export interface RecipeInput {
  title: string;
  description?: string | null;
  servings?: number | null;
  yieldNote?: string | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  totalMinutes?: number | null;
  ingredients: Array<Omit<NewIngredient, "id" | "recipeId">>;
  steps: Array<Omit<NewStep, "id" | "recipeId">>;
}

/**
 * Create a root recipe (no parent). Returns the new id.
 *
 * Ids are generated here rather than read back from RETURNING: D1 does not
 * guarantee RETURNING ordering inside a batch, so we cannot insert the recipe
 * and use its generated id as a foreign key in the same batch.
 */
export async function createRecipe(
  ownerId: string,
  input: RecipeInput,
  source?: {
    sourceType?: "manual" | "url" | "pdf" | "image";
    sourceUrl?: string | null;
    sourceR2Key?: string | null;
    sourceRaw?: string | null;
  },
): Promise<string> {
  const db = getDb();
  const id = crypto.randomUUID();

  const statements: any[] = [
    db.insert(recipes).values({
      id,
      ownerId,
      rootId: id, // a root points at itself
      parentId: null,
      title: input.title,
      description: input.description ?? null,
      servings: input.servings ?? null,
      yieldNote: input.yieldNote ?? null,
      prepMinutes: input.prepMinutes ?? null,
      cookMinutes: input.cookMinutes ?? null,
      totalMinutes: input.totalMinutes ?? null,
      sourceType: source?.sourceType ?? "manual",
      sourceUrl: source?.sourceUrl ?? null,
      sourceR2Key: source?.sourceR2Key ?? null,
      sourceRaw: source?.sourceRaw ?? null,
    }),
  ];

  for (const group of chunk(input.ingredients, INGREDIENT_CHUNK)) {
    statements.push(
      db
        .insert(ingredients)
        .values(group.map((i) => ({ ...i, id: crypto.randomUUID(), recipeId: id }))),
    );
  }
  for (const group of chunk(input.steps, STEP_CHUNK)) {
    statements.push(
      db.insert(steps).values(group.map((s) => ({ ...s, id: crypto.randomUUID(), recipeId: id }))),
    );
  }

  // batch() is atomic on D1. db.transaction() would compile but gives no
  // rollback here — see the note in app/db/index.ts.
  await db.batch(statements as [any, ...any[]]);
  return id;
}

/**
 * Fork a recipe into a new variation: a full copy of the row, its ingredients
 * and its steps, with parentId set and rootId inherited.
 *
 * Copy-on-write rather than stored diffs — the diff is computed at read time
 * against the parent. That keeps every node independently editable and means a
 * variation never breaks when its parent changes.
 *
 * Ownership is enforced here: forking someone else's recipe returns null
 * rather than silently copying it.
 */
export async function forkRecipe(
  ownerId: string,
  sourceRecipeId: string,
  overrides?: { title?: string },
): Promise<string | null> {
  const db = getDb();

  const parent = await db.query.recipes.findFirst({
    where: and(eq(recipes.id, sourceRecipeId), eq(recipes.ownerId, ownerId)),
    with: { ingredients: true, steps: true },
  });
  if (!parent) return null;

  const id = crypto.randomUUID();
  const statements: any[] = [
    db.insert(recipes).values({
      id,
      ownerId,
      rootId: parent.rootId, // stays in the same family
      parentId: parent.id,
      title: overrides?.title ?? `${parent.title} (variation)`,
      description: parent.description,
      servings: parent.servings,
      yieldNote: parent.yieldNote,
      prepMinutes: parent.prepMinutes,
      cookMinutes: parent.cookMinutes,
      totalMinutes: parent.totalMinutes,
      sourceType: parent.sourceType,
      sourceUrl: parent.sourceUrl,
      sourceR2Key: parent.sourceR2Key,
      sourceRaw: parent.sourceRaw,
    }),
  ];

  for (const group of chunk(parent.ingredients, INGREDIENT_CHUNK)) {
    statements.push(
      db.insert(ingredients).values(
        group.map((i) => ({
          id: crypto.randomUUID(),
          recipeId: id,
          groupName: i.groupName,
          sortOrder: i.sortOrder,
          quantity: i.quantity,
          unit: i.unit,
          name: i.name,
          note: i.note,
          role: i.role,
        })),
      ),
    );
  }
  for (const group of chunk(parent.steps, STEP_CHUNK)) {
    statements.push(
      db.insert(steps).values(
        group.map((s) => ({
          id: crypto.randomUUID(),
          recipeId: id,
          sortOrder: s.sortOrder,
          text: s.text,
          temperatureC: s.temperatureC,
          minutes: s.minutes,
        })),
      ),
    );
  }

  await db.batch(statements as [any, ...any[]]);
  return id;
}

/**
 * Rename a recipe or variation. The title IS the variation's identity in the
 * family table, so this is how you turn "Sourdough Boule (variation)" into
 * "80% hydration". Owner-scoped; returns false if the recipe isn't the
 * caller's (indistinguishable from missing).
 */
export async function renameRecipe(
  ownerId: string,
  id: string,
  title: string,
): Promise<boolean> {
  const clean = title.trim();
  if (!clean) return false;

  const db = getDb();
  const owned = await db.query.recipes.findFirst({
    where: and(eq(recipes.id, id), eq(recipes.ownerId, ownerId)),
    columns: { id: true },
  });
  if (!owned) return false;

  await db
    .update(recipes)
    .set({ title: clean, updatedAt: new Date() })
    .where(eq(recipes.id, id));
  return true;
}

/** Full recipe with ingredients, steps and attempts. Owner-scoped. */
export async function getRecipe(ownerId: string, id: string) {
  const db = getDb();
  return db.query.recipes.findFirst({
    where: and(eq(recipes.id, id), eq(recipes.ownerId, ownerId)),
    with: {
      ingredients: { orderBy: [asc(ingredients.sortOrder)] },
      steps: { orderBy: [asc(steps.sortOrder)] },
      attempts: { orderBy: [desc(attempts.cookedOn)] },
    },
  });
}

/**
 * Every node in a variation family, in one indexed query — this is what rootId
 * denormalisation buys us over a recursive parent walk.
 */
export async function getFamily(ownerId: string, rootId: string) {
  const db = getDb();
  return db.query.recipes.findMany({
    where: and(eq(recipes.rootId, rootId), eq(recipes.ownerId, ownerId)),
    with: {
      ingredients: { orderBy: [asc(ingredients.sortOrder)] },
      attempts: { orderBy: [desc(attempts.cookedOn)] },
    },
    orderBy: [asc(recipes.createdAt)],
  });
}

/**
 * The user's own ingredient and unit vocabulary, for type-ahead on the entry
 * form. Distinct values across all their recipes — so a name typed once
 * autocompletes forever after. Owner-scoped: suggestions never leak another
 * user's ingredients.
 */
export async function getIngredientVocabulary(
  ownerId: string,
): Promise<{ names: string[]; units: string[] }> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ name: ingredients.name, unit: ingredients.unit })
    .from(ingredients)
    .innerJoin(recipes, eq(ingredients.recipeId, recipes.id))
    .where(eq(recipes.ownerId, ownerId));

  const names = new Set<string>();
  const units = new Set<string>();
  for (const row of rows) {
    if (row.name) names.add(row.name);
    if (row.unit) units.add(row.unit);
  }
  return {
    names: [...names].sort((a, b) => a.localeCompare(b)),
    units: [...units].sort((a, b) => a.localeCompare(b)),
  };
}

export async function listRecipes(ownerId: string) {
  const db = getDb();
  return db.query.recipes.findMany({
    where: eq(recipes.ownerId, ownerId),
    orderBy: [desc(recipes.updatedAt)],
    with: { attempts: { orderBy: [desc(attempts.cookedOn)] } },
  });
}
