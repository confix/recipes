import type { IngredientRole, NewIngredient, NewStep } from "~/db/schema/app";

/**
 * Deterministic parsing of hand-typed ingredient lines. No AI — this runs on
 * manual entry, where the user is right there and can fix anything we get
 * wrong. The AI adapters produce the same shape for imported recipes.
 */

/** Vulgar fractions people actually paste from recipe sites. */
const VULGAR: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const UNITS = new Set([
  "g", "gram", "grams", "kg", "kilogram", "kilograms",
  "ml", "l", "liter", "liters", "litre", "litres",
  "tsp", "teaspoon", "teaspoons", "tbsp", "tablespoon", "tablespoons",
  "cup", "cups", "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds",
  "pinch", "dash", "clove", "cloves", "slice", "slices",
]);

/**
 * Role inference by keyword. Deliberately conservative: `other` is a fine
 * default, and a wrong `flour` guess would corrupt every baker's percentage in
 * the recipe. The user can correct roles in the UI.
 */
const ROLE_PATTERNS: Array<[RegExp, IngredientRole]> = [
  [/\b(starter|levain|poolish|biga|yeast|sourdough)\b/i, "leaven"],
  [/\bflour\b|\b(semolina|rye|spelt)\b/i, "flour"],
  [/\b(water|milk|buttermilk|beer|juice|stock|broth)\b/i, "liquid"],
  [/\bsalt\b/i, "salt"],
  [/\b(butter|oil|lard|shortening|ghee)\b/i, "fat"],
  [/\b(sugar|honey|syrup|molasses)\b/i, "sugar"],
];

/**
 * Guess an ingredient's baking role from its name. Deliberately conservative —
 * `other` is the default and only bread-like recipes benefit from the rest.
 * Exported because the ingredient form no longer asks for a role up front: it
 * is inferred on save so general cooking never sees baking UI, and only
 * surfaced for correction when a recipe turns out to be dough-like.
 */
export function inferRole(name: string): IngredientRole {
  for (const [pattern, role] of ROLE_PATTERNS) {
    if (pattern.test(name)) return role;
  }
  return "other";
}

/**
 * Parse a whole quantity field, which may be several tokens: "1 1/2" → 1.5,
 * "1/2" → 0.5, "½" → 0.5, "1.5" → 1.5, "" → null. Used by the structured
 * manual editor so the qty box tolerates the ways people actually write
 * amounts. Any unparseable token yields null (the row keeps its name).
 */
export function parseQuantityField(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  let total = 0;
  for (const token of s.split(/\s+/)) {
    const value = parseQuantity(token);
    if (value === null) return null;
    total += value;
  }
  return total;
}

/** "1 ½" → 1.5, "1/2" → 0.5, "½" → 0.5, "500" → 500 */
function parseQuantity(token: string): number | null {
  if (VULGAR[token] !== undefined) return VULGAR[token];

  const slash = token.match(/^(\d+)\/(\d+)$/);
  if (slash) return Number(slash[1]) / Number(slash[2]);

  const n = Number(token);
  return Number.isFinite(n) ? n : null;
}

export type ParsedIngredient = Omit<NewIngredient, "id" | "recipeId" | "sortOrder">;

/**
 * Parse "500 g bread flour" → {quantity: 500, unit: "g", name: "bread flour"}.
 * Anything unparseable falls through to the whole line as `name`, which is
 * always better than dropping the user's input.
 */
export function parseIngredientLine(line: string): ParsedIngredient {
  const tokens = line.trim().split(/\s+/);
  let index = 0;
  let quantity: number | null = null;

  // Leading quantity, possibly "1 ½" (integer followed by a vulgar fraction).
  const first = parseQuantity(tokens[index] ?? "");
  if (first !== null) {
    quantity = first;
    index++;
    const second = tokens[index] ? VULGAR[tokens[index]] : undefined;
    if (second !== undefined) {
      quantity += second;
      index++;
    }
  }

  let unit: string | null = null;
  const maybeUnit = (tokens[index] ?? "").toLowerCase().replace(/\.$/, "");
  if (quantity !== null && UNITS.has(maybeUnit)) {
    unit = maybeUnit;
    index++;
  }

  const rest = tokens.slice(index).join(" ").trim();
  const name = rest || line.trim();

  return { quantity, unit, name, note: null, groupName: null, role: inferRole(name) };
}

export function parseStepLines(text: string): Array<Omit<NewStep, "id" | "recipeId">> {
  return text
    .split("\n")
    .map((l) => l.trim())
    // Strip a leading "1." / "2)" if the user numbered them — sortOrder handles it.
    .map((l) => l.replace(/^\d+[.)]\s*/, ""))
    .filter(Boolean)
    .map((text, index) => ({
      text,
      sortOrder: index,
      temperatureC: null,
      minutes: null,
    }));
}
