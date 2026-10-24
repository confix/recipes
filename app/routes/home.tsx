import { Form, Link } from "react-router";

import { createToken, listTokens, revokeToken } from "~/api/tokens.server";
import { requireUser } from "~/lib/auth.server";
import { formatMinutes } from "~/lib/minutes";
import { searchRecipes } from "~/recipes/service.server";

import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Recipes" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 500) ?? "";
  const [recipes, tokens] = await Promise.all([
    searchRecipes(user.id, { query: query || undefined, limit: 50 }),
    listTokens(user.id),
  ]);
  return { user: { name: user.name, email: user.email }, query, recipes, tokens };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();

  if (form.get("intent") === "revoke") {
    await revokeToken(user.id, String(form.get("id") ?? ""));
    return null;
  }

  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  if (!name) return { error: "Give the token a name." };
  const { token } = await createToken(user.id, name);
  return { token };
}

/**
 * The web UI is intentionally tiny: recipes are managed through the MCP
 * server and the API. This page finds recipes to read in the kitchen
 * (/r/:slug) and issues API tokens.
 */
export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const { user, query, recipes, tokens } = loaderData;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Recipes</h1>
          <p className="text-sm text-neutral-500">{user.email}</p>
        </div>
        <Form method="post" action="/logout">
          <button className="text-sm text-neutral-500 underline">Sign out</button>
        </Form>
      </header>

      <section className="mb-10 flex flex-col gap-4">
        <Form method="get" role="search" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search, e.g. lentils or something warming"
            aria-label="Search recipes"
            className="flex-1 rounded border border-neutral-300 px-3 py-2"
          />
          <button className="rounded bg-neutral-900 px-3 py-2 text-white">Search</button>
        </Form>

        {recipes.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {query
              ? "Nothing found."
              : "No recipes yet. Add some through an MCP client or the API."}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {recipes.map((r) => (
              <li key={r.slug}>
                <Link to={`/r/${r.slug}`} className="block py-3">
                  <span className="font-medium">{r.title}</span>{" "}
                  <span className="ml-1 text-sm text-neutral-500">
                    {[
                      r.kind === "bake" ? "bake" : "cook",
                      r.totalMinutes != null ? formatMinutes(r.totalMinutes) : null,
                      r.lastCooked ? `last made ${r.lastCooked}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {r.summary ? (
                    <span className="mt-1 block text-sm text-neutral-500">{r.summary}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">API tokens</h2>
        <p className="text-sm text-neutral-500">
          Use as <code>Authorization: Bearer …</code> against <code>/api</code>.
        </p>

        {actionData && "token" in actionData ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="mb-1">Copy this now — it will not be shown again:</p>
            <code className="break-all">{actionData.token}</code>
          </div>
        ) : null}

        <Form method="post" className="flex gap-2">
          <input
            name="name"
            placeholder="Token name, e.g. laptop"
            required
            maxLength={100}
            className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <button className="rounded bg-neutral-900 px-3 py-2 text-sm text-white">
            Create token
          </button>
        </Form>
        {actionData && "error" in actionData ? (
          <p role="alert" className="text-sm text-red-600">
            {actionData.error}
          </p>
        ) : null}

        <ul className="divide-y divide-neutral-200 text-sm">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2">
              <span>
                {t.name} <code className="text-neutral-500">{t.prefix}…</code>
                <span className="ml-2 text-neutral-400">
                  {t.lastUsedAt
                    ? `last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                    : "never used"}
                </span>
              </span>
              <Form method="post">
                <input type="hidden" name="intent" value="revoke" />
                <input type="hidden" name="id" value={t.id} />
                <button className="text-red-600 underline">Revoke</button>
              </Form>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
