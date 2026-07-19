import { Form, Link } from "react-router";

import { requireUser } from "~/lib/auth.server";
import { listRecipes } from "~/lib/recipes.server";

import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Recipes" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const all = await listRecipes(user.id);

  // Roots are the "things"; variations hang off them and are surfaced on the
  // detail page rather than cluttering the collection.
  const roots = all.filter((r) => r.parentId === null);
  const variationCount = new Map<string, number>();
  for (const r of all) {
    if (r.parentId === null) continue;
    variationCount.set(r.rootId, (variationCount.get(r.rootId) ?? 0) + 1);
  }

  return {
    user: { name: user.name, email: user.email },
    recipes: roots.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      variations: variationCount.get(r.rootId) ?? 0,
      attempts: r.attempts.length,
      lastCooked: r.attempts[0]?.cookedOn ?? null,
    })),
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user, recipes } = loaderData;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Recipes</h1>
          <p className="text-sm text-neutral-500">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/recipes/new"
            className="rounded bg-neutral-900 px-3 py-2 text-sm text-white"
          >
            New recipe
          </Link>
          <Form method="post" action="/logout">
            <button className="text-sm text-neutral-500 underline">
              Sign out
            </button>
          </Form>
        </div>
      </header>

      {recipes.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          Nothing here yet. Add your first recipe.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {recipes.map((r) => (
            <li key={r.id}>
              <Link
                to={`/recipes/${r.id}`}
                className="block rounded border border-neutral-200 p-4 hover:border-neutral-400"
              >
                <div className="font-medium">{r.title}</div>
                {r.description ? (
                  <p className="line-clamp-1 text-sm text-neutral-500">
                    {r.description}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-neutral-400">
                  {r.variations > 0
                    ? `${r.variations} variation${r.variations === 1 ? "" : "s"}`
                    : "no variations"}
                  {" · "}
                  {r.attempts > 0
                    ? `made ${r.attempts}× · last ${r.lastCooked}`
                    : "not made yet"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
