import * as v from "valibot";
import { parse as parseYaml, YAMLParseError } from "yaml";

/**
 * The recipe file format: YAML frontmatter + free-form markdown body. The
 * markdown file in R2 is the source of truth; everything in this module is a
 * pure function over its text so the indexer, the API and the MCP tools all
 * read a recipe the same way. See docs/design.md.
 */

export const RECIPE_KINDS = ["bake", "cook"] as const;
export type RecipeKind = (typeof RECIPE_KINDS)[number];

/**
 * An ingredient's role in a bake formula. Baker's percentages and hydration
 * are derived from it — see app/lib/bakers-math.ts.
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

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 80;

export const SlugSchema = v.pipe(
  v.string(),
  v.maxLength(MAX_SLUG_LENGTH),
  v.regex(SLUG_RE, "must be lowercase letters, digits and single dashes"),
);

const Minutes = v.pipe(v.number(), v.integer(), v.minValue(0));

const FormulaEntrySchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  grams: v.pipe(v.number(), v.minValue(0)),
  role: v.optional(v.picklist(INGREDIENT_ROLES), "other"),
  note: v.optional(v.string()),
});
export type FormulaEntry = v.InferOutput<typeof FormulaEntrySchema>;

/**
 * Loose on purpose: unknown keys are kept, so a recipe can carry extra
 * frontmatter (cuisine, equipment, …) without the format having to anticipate
 * it. Only the keys below are validated and indexed.
 */
export const FrontmatterSchema = v.looseObject({
  title: v.pipe(v.string(), v.trim(), v.nonEmpty("title is required")),
  kind: v.picklist(RECIPE_KINDS, "kind must be 'bake' or 'cook'"),
  tags: v.optional(
    v.pipe(
      v.array(v.pipe(v.string(), v.trim(), v.toLowerCase(), v.nonEmpty())),
      v.transform((tags) => [...new Set(tags)]),
    ),
    [],
  ),
  // "4", 4 and "2 loaves" are all reasonable; normalize to text.
  servings: v.optional(
    v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((s) => String(s)),
    ),
  ),
  time: v.optional(
    v.object({ active: v.optional(Minutes), total: v.optional(Minutes) }),
  ),
  source: v.optional(v.string()),
  variant_of: v.optional(SlugSchema),
  formula: v.optional(v.array(FormulaEntrySchema)),
});
export type Frontmatter = v.InferOutput<typeof FrontmatterSchema>;

export interface LogEntry {
  /** ISO yyyy-mm-dd. */
  date: string;
  /** 1–5, absent when logged without a rating. */
  rating?: number;
  notes?: string;
}

export interface ParsedRecipe {
  frontmatter: Frontmatter;
  body: string;
  log: LogEntry[];
}

export type ParseResult =
  | { ok: true; recipe: ParsedRecipe }
  | { ok: false; issues: string[] };

