import type { FormulaEntry } from "~/recipes/format";

/**
 * Baker's percentages: every ingredient expressed as a percentage of total
 * flour weight, which is how bread formulas are actually compared. "75%
 * hydration" is a far more useful handle on a variation than "375g water",
 * because it holds across batch sizes.
 *
 * Derived from the `formula` frontmatter block (grams + role) rather than
 * stored, so nobody hand-maintains it.
 */

export interface BakersEntry extends FormulaEntry {
  /** Percentage of total flour weight. */
  percent: number;
}

export interface BakersMath {
  /** Total flour weight in grams — the 100% baseline. */
  flourGrams: number;
  entries: BakersEntry[];
  /** Total liquid as a percentage of flour. The headline number for bread. */
  hydration: number;
}

/** Null when there is no flour to take percentages of. */
export function bakersPercentages(formula: FormulaEntry[]): BakersMath | null {
  let flourGrams = 0;
  let liquidGrams = 0;
  for (const entry of formula) {
    if (entry.role === "flour") flourGrams += entry.grams;
    if (entry.role === "liquid") liquidGrams += entry.grams;
  }
  if (flourGrams <= 0) return null;

  return {
    flourGrams,
    entries: formula.map((entry) => ({
      ...entry,
      percent: (entry.grams / flourGrams) * 100,
    })),
    hydration: (liquidGrams / flourGrams) * 100,
  };
}

/** One decimal place: "75%", "62.5%". More precision is noise. */
export function formatPercent(value: number): string {
  return `${Number(value.toFixed(1))}%`;
}
