/**
 * One-off: converts v1 recipes (the D1 tables in app/db/schema/legacy.ts) into
 * v2 markdown files.
 *
 *   node scripts/export-v1.ts [--remote] [--upload]
 *
 * Reads D1 through `wrangler d1 execute` (local unless --remote) and writes
 * export/u/<user_id>/recipes/<slug>.md. With --upload, also puts each file
 * into the R2 bucket at the same key — unless a file already exists there,
 * which is reported and left alone, so re-running is safe but will not
 * refresh earlier exports. Afterwards each user runs
 * POST /api/reindex to build their search index from the uploaded files.
 *
 * Mapping notes: kind is guessed (bake when any ingredient had a non-"other"
 * role, cook otherwise) — check it. Weighed ingredients of bakes become the
 * `formula`; everything else is rendered into the body. Attempts become the
 * `## Log`. Attempt photos and share links are not exported.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { stringify } from "yaml";

import { parseRecipe, slugify } from "../app/recipes/format.ts";

const DATABASE = "recipes-db";
const BUCKET = "recipes-uploads";
const OUT_DIR = "export";

const remote = process.argv.includes("--remote");
const upload = process.argv.includes("--upload");
const target = remote ? "--remote" : "--local";

function query<T>(sql: string): T[] {
  const out = execFileSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", DATABASE, target, "--json", "--command", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  return (JSON.parse(out) as Array<{ results: T[] }>)[0].results;
}

interface RecipeRow {
  id: string;
  owner_id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  source_url: string | null;
  servings: number | null;
  yield_note: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
}
interface IngredientRow {
  recipe_id: string;
  group_name: string | null;
  quantity: number | null;
  unit: string | null;
  name: string;
  note: string | null;
  role: string;
}
interface StepRow {
  recipe_id: string;
  text: string;
  temperature_c: number | null;
  minutes: number | null;
}
interface TagRow {
  recipe_id: string;
  name: string;
}
interface AttemptRow {
  recipe_id: string;
  cooked_on: string;
  rating: number | null;
  notes: string | null;
}

const recipes = query<RecipeRow>(
  "SELECT * FROM recipes ORDER BY owner_id, created_at",
);
const ingredients = query<IngredientRow>(
  "SELECT * FROM ingredients ORDER BY recipe_id, sort_order",
);
const steps = query<StepRow>("SELECT * FROM steps ORDER BY recipe_id, sort_order");
const tags = query<TagRow>(
  "SELECT rt.recipe_id, t.name FROM recipe_tags rt JOIN tags t ON t.id = rt.tag_id",
);
const attempts = query<AttemptRow>(
  "SELECT * FROM attempts ORDER BY recipe_id, cooked_on",
);

function groupBy<T extends { recipe_id: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    map.set(row.recipe_id, [...(map.get(row.recipe_id) ?? []), row]);
  }
  return map;
}
const ingredientsBy = groupBy(ingredients);
const stepsBy = groupBy(steps);
const tagsBy = groupBy(tags);
const attemptsBy = groupBy(attempts);

// Slugs are unique per owner; assign them all first so variant_of can point
// at a parent regardless of row order.
const slugs = new Map<string, string>();
const taken = new Map<string, Set<string>>();
for (const r of recipes) {
  const used = taken.get(r.owner_id) ?? new Set<string>();
  taken.set(r.owner_id, used);
  const base = slugify(r.title);
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base.slice(0, 75)}-${n}`;
  used.add(slug);
  slugs.set(r.id, slug);
}

const GRAMS: Record<string, number> = {
  g: 1, gram: 1, grams: 1, kg: 1000, kilogram: 1000, kilograms: 1000,
};

function ingredientLine(i: IngredientRow) {
  const amount = [i.quantity ?? "", i.unit ?? ""].join(" ").trim();
  return `- ${[amount, i.name].filter(Boolean).join(" ")}${i.note ? `, ${i.note}` : ""}`;
}

function toMarkdown(r: RecipeRow) {
  const ings = ingredientsBy.get(r.id) ?? [];
  const kind = ings.some((i) => i.role !== "other") ? "bake" : "cook";

  const formula: Array<{ name: string; grams: number; role: string; note?: string }> = [];
  const listed: IngredientRow[] = [];
  for (const i of ings) {
    const factor = GRAMS[(i.unit ?? "").trim().toLowerCase()];
    if (kind === "bake" && i.quantity != null && factor !== undefined) {
      formula.push({
        name: i.name,
        grams: i.quantity * factor,
        role: i.role,
        ...(i.note ? { note: i.note } : {}),
      });
    } else {
      listed.push(i);
    }
  }

  const total =
    r.total_minutes ??
    (r.prep_minutes != null || r.cook_minutes != null
      ? (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0)
      : null);
  const time = Object.fromEntries(
    Object.entries({ active: r.prep_minutes, total }).filter(([, v]) => v != null),
  );

  const frontmatter: Record<string, unknown> = { title: r.title, kind };
  const recipeTags = (tagsBy.get(r.id) ?? []).map((t) => t.name);
  if (recipeTags.length) frontmatter.tags = recipeTags;
  const servings = r.servings ?? r.yield_note;
  if (servings != null) frontmatter.servings = servings;
  if (Object.keys(time).length) frontmatter.time = time;
  if (r.source_url) frontmatter.source = r.source_url;
  if (r.parent_id && slugs.has(r.parent_id)) {
    frontmatter.variant_of = slugs.get(r.parent_id);
  }
  if (formula.length) frontmatter.formula = formula;

  const body: string[] = [];
  if (r.description) body.push(r.description.trim());

  if (listed.length) {
    const lines = ["## Ingredients"];
    let group: string | null | undefined;
    for (const i of listed) {
      if (i.group_name !== group) {
        group = i.group_name;
        if (group) lines.push("", `### ${group}`);
        lines.push("");
      }
      lines.push(ingredientLine(i));
    }
    body.push(lines.join("\n"));
  }

  const method = (stepsBy.get(r.id) ?? []).map((s, n) => {
    const extras = [
      s.temperature_c != null ? `${s.temperature_c} °C` : null,
      s.minutes != null ? `${s.minutes} min` : null,
    ].filter(Boolean);
    const text = s.text.replace(/\s*\r?\n\s*/g, " ");
    return `${n + 1}. ${text}${extras.length ? ` (${extras.join(", ")})` : ""}`;
  });
  if (method.length) body.push(["## Method", "", ...method].join("\n"));

  const log = (attemptsBy.get(r.id) ?? []).map((a) => {
    let line = `- ${a.cooked_on}`;
    if (a.rating) line += ` ★${a.rating}`;
    const notes = a.notes?.replace(/\s*\r?\n\s*/g, " ").trim();
    if (notes) line += ` — ${notes}`;
    return line;
  });
  if (log.length) body.push(["## Log", "", ...log].join("\n"));

  return `---\n${stringify(frontmatter)}---\n\n${body.join("\n\n")}\n`;
}

