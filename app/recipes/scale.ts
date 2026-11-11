import type { FormulaEntry } from "./format";

/**
 * Scaling a recipe: multiply the amounts, leave everything else alone.
 *
 * What gets scaled, because it is structured enough to do safely:
 * - formula grams (bakes),
 * - the leading number of `servings` ("2 loaves" → "4 loaves"),
 * - the leading quantity of each list item under an "Ingredients" /
 *   "Zutaten" heading ("200 g lentils", "1 1/2 cups", "½ tsp", "2–3 cloves").
 *
 * Quantities inside method prose ("bake at 230 °C for 20 min") are never
 * touched: temperatures and times don't scale, and prose can't tell us which
 * number is which. Baker's percentages don't change with batch size either.
 */

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 20;

/** `?scale=` value → factor, or null for "unscaled" (absent, 1, or junk). */
export function parseScale(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const clamped = Math.min(Math.max(n, MIN_SCALE), MAX_SCALE);
  return Math.abs(clamped - 1) < 1e-9 ? null : clamped;
}

const FRACTION_GLYPHS: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅕": 1 / 5,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};
const GLYPHS = Object.keys(FRACTION_GLYPHS).join("");

/** Preferred output glyphs, nearest-match within a small tolerance. */
const NICE_FRACTIONS: [number, string][] = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
];

// One amount: "1 1/2", "1½", "½", "1/2", "1.5", "1,5", "200".
const AMOUNT = `(?:\\d+[ \\t]+\\d+/\\d+|\\d+[${GLYPHS}]|[${GLYPHS}]|\\d+/\\d+|\\d+(?:[.,]\\d+)?)`;
// An amount or a range of two, at the very start of the text.
const LEADING_QUANTITY_RE = new RegExp(`^(${AMOUNT})(?:([ \\t]*[-–][ \\t]*)(${AMOUNT}))?`);

interface Style {
  comma: boolean;
  fraction: boolean;
}

function parseAmount(token: string): number {
  const t = token.trim();
  let m = /^(\d+)[ \t]+(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = new RegExp(`^(\\d+)([${GLYPHS}])$`).exec(t);
  if (m) return Number(m[1]) + FRACTION_GLYPHS[m[2]];
  if (t in FRACTION_GLYPHS) return FRACTION_GLYPHS[t];
  m = /^(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[2]) === 0 ? NaN : Number(m[1]) / Number(m[2]);
  return Number(t.replace(",", "."));
}

function styleOf(token: string): Style {
  return {
    comma: /\d,\d/.test(token),
    fraction: /\//.test(token) || new RegExp(`[${GLYPHS}]`).test(token),
  };
}

/**
 * A scaled amount, written the way a cook would: whole numbers from 20 up
 * (nobody weighs 412.5 g of flour; 10.5 g of yeast matters),
 * a fraction glyph when the original was a fraction, otherwise at most one
 * decimal (with a comma if the original used one).
 */
export function formatAmount(value: number, style: Style = { comma: false, fraction: false }): string {
  if (value >= 20) return String(Math.round(value));

  if (style.fraction) {
    const whole = Math.floor(value);
    const rest = value - whole;
    if (rest < 0.06) return whole ? String(whole) : String(Number(value.toFixed(2)));
    if (rest > 0.94) return String(whole + 1);
    const [, glyph] = NICE_FRACTIONS.reduce((best, f) =>
      Math.abs(f[0] - rest) < Math.abs(best[0] - rest) ? f : best,
    );
    return whole ? `${whole}${glyph}` : glyph;
  }

  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return style.comma ? text.replace(".", ",") : text;
}

/**
 * Scales the quantity at the start of `text`, keeping the rest verbatim.
 * Text without a leading quantity ("salt, to taste") comes back unchanged.
 */
export function scaleLeadingQuantity(text: string, factor: number): string {
  const m = LEADING_QUANTITY_RE.exec(text);
  if (!m) return text;
  const [whole, first, dash, second] = m;
  const a = parseAmount(first);
  if (!Number.isFinite(a)) return text;
  let scaled = formatAmount(a * factor, styleOf(first));
  if (second !== undefined) {
    const b = parseAmount(second);
    if (!Number.isFinite(b)) return text;
    scaled += dash + formatAmount(b * factor, styleOf(second));
  }
  return scaled + text.slice(whole.length);
}

export function scaleServings(servings: string, factor: number): string {
  return scaleLeadingQuantity(servings, factor);
}

/** Grams to show for a scaled formula: one decimal below 20 g, else whole. */
export function scaleFormula(formula: FormulaEntry[], factor: number): FormulaEntry[] {
  return formula.map((entry) => {
    const grams = entry.grams * factor;
    return { ...entry, grams: grams >= 20 ? Math.round(grams) : Math.round(grams * 10) / 10 };
  });
}

const INGREDIENTS_HEADING_RE = /^(#{1,6})[ \t]+(ingredients|zutaten)\b.*$/i;
const HEADING_RE = /^(#{1,6})[ \t]/;
const LIST_ITEM_RE = /^(\s*(?:[-*+]|\d+[.)])\s+)(.*)$/;

/**
 * The markdown body with list items under ingredient headings scaled.
 * A section runs until the next heading of the same or a higher level, so
 * "### Dough" / "### Filling" subsections stay inside it.
 */
export function scaleIngredientSections(body: string, factor: number): string {
  let sectionLevel: number | null = null;
  return body
    .split(/(\r?\n)/)
    .map((line) => {
      if (line === "\n" || line === "\r\n") return line;
      const heading = HEADING_RE.exec(line);
      if (heading) {
        const level = heading[1].length;
        if (INGREDIENTS_HEADING_RE.test(line)) sectionLevel = level;
        else if (sectionLevel !== null && level <= sectionLevel) sectionLevel = null;
        return line;
      }
      if (sectionLevel === null) return line;
      const item = LIST_ITEM_RE.exec(line);
      return item ? item[1] + scaleLeadingQuantity(item[2], factor) : line;
    })
    .join("");
}

/** "2" → "2×", 0.5 → "½×", 1.5 → "1½×". */
export function formatFactor(factor: number): string {
  return `${formatAmount(factor, { comma: false, fraction: true })}×`;
}
