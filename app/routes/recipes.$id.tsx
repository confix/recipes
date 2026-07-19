import { Form, Link, redirect } from "react-router";

import { requireUser } from "~/lib/auth.server";
import { bakersPercentages, formatPercent } from "~/lib/bakers-math";
import { forkRecipe, getFamily, getRecipe, renameRecipe } from "~/lib/recipes.server";
import { logAttempt } from "~/lib/attempts.server";

import type { Route } from "./+types/recipes.$id";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData ? `${loaderData.recipe.title} · Recipes` : "Recipes" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);

  const recipe = await getRecipe(user.id, params.id);
  // Owner-scoped query: another user's id is indistinguishable from a
  // non-existent one. Not "403" — we don't confirm the row exists.
  if (!recipe) throw new Response("Not found", { status: 404 });

  const family = await getFamily(user.id, recipe.rootId);
  const math = bakersPercentages(recipe.ingredients);

  return {
    recipe: {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      parentId: recipe.parentId,
      ingredients: recipe.ingredients.map((i) => ({
        id: i.id,
        quantity: i.quantity,
        unit: i.unit,
        name: i.name,
        role: i.role,
        percent: math.percentages.get(i.id) ?? null,
      })),
      steps: recipe.steps.map((s) => ({ id: s.id, text: s.text })),
      attempts: recipe.attempts.map((a) => ({
        id: a.id,
        cookedOn: a.cookedOn,
        rating: a.rating,
        notes: a.notes,
      })),
    },
    math: { applicable: math.applicable, hydration: math.hydration, flourGrams: math.flourGrams },
    family: family.map((f) => {
      const rated = f.attempts.filter((a) => a.rating != null);
      const avg = rated.length
        ? rated.reduce((sum, a) => sum + (a.rating ?? 0), 0) / rated.length
        : null;
      const fMath = bakersPercentages(f.ingredients);
      return {
        id: f.id,
        title: f.title,
        isCurrent: f.id === recipe.id,
        hydration: fMath.hydration,
        attempts: f.attempts.length,
        avgRating: avg,
      };
    }),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "fork") {
    // Name the variation at creation — this is its identity in the family
    // table. Blank falls back to the "(variation)" default inside forkRecipe.
    const name = String(form.get("title") ?? "").trim();
    const id = await forkRecipe(user.id, params.id, name ? { title: name } : undefined);
    if (!id) throw new Response("Not found", { status: 404 });
    throw redirect(`/recipes/${id}`);
  }

  if (intent === "rename") {
    const ok = await renameRecipe(user.id, params.id, String(form.get("title") ?? ""));
    if (!ok) return { error: "Enter a name." };
    return { ok: true };
  }

  if (intent === "log-attempt") {
    const ok = await logAttempt(user.id, params.id, {
      cookedOn: String(form.get("cookedOn") ?? ""),
      rating: Number(form.get("rating")) || null,
      notes: String(form.get("notes") ?? "").trim() || null,
    });
    if (!ok) throw new Response("Not found", { status: 404 });
    return { ok: true };
  }

  return { ok: false };
}

function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-neutral-300">—</span>;
  const rounded = Math.round(value);
  return (
    <span title={value.toFixed(1)}>
      {"★".repeat(rounded)}
      <span className="text-neutral-300">{"★".repeat(5 - rounded)}</span>
    </span>
  );
}

