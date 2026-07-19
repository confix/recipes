import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";

/**
 * All primary keys are generated client-side with crypto.randomUUID().
 * D1 has no interactive transactions, so multi-table writes go through
 * db.batch(), and RETURNING ordering inside a batch is not reliable — we
 * cannot insert a recipe, read back its id, and use it as a foreign key in a
 * later statement of the same batch. Generating ids up front sidesteps that
 * entirely.
 */

export const SOURCE_TYPES = ["manual", "url", "pdf", "image"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * An ingredient's role in the formula. This exists so baker's percentages and
 * hydration are derivable rather than hand-entered — see bakersPercentages()
 * in app/lib/bakers-math.ts. `other` is the safe default; only bread-style
 * recipes need the rest to be accurate.
 */
export const INGREDIENT_ROLES = [
  "flour",
  "liquid",
  "salt",
  "leaven",
  "fat",
  "sugar",
  "other",
] as const;
export type IngredientRole = (typeof INGREDIENT_ROLES)[number];

export const recipes = sqliteTable(
  "recipes",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /**
     * Fork tree. A fork is a full copy of the row plus its ingredients and
     * steps with parentId set — not a stored diff; diffs are computed at read
     * time against the parent. rootId is denormalized onto every node so an
     * entire family loads in one indexed query instead of a recursive walk.
     * A root node has rootId === id and parentId === null.
     */
    rootId: text("root_id").notNull(),
    parentId: text("parent_id"),

    title: text("title").notNull(),
    description: text("description"),

    sourceType: text("source_type", { enum: SOURCE_TYPES })
      .notNull()
      .default("manual"),
    sourceUrl: text("source_url"),
    sourceR2Key: text("source_r2_key"),
    /**
     * Raw JSON-LD or raw provider extraction, kept verbatim. Reparsing this
     * beats re-fetching a page that may be gone or paywalled, and it is the
     * ground truth when an import lands wrong.
     */
    sourceRaw: text("source_raw"),

    servings: integer("servings"),
    yieldNote: text("yield_note"),
    prepMinutes: integer("prep_minutes"),
    cookMinutes: integer("cook_minutes"),
    totalMinutes: integer("total_minutes"),

    isPublic: integer("is_public", { mode: "boolean" })
      .notNull()
      .default(false),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("recipes_owner_idx").on(t.ownerId),
    // Loads a whole variation family; owner-scoped to keep tenancy in the index.
    index("recipes_root_idx").on(t.ownerId, t.rootId),
    index("recipes_parent_idx").on(t.parentId),
  ],
);

export const ingredients = sqliteTable(
  "ingredients",
  {
    id: text("id").primaryKey(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),

    /** e.g. "Dough", "Filling", "Topping". Null = ungrouped. */
    groupName: text("group_name"),
    sortOrder: integer("sort_order").notNull().default(0),

    /** Null for "a pinch" / "to taste" — unit and name still carry meaning. */
    quantity: real("quantity"),
    unit: text("unit"),
    name: text("name").notNull(),
    note: text("note"),

    role: text("role", { enum: INGREDIENT_ROLES }).notNull().default("other"),
  },
  (t) => [index("ingredients_recipe_idx").on(t.recipeId, t.sortOrder)],
);

export const steps = sqliteTable(
  "steps",
  {
    id: text("id").primaryKey(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    text: text("text").notNull(),
    temperatureC: integer("temperature_c"),
    minutes: integer("minutes"),
  },
  (t) => [index("steps_recipe_idx").on(t.recipeId, t.sortOrder)],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("tags_owner_name_idx").on(t.ownerId, t.name)],
);

export const recipeTags = sqliteTable(
  "recipe_tags",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("recipe_tags_pk").on(t.recipeId, t.tagId),
    index("recipe_tags_tag_idx").on(t.tagId),
  ],
);