function r2ObjectExists(key: string) {
  try {
    execFileSync(
      "pnpm",
      ["exec", "wrangler", "r2", "object", "get", `${BUCKET}/${key}`, "--pipe", target],
      { stdio: "ignore" },
    );
    return true;
  } catch {
    return false;
  }
}

let written = 0;
let uploaded = 0;
const failed: string[] = [];
const skipped: string[] = [];
for (const r of recipes) {
  const markdown = toMarkdown(r);
  const key = `u/${r.owner_id}/recipes/${slugs.get(r.id)}.md`;

  const parsed = parseRecipe(markdown);
  if (!parsed.ok) {
    failed.push(`${key}: ${parsed.issues.join("; ")}`);
    continue;
  }

  const file = join(OUT_DIR, key);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, markdown);
  written++;

  if (upload) {
    // Never overwrite: the file may be a v2 recipe created through the API
    // before this ran, or an exported recipe that has since been edited.
    if (r2ObjectExists(key)) {
      skipped.push(key);
      continue;
    }
    execFileSync(
      "pnpm",
      [
        "exec", "wrangler", "r2", "object", "put", `${BUCKET}/${key}`,
        "--file", file, "--content-type", "text/markdown; charset=utf-8", target,
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    uploaded++;
  }
}

console.log(`Wrote ${written} recipe(s) to ${OUT_DIR}/.`);
if (upload) console.log(`Uploaded ${uploaded} (${target}).`);
if (skipped.length) {
  console.warn(
    `Not uploaded, a file already exists at that key (left untouched):\n${skipped.join("\n")}`,
  );
}
if (failed.length) {
  console.error(`Skipped ${failed.length} that did not validate:\n${failed.join("\n")}`);
  process.exitCode = 1;
}
if (uploaded) {
  console.log("Each user now runs POST /api/reindex to index their recipes.");
}
