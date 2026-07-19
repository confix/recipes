import type { Ingredient } from "~/db/schema/app";

/**
 * Baker's percentages: every ingredient expressed as a percentage of total
 * flour weight, which is how bread formulas are actually compared. "75%
 * hydration" is a far more useful handle on a variation than "375g water",
 * because it holds across batch sizes.
 *
 * Derived from ingredient.role rather than stored, so the user never
 * hand-maintains it.
 */

/** Units we can treat as grams for weight math. Volume units can't participate. */
const GRAMS_PER_UNIT: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
};

function toGrams(ingredient: Pick<Ingredient, "quantity" | "unit">): number | null {
  if (ingredient.quantity == null) return null;
  const unit = (ingredient.unit ?? "").trim().toLowerCase();
  const factor = GRAMS_PER_UNIT[unit];
  return factor === undefined ? null : ingredient.quantity * factor;
}

export interface BakersMath {
  /** Total flour weight in grams — the 100% baseline. */
  flourGrams: number;
  /** Percentage per ingredient id. Only weight-based ingredients appear. */
  percentages: Map<string, number>;
  /** Total liquid as a percentage of flour. The headline number for bread. */
  hydration: number | null;
  /**
   * True when the math is meaningful: there is flour with a weight unit.
   * A cookie recipe measured in cups yields false, and the UI should hide
   * percentages entirely rather than show zeroes.
   */
  applicable: boolean;
}

export function bakersPercentages(
  ingredients: Array<Pick<Ingredient, "id" | "quantity" | "unit" | "role">>,
): BakersMath {
  let flourGrams = 0;
  for (const ingredient of ingredients) {
    if (ingredient.role !== "flour") continue;
    flourGrams += toGrams(ingredient) ?? 0;
  }

  if (flourGrams <= 0) {
    return {
      flourGrams: 0,
      percentages: new Map(),
      hydration: null,
      applicable: false,
    };
  }

  const percentages = new Map<string, number>();
  let liquidGrams = 0;

  for (const ingredient of ingredients) {
    const grams = toGrams(ingredient);
    if (grams == null) continue;
    percentages.set(ingredient.id, (grams / flourGrams) * 100);
    if (ingredient.role === "liquid") liquidGrams += grams;
  }

  return {
    flourGrams,
    percentages,
    hydration: (liquidGrams / flourGrams) * 100,
    applicable: true,
  };
}

/** One decimal place: "75%", "62.5%". More precision is noise. */
export function formatPercent(value: number): string {
  return `${Number(value.toFixed(1))}%`;
}