/**
 * The bake log: one row per time the recipe was actually made. This is the
 * distinction that makes "which variation worked?" answerable — a recipe node
 * is the formula, an attempt is an instance of cooking it.
 */
export const attempts = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /** ISO yyyy-mm-dd. A date, not a timestamp — nobody logs the minute they baked. */
    cookedOn: text("cooked_on").notNull(),
    /** 1-5, null = logged without rating. */
    rating: integer("rating"),
    notes: text("notes"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("attempts_recipe_idx").on(t.recipeId, t.cookedOn),
    index("attempts_user_idx").on(t.userId),
  ],
);

export const attemptPhotos = sqliteTable(
  "attempt_photos",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("attempt_photos_attempt_idx").on(t.attemptId, t.sortOrder)],
);

/**
 * Public read-only sharing. Deliberately independent of the auth system: the
 * token is the whole credential, /s/:token never touches a session, and the
 * owner is resolved from this row rather than from a cookie. Tokens are
 * 128-bit random and never derived from recipe ids.
 */
export const shareLinks = sqliteTable(
  "share_links",
  {
    token: text("token").primaryKey(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Share the whole variation family rather than the single node. */
    includeSubtree: integer("include_subtree", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
  },
  (t) => [index("share_links_recipe_idx").on(t.recipeId)],
);

/**
 * BYOK provider credentials. The plaintext key is never returned by any
 * loader — settings renders keyLast4 only. Encrypted with AES-GCM via
 * WebCrypto; the wrapping key comes from the CREDENTIAL_KEY Worker secret.
 * See app/lib/crypto.ts.
 */
export const aiCredentials = sqliteTable(
  "ai_credentials",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Adapter id, e.g. "mistral". */
    provider: text("provider").notNull(),

    keyCiphertext: text("key_ciphertext", { mode: "json" })
      .$type<number[]>()
      .notNull(),
    keyIv: text("key_iv", { mode: "json" }).$type<number[]>().notNull(),
    /** Display only, e.g. "…1234". Never enough to reconstruct the key. */
    keyLast4: text("key_last4").notNull(),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    /** Last time the key was confirmed live against the provider. */
    validatedAt: integer("validated_at", { mode: "timestamp" }),
  },
  (t) => [uniqueIndex("ai_credentials_user_provider_idx").on(t.userId, t.provider)],
);

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  owner: one(user, { fields: [recipes.ownerId], references: [user.id] }),
  parent: one(recipes, {
    fields: [recipes.parentId],
    references: [recipes.id],
    relationName: "fork",
  }),
  children: many(recipes, { relationName: "fork" }),
  ingredients: many(ingredients),
  steps: many(steps),
  attempts: many(attempts),
  recipeTags: many(recipeTags),
}));

export const ingredientsRelations = relations(ingredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [ingredients.recipeId],
    references: [recipes.id],
  }),
}));

export const stepsRelations = relations(steps, ({ one }) => ({
  recipe: one(recipes, { fields: [steps.recipeId], references: [recipes.id] }),
}));

export const attemptsRelations = relations(attempts, ({ one, many }) => ({
  recipe: one(recipes, {
    fields: [attempts.recipeId],
    references: [recipes.id],
  }),
  user: one(user, { fields: [attempts.userId], references: [user.id] }),
  photos: many(attemptPhotos),
}));

export const attemptPhotosRelations = relations(attemptPhotos, ({ one }) => ({
  attempt: one(attempts, {
    fields: [attemptPhotos.attemptId],
    references: [attempts.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  recipeTags: many(recipeTags),
}));

export const recipeTagsRelations = relations(recipeTags, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeTags.recipeId],
    references: [recipes.id],
  }),
  tag: one(tags, { fields: [recipeTags.tagId], references: [tags.id] }),
}));

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;
export type Step = typeof steps.$inferSelect;
export type NewStep = typeof steps.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type ShareLink = typeof shareLinks.$inferSelect;
export type AiCredential = typeof aiCredentials.$inferSelect;