export default function RecipeDetail({ loaderData }: Route.ComponentProps) {
  const { recipe, math, family } = loaderData;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link to="/" className="text-sm text-neutral-500 underline">
        ← Collection
      </Link>

      <header className="mt-4 mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{recipe.title}</h1>
            <details className="group text-sm">
              <summary className="cursor-pointer list-none text-neutral-400 hover:text-neutral-600">
                rename
              </summary>
              <Form method="post" className="mt-2 flex items-center gap-2">
                <input type="hidden" name="intent" value="rename" />
                <input
                  name="title"
                  defaultValue={recipe.title}
                  required
                  aria-label="Recipe name"
                  className="rounded border border-neutral-300 px-2 py-1 text-sm"
                />
                <button className="rounded bg-neutral-900 px-2 py-1 text-sm text-white">
                  Save
                </button>
              </Form>
            </details>
          </div>
          {recipe.description ? (
            <p className="text-sm text-neutral-500">{recipe.description}</p>
          ) : null}
          {math.applicable ? (
            <p className="mt-1 text-sm text-neutral-600">
              {formatPercent(math.hydration ?? 0)} hydration ·{" "}
              {math.flourGrams}g flour
              {recipe.parentId ? " · variation" : ""}
            </p>
          ) : null}
        </div>

        {/* Fork with a name — the name is how variations are told apart in the
            family table. Blank is allowed; it falls back to "(variation)". */}
        <Form method="post" className="flex shrink-0 flex-col gap-1">
          <input type="hidden" name="intent" value="fork" />
          <input
            name="title"
            placeholder="name this variation"
            aria-label="Variation name"
            className="w-44 rounded border border-neutral-300 px-2 py-1 text-sm"
          />
          <button className="rounded border border-neutral-300 px-3 py-1.5 text-sm">
            Fork variation
          </button>
        </Form>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 font-medium">Ingredients</h2>
        <ul className="text-sm">
          {recipe.ingredients.map((i) => (
            <li
              key={i.id}
              className="flex justify-between border-b border-neutral-100 py-1"
            >
              <span>
                {i.quantity ?? ""} {i.unit ?? ""} {i.name}
                <span className="ml-2 text-xs text-neutral-400">{i.role}</span>
              </span>
              {math.applicable && i.percent != null ? (
                <span className="tabular-nums text-neutral-500">
                  {formatPercent(i.percent)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 font-medium">Steps</h2>
        <ol className="list-inside list-decimal text-sm">
          {recipe.steps.map((s) => (
            <li key={s.id} className="py-1">
              {s.text}
            </li>
          ))}
        </ol>
      </section>

      {family.length > 1 ? (
        <section className="mb-8">
          <h2 className="mb-2 font-medium">Variations</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="py-1">Version</th>
                <th>Hydration</th>
                <th>Bakes</th>
                <th>Avg rating</th>
              </tr>
            </thead>
            <tbody>
              {family.map((f) => (
                <tr key={f.id} className="border-b border-neutral-100">
                  <td className="py-1">
                    {f.isCurrent ? (
                      <span className="font-medium">{f.title}</span>
                    ) : (
                      <Link to={`/recipes/${f.id}`} className="underline">
                        {f.title}
                      </Link>
                    )}
                  </td>
                  <td className="tabular-nums">
                    {f.hydration != null ? formatPercent(f.hydration) : "—"}
                  </td>
                  <td className="tabular-nums">{f.attempts}</td>
                  <td>
                    <Stars value={f.avgRating} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 font-medium">Cooking log</h2>
        {recipe.attempts.length === 0 ? (
          <p className="text-sm text-neutral-400">You haven't made this yet.</p>
        ) : (
          <ul className="mb-4 text-sm">
            {recipe.attempts.map((a) => (
              <li key={a.id} className="border-b border-neutral-100 py-2">
                <div className="flex justify-between">
                  <span className="tabular-nums text-neutral-500">
                    {a.cookedOn}
                  </span>
                  <Stars value={a.rating} />
                </div>
                {a.notes ? <p className="text-neutral-600">{a.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}

        <Form
          method="post"
          className="flex flex-wrap items-end gap-2 rounded border border-neutral-200 p-3"
        >
          <input type="hidden" name="intent" value="log-attempt" />
          <label className="flex flex-col gap-1 text-xs">
            Date
            <input
              type="date"
              name="cookedOn"
              defaultValue={today}
              required
              className="rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Rating
            <select
              name="rating"
              className="rounded border border-neutral-300 px-2 py-1 text-sm"
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs">
            Notes
            <input
              name="notes"
              placeholder="what worked, what to change next time"
              className="rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </label>
          <button className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white">
            Add to log
          </button>
        </Form>
      </section>
    </main>
  );
}