const FRONTMATTER_RE = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function parseRecipe(markdown: string): ParseResult {
  const match = FRONTMATTER_RE.exec(markdown);
  if (!match) {
    return {
      ok: false,
      issues: ["missing YAML frontmatter (the file must start with a --- block)"],
    };
  }

  let data: unknown;
  try {
    data = parseYaml(match[1]);
  } catch (error) {
    const message =
      error instanceof YAMLParseError ? error.message : String(error);
    return { ok: false, issues: [`frontmatter is not valid YAML: ${message}`] };
  }

  const result = v.safeParse(FrontmatterSchema, data ?? {});
  if (!result.success) {
    return {
      ok: false,
      issues: result.issues.map((issue) => {
        const path = v.getDotPath(issue);
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    };
  }

  const body = markdown.slice(match[0].length);
  return {
    ok: true,
    recipe: { frontmatter: result.output, body, log: parseLog(body) },
  };
}

// --- Log -------------------------------------------------------------------

/** Matches the `## Log` heading (case-insensitive). */
const LOG_HEADING_RE = /^##[ \t]+log[ \t]*$/im;
/** `- 2026-10-12 ★4 — notes`; rating and notes are optional. */
const LOG_LINE_RE =
  /^[-*][ \t]+(\d{4}-\d{2}-\d{2})(?:[ \t]+★([1-5]))?(?:[ \t]+[—–-][ \t]+(.*))?[ \t]*$/;

/** Returns [start, end) of the log section's content, or null. */
function logSection(body: string): [number, number] | null {
  const heading = LOG_HEADING_RE.exec(body);
  if (!heading) return null;
  const start = heading.index + heading[0].length;
  // The section runs until the next heading of level 1 or 2.
  const next = /^#{1,2}[ \t]/m.exec(body.slice(start));
  return [start, next ? start + next.index : body.length];
}

export function parseLog(body: string): LogEntry[] {
  const section = logSection(body);
  if (!section) return [];
  const entries: LogEntry[] = [];
  for (const line of body.slice(...section).split(/\r?\n/)) {
    const m = LOG_LINE_RE.exec(line.trim());
    if (!m) continue;
    const entry: LogEntry = { date: m[1] };
    if (m[2]) entry.rating = Number(m[2]);
    if (m[3]?.trim()) entry.notes = m[3].trim();
    entries.push(entry);
  }
  return entries;
}

/** The body with the `## Log` section (heading included) removed. */
export function withoutLog(body: string): string {
  const heading = LOG_HEADING_RE.exec(body);
  const section = logSection(body);
  if (!heading || !section) return body;
  return body.slice(0, heading.index) + body.slice(section[1]);
}

export function formatLogLine(entry: LogEntry): string {
  let line = `- ${entry.date}`;
  if (entry.rating) line += ` ★${entry.rating}`;
  // Collapse newlines: one entry is one list item.
  const notes = entry.notes?.replace(/\s*\r?\n\s*/g, " ").trim();
  if (notes) line += ` — ${notes}`;
  return line;
}

/**
 * Appends an entry to the `## Log` section, creating the section at the end
 * of the file if absent. Everything else in the file is left byte-identical.
 */
export function appendLogEntry(markdown: string, entry: LogEntry): string {
  const line = formatLogLine(entry);
  const match = FRONTMATTER_RE.exec(markdown);
  const offset = match ? match[0].length : 0;
  const body = markdown.slice(offset);
  const section = logSection(body);

  if (!section) {
    const trimmed = markdown.replace(/\s*$/, "");
    return `${trimmed}\n\n## Log\n\n${line}\n`;
  }

  const [start, end] = section;
  const content = body.slice(start, end).replace(/\s*$/, "");
  const rest = body.slice(end);
  const separator = content.trim() ? "\n" : "\n\n";
  const updated = `${content}${separator}${line}\n${rest ? `\n${rest}` : ""}`;
  return markdown.slice(0, offset) + body.slice(0, start) + updated;
}

// --- Derived text ------------------------------------------------------------

/** First prose paragraph, for search results. Headings and lists are skipped. */
export function summarize(body: string, maxLength = 280): string | null {
  for (const block of body.split(/\r?\n\s*\r?\n/)) {
    const text = block.trim();
    if (!text || /^(#|[-*+]\s|\d+[.)]\s|>|```|\|)/.test(text)) continue;
    const flat = text.replace(/\s+/g, " ");
    return flat.length > maxLength
      ? `${flat.slice(0, maxLength - 1).trimEnd()}…`
      : flat;
  }
  return null;
}

const INGREDIENTS_HEADING_RE = /^(#{1,6})[ \t]+(ingredients|zutaten)\b.*$/gim;

/**
 * Ingredient names for search: the formula for bakes, plus list items under
 * any "Ingredients" heading in the body (cook recipes usually only have the
 * latter).
 */
export function ingredientText(recipe: ParsedRecipe): string {
  const parts = (recipe.frontmatter.formula ?? []).map((f) => f.name);
  for (const heading of recipe.body.matchAll(INGREDIENTS_HEADING_RE)) {
    const start = heading.index + heading[0].length;
    // Subheadings ("### Dough") stay inside the section; it ends at the next
    // heading of the same or a higher level.
    const level = heading[1].length;
    const next = new RegExp(`^#{1,${level}}[ \\t]`, "m").exec(
      recipe.body.slice(start),
    );
    const section = recipe.body.slice(
      start,
      next ? start + next.index : undefined,
    );
    for (const line of section.split(/\r?\n/)) {
      const item = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
      if (item) parts.push(item[1].trim());
    }
  }
  return parts.join("\n");
}

// --- Slugs -------------------------------------------------------------------

export function slugify(title: string): string {
  const slug = title
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
  return slug || "recipe";
}

export function isValidSlug(slug: string): boolean {
  return v.is(SlugSchema, slug);
}
