import { Form, Link, useNavigation } from "react-router";

import { createToken, listTokens, revokeToken } from "~/api/tokens.server";
import { Landing } from "~/components/landing";
import { McpSetup } from "~/components/mcp-setup";
import { Alert, Button, ClockIcon, KindBadge, Logo, SearchIcon, inputClass } from "~/components/ui";
import { getSessionUser, requireUser } from "~/lib/auth.server";
import { formatMinutes } from "~/lib/minutes";
import { type SearchHit, searchRecipes } from "~/recipes/service.server";

import type { Route } from "./+types/home";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData?.user ? "Recipes" : "Recipes · Your recipe box, fluent in AI" },
    {
      name: "description",
      content: "A private recipe collection your AI assistant can search, save to and log cooks in, over MCP.",
    },
  ];
}

/** Signed out, / is the public front page; signed in, it is your collection. */
export async function loader({ request }: Route.LoaderArgs) {
  const mcpUrl = `${new URL(request.url).origin}/mcp`;
  const user = await getSessionUser(request);
  if (!user) return { user: null, mcpUrl };

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 500) ?? "";
  const [recipes, tokens] = await Promise.all([
    searchRecipes(user.id, { query: query || undefined, limit: 50 }),
    listTokens(user.id),
  ]);
  return { user: { name: user.name, email: user.email }, mcpUrl, query, recipes, tokens };
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
  if (!loaderData.user) return <Landing mcpUrl={loaderData.mcpUrl} />;
  const { user, mcpUrl, query, recipes, tokens } = loaderData;
  // A GET navigation from this page is a search in flight.
  const searching = useNavigation().formMethod === "GET";
  const firstName = user.name?.split(" ")[0];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-stone-900/5 bg-paper/80 backdrop-blur dark:border-white/5 dark:bg-paper-dark/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" aria-label="Recipes home">
            <Logo />
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            <span className="hidden text-sm text-stone-500 sm:inline">{user.email}</span>
            <Form method="post" action="/logout">
              <Button variant="ghost" className="px-3 py-1.5">Sign out</Button>
            </Form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <section className="pt-10 pb-8 sm:pt-16 sm:pb-12">
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            What are we making
            {firstName ? (
              <>
                , <span className="text-brand-600 dark:text-brand-400">{firstName}</span>
              </>
            ) : null}
            ?
          </h1>
          <p className="mt-3 text-lg text-stone-600 dark:text-stone-400">
            Search by name, ingredient, or mood.
          </p>

          <Form method="get" role="search" className="mt-6 flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Lentils, or something cosy"
                aria-label="Search recipes"
                className={`${inputClass} py-3.5 pl-12 text-base`}
              />
            </div>
            <Button type="submit" className="px-6">
              Search
            </Button>
          </Form>
        </section>

        <section aria-busy={searching} className={searching ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-wider text-stone-500 uppercase">
              {query ? `Results for “${query}”` : "Your collection"}
            </h2>
            {recipes.length > 0 ? (
              <span className="text-sm text-stone-500">
                {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
              </span>
            ) : null}
          </div>

          {recipes.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-stone-300 px-6 py-16 text-center dark:border-stone-700">
              <p className="font-display text-2xl font-semibold">
                {query ? "Nothing found" : "No recipes yet"}
              </p>
              <p className="mt-2 text-stone-600 dark:text-stone-400">
                {query
                  ? "Try fewer words, or describe the dish instead."
                  : "Add some through an MCP client or the API."}
              </p>
              {query ? (
                <Link to="/" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
                  Show all recipes
                </Link>
              ) : null}
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recipes.map((r) => (
                <li key={r.slug}>
                  <RecipeCard recipe={r} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <details className="group mt-16 rounded-2xl bg-white shadow-sm ring-1 ring-stone-900/5 dark:bg-stone-900 dark:ring-white/10">
          <PanelSummary
            title="Connect an AI assistant"
            description="Add Recipes to Claude or any MCP client to search and save recipes from a chat."
          />
          <div className="border-t border-stone-900/5 p-5 dark:border-white/10">
            <McpSetup mcpUrl={mcpUrl} />
          </div>
        </details>

        <TokensSection tokens={tokens} actionData={actionData} />
      </main>
    </div>
  );
}

function RecipeCard({ recipe: r }: { recipe: SearchHit }) {
  return (
    <Link
      to={`/r/${r.slug}`}
      className="group flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-900/5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-stone-900/5 hover:ring-brand-300 dark:bg-stone-900 dark:ring-white/10 dark:hover:ring-brand-700"
    >
      <div className="flex items-center justify-between gap-2">
        <KindBadge kind={r.kind} />
        {r.totalMinutes != null ? (
          <span className="flex items-center gap-1 text-xs font-medium text-stone-500">
            <ClockIcon className="size-3.5" />
            {formatMinutes(r.totalMinutes)}
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 font-display text-xl leading-snug font-semibold tracking-tight group-hover:text-brand-700 dark:group-hover:text-brand-300">
        {r.title}
      </h3>
      {r.summary ? (
        <p className="mt-2 line-clamp-3 text-sm text-stone-600 dark:text-stone-400">{r.summary}</p>
      ) : null}
      <div className="mt-auto pt-4">
        {r.tags.length > 0 ? (
          <ul className="mb-3 flex flex-wrap gap-1.5">
            {r.tags.slice(0, 4).map((tag) => (
              <li key={tag} className="rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-stone-500">
          {r.lastCooked
            ? `Made ${r.cookCount} ${r.cookCount === 1 ? "time" : "times"} · last ${r.lastCooked}`
            : "Not made yet"}
          {r.avgRating != null ? (
            <span className="ml-1.5 text-amber-500" aria-label={`rated ${r.avgRating.toFixed(1)} of 5`}>
              ★ {r.avgRating.toFixed(1)}
            </span>
          ) : null}
        </p>
      </div>
    </Link>
  );
}

function TokensSection({
  tokens,
  actionData,
}: {
  tokens: Awaited<ReturnType<typeof listTokens>>;
  actionData: Route.ComponentProps["actionData"];
}) {
  return (
    <details
      open={actionData != null}
      className="group mt-4 rounded-2xl bg-white shadow-sm ring-1 ring-stone-900/5 dark:bg-stone-900 dark:ring-white/10"
    >
      <PanelSummary
        title="API tokens"
        description={
          <>
            For scripts and apps: <code className="text-xs">Authorization: Bearer …</code> against{" "}
            <code className="text-xs">/api</code>
          </>
        }
      />

      <div className="flex flex-col gap-4 border-t border-stone-900/5 p-5 dark:border-white/10">
        {actionData && "token" in actionData ? (
          <Alert tone="warning">
            <p className="mb-2 font-medium">Copy this now — it will not be shown again:</p>
            <code className="block rounded-lg bg-white/70 p-2 font-mono text-xs break-all dark:bg-black/30">
              {actionData.token}
            </code>
          </Alert>
        ) : null}

        <Form method="post" className="flex gap-2">
          <input
            name="name"
            placeholder="Token name, e.g. laptop"
            aria-label="Token name"
            required
            maxLength={100}
            className={`${inputClass} text-sm`}
          />
          <Button type="submit" className="shrink-0">
            Create token
          </Button>
        </Form>
        {actionData && "error" in actionData ? <Alert>{actionData.error}</Alert> : null}

        {tokens.length > 0 ? (
          <ul className="divide-y divide-stone-900/5 text-sm dark:divide-white/10">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="font-medium">{t.name}</span>{" "}
                  <code className="text-xs text-stone-500">{t.prefix}…</code>
                  <span className="block text-xs text-stone-500">
                    {t.lastUsedAt
                      ? `Last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                      : "Never used"}
                  </span>
                </span>
                <Form method="post">
                  <input type="hidden" name="intent" value="revoke" />
                  <input type="hidden" name="id" value={t.id} />
                  <Button variant="danger" className="px-3 py-1.5">
                    Revoke
                  </Button>
                </Form>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}

/** Header row of a collapsible panel on this page. */
function PanelSummary({ title, description }: { title: string; description: React.ReactNode }) {
  return (
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-stone-500">{description}</span>
      </span>
      <span className="text-stone-400 transition group-open:rotate-180" aria-hidden="true">
        ▾
      </span>
    </summary>
  );
}
