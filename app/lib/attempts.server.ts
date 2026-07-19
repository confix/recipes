import { and, eq } from "drizzle-orm";

import { getDb } from "~/db";
import { attempts, recipes } from "~/db/schema/app";

export interface AttemptInput {
  cookedOn: string;
  rating: number | null;
  notes: string | null;
}

/**
 * Log one bake against a recipe node.
 *
 * Verifies the recipe belongs to the caller before inserting — without this,
 * a forged recipeId would attach an attempt to someone else's recipe. Returns
 * false when the recipe isn't the caller's (or doesn't exist); the two are
 * deliberately indistinguishable.
 */
export async function logAttempt(
  userId: string,
  recipeId: string,
  input: AttemptInput,
): Promise<boolean> {
  const db = getDb();

  const owned = await db.query.recipes.findFirst({
    where: and(eq(recipes.id, recipeId), eq(recipes.ownerId, userId)),
    columns: { id: true },
  });
  if (!owned) return false;

  const rating =
    input.rating != null && input.rating >= 1 && input.rating <= 5
      ? input.rating
      : null;

  await db.insert(attempts).values({
    id: crypto.randomUUID(),
    recipeId,
    userId,
    cookedOn: input.cookedOn,
    rating,
    notes: input.notes,
  });

  return true;
}
