import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { RECIPE_KINDS } from "../../recipes/format";

import { user } from "./auth";

/**
 * Search index over the markdown recipes in R2. Every row is derived from a
 * file at u/<user_id>/recipes/<slug>.md and can be rebuilt from it (see
 * reindexAll in app/recipes/service.server.ts) — never treat these tables as
 * the source of truth.
 *
 * The integer id exists for the FTS5 table: recipe_fts (created by hand in the
 * migration, drizzle cannot model virtual tables) uses it as its rowid, and an
 * INTEGER PRIMARY KEY is the only rowid SQLite guarantees stable.
 */
export const recipeIndex = sqliteTable(
  "recipe_index",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),

    title: text("title").notNull(),
    kind: text("kind", { enum: RECIPE_KINDS }).notNull(),
    summary: text("summary"),
    servings: text("servings"),
    activeMinutes: integer("active_minutes"),
    totalMinutes: integer("total_minutes"),
    source: text("source"),
    variantOf: text("variant_of"),

    /** Derived from the file's `## Log` section. */
    cookCount: integer("cook_count").notNull().default(0),
    lastCooked: text("last_cooked"),
    avgRating: real("avg_rating"),

    /** R2 etag of the file this row was built from. */
    etag: text("etag").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("recipe_index_user_slug_idx").on(t.userId, t.slug),
    index("recipe_index_user_kind_idx").on(t.userId, t.kind),
    index("recipe_index_user_updated_idx").on(t.userId, t.updatedAt),
  ],
);

export const recipeIndexTags = sqliteTable(
  "recipe_index_tags",
  {
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipeIndex.id, { onDelete: "cascade" }),
    /** Denormalized so tag listing and filtering stay inside one index. */
    userId: text("user_id").notNull(),
    tag: text("tag").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.tag] }),
    index("recipe_index_tags_user_tag_idx").on(t.userId, t.tag),
  ],
);

/**
 * Personal access tokens for the REST API. Only a SHA-256 of the token is
 * stored; the plaintext is shown once at creation.
 */
export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    /** First characters of the token, for telling tokens apart in a list. */
    prefix: text("prefix").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("api_tokens_user_idx").on(t.userId)],
);

export type RecipeIndexRow = typeof recipeIndex.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
