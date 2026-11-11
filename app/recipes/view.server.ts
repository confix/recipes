import { bakersPercentages } from "~/lib/bakers-math";
import { renderMarkdown } from "~/lib/markdown";

import { type Frontmatter, parseLogSection, withoutLog } from "./format";
import { scaleFormula, scaleIngredientSections, scaleServings } from "./scale";

/**
 * What a recipe page shows, from a parsed file: shared by the owner's page
 * (/r/:slug) and the public share page (/s/:token), so both read a recipe the
 * same way. Optionally scaled; see app/recipes/scale.ts for what that
 * touches.
 */

/**
 * The description paragraph(s) before the first heading, so the page can
 * show them under the title and above the formula.
 */
function splitIntro(markdown: string) {
  const heading = /^#{1,6}\s/m.exec(markdown);
  if (!heading) return { intro: "", rest: markdown };
  return { intro: markdown.slice(0, heading.index).trim(), rest: markdown.slice(heading.index) };
}

/** Only http(s) sources become links; anything else is shown as text. */
function safeHttpUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function recipeView(
  recipe: { frontmatter: Frontmatter; body: string },
  scale: number | null,
) {
  const fm = recipe.frontmatter;
  const factor = scale ?? 1;
  const body = withoutLog(recipe.body);
  const { intro, rest } = splitIntro(scale ? scaleIngredientSections(body, factor) : body);
  return {
    title: fm.title,
    kind: fm.kind,
    tags: fm.tags,
    scale,
    servings: fm.servings ? (scale ? scaleServings(fm.servings, factor) : fm.servings) : null,
    activeMinutes: fm.time?.active ?? null,
    totalMinutes: fm.time?.total ?? null,
    source: fm.source ?? null,
    sourceUrl: safeHttpUrl(fm.source),
    variantOf: fm.variant_of ?? null,
    // Percentages don't change with batch size: take them from the original.
    bakers: fm.formula ? bakersPercentages(fm.formula) : null,
    formula: fm.formula ? (scale ? scaleFormula(fm.formula, factor) : fm.formula) : null,
    introHtml: intro ? renderMarkdown(intro) : null,
    html: renderMarkdown(rest),
  };
}

export type RecipeViewData = ReturnType<typeof recipeView>;

/**
 * The cooking log, newest first (reversed before the stable sort, so
 * same-day entries are newest first too), plus any log lines that are not
 * entries, as markdown. Owner only — never on a shared page.
 */
export function logView(body: string) {
  const { entries, unrecognized } = parseLogSection(body);
  return {
    log: [...entries].reverse().sort((a, b) => b.date.localeCompare(a.date)),
    logNotesHtml: unrecognized.length ? renderMarkdown(unrecognized.join("\n")) : null,
  };
}
