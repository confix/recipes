import { Form, Link, useNavigation } from "react-router";

import { createToken, listTokens, revokeToken } from "~/api/tokens.server";
import { Landing } from "~/components/landing";
import { McpSetup } from "~/components/mcp-setup";
import { Alert, Button, KindLabel, LegalLinks, Logo, Ornament, SearchIcon, inputClass } from "~/components/ui";
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
 * (/r/:slug) and issues API tokens. It is laid out as a cookbook's index.
 */
export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.user) return <Landing mcpUrl={loaderData.mcpUrl} />;
  const { user, mcpUrl, query, recipes, tokens } = loaderData;
  // A GET navigation from this page is a search in flight.
  const searching = useNavigation().formMethod === "GET";
  const firstName = user.name?.split(" ")[0];

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-5 pb-24 sm:px-8">
      <header className="flex items-baseline justify-between gap-4 border-b border-rule py-4">
        <Link to="/" aria-label="Recipes index">
          <Logo />
        </Link>
        <div className="flex items-baseline gap-4">
          <span className="hidden text-muted italic sm:inline">{user.email}</span>
          <Form method="post" action="/logout">
            <Button variant="ghost" className="px-0 py-0">
              Sign out
            </Button>
          </Form>
        </div>
      </header>

      <section className="pt-14 pb-10 text-center sm:pt-20">
        <p className="text-muted smallcaps">
          {firstName ? `The collection of ${firstName}` : "A private collection"}
        </p>
        <h1 className="mt-3 display text-7xl leading-[0.9] sm:text-8xl">
          The <em className="text-red">Index</em>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-xl text-muted italic">
          {recipes.length > 0 && !query
            ? `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}, set down and cooked from.`
            : "Search by name, ingredient, or a vague craving."}
        </p>

        <Form method="get" role="search" className="mx-auto mt-10 flex max-w-lg items-end gap-4">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute bottom-3 left-0 size-4 text-muted" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="lentils, or a craving"
              aria-label="Search recipes"
              className={`${inputClass} pl-7`}
            />
          </div>
          <Button type="submit">Look up</Button>
        </Form>
      </section>

      <section aria-busy={searching} className={searching ? "opacity-50 transition-opacity" : "transition-opacity"}>
        <div className="flex items-baseline justify-between rule-double pt-2 text-sm text-muted smallcaps">
          <span>{query ? <>Entries for “{query}”</> : "Contents"}</span>
          <span>{query ? <Link to="/" className="hover:text-red">Clear search</Link> : "Time"}</span>
        </div>

        {recipes.length === 0 ? (
          <div className="py-16 text-center">
            <p className="display text-3xl italic">{query ? "Nothing under that heading." : "The pages are still blank."}</p>
            <p className="mt-3 text-lg text-muted">
              {query
                ? "Try fewer words, or describe the dish instead."
                : "Add recipes through an MCP client or the API (see below)."}
            </p>
          </div>
        ) : (
          <ol>
            {recipes.map((r, i) => (
              <li key={r.slug}>
                <IndexEntry recipe={r} number={i + 1} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <Ornament className="mt-20 mb-10" />

      <section className="flex flex-col gap-10">
        <Appendix
          letter="A"
          title="Connecting an assistant"
          description="Add Recipes to Claude or any MCP client, then search and save recipes from a chat."
        >
          <McpSetup mcpUrl={mcpUrl} />
        </Appendix>

        <Appendix
          letter="B"
          title="API tokens"
          description={
            <>
              For scripts: send <code className="font-mono text-sm not-italic">Authorization: Bearer …</code> to{" "}
              <code className="font-mono text-sm not-italic">/api</code>.
            </>
          }
          open={actionData != null}
        >
          <TokensSection tokens={tokens} actionData={actionData} />
        </Appendix>
      </section>

      <footer className="mt-16 rule-double pt-6">
        <LegalLinks />
      </footer>
    </div>
  );
}

/** One line of the index: number, title … time, then the description. */
function IndexEntry({ recipe: r, number }: { recipe: SearchHit; number: number }) {
  return (
    <Link to={`/r/${r.slug}`} className="group grid grid-cols-[2.75rem_1fr] gap-x-2 border-b border-ink/15 py-5 sm:grid-cols-[3.5rem_1fr]">
      <span className="pt-1.5 text-sm text-red figures smallcaps">No. {String(number).padStart(2, "0")}</span>
      <span className="min-w-0">
        {/* items-end: on a wrapped title the leader follows the last line. */}
        <span className="flex items-end">
          <span className="display text-[1.7rem] leading-tight group-hover:text-red sm:text-3xl">{r.title}</span>
          <span className="leader" aria-hidden="true" />
          <span className="shrink-0 text-lg figures">
            {r.totalMinutes != null ? formatMinutes(r.totalMinutes) : "—"}
          </span>
        </span>
        {r.summary ? <span className="mt-1 block text-lg text-muted italic">{r.summary}</span> : null}
        <span className="mt-2 flex flex-wrap gap-x-3 text-sm text-muted smallcaps">
          <KindLabel kind={r.kind} />
          {r.tags.slice(0, 4).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
          <span className="ml-auto">
            {r.lastCooked ? `made ${r.cookCount}× · last ${r.lastCooked}` : "not yet made"}
            {r.avgRating != null ? (
              <span className="ml-2 text-red" aria-label={`rated ${r.avgRating.toFixed(1)} of 5`}>
                {"★".repeat(Math.round(r.avgRating))}
              </span>
            ) : null}
          </span>
        </span>
      </span>
    </Link>
  );
}

/** A collapsible back-of-the-book section. */
function Appendix({
  letter,
  title,
  description,
  open,
  children,
}: {
  letter: string;
  title: string;
  description: React.ReactNode;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="group border-t border-rule">
      <summary className="flex cursor-pointer list-none items-baseline gap-4 py-4 [&::-webkit-details-marker]:hidden">
        <span className="text-sm text-red smallcaps">Appendix {letter}</span>
        <span className="flex-1">
          <span className="block display text-2xl group-hover:text-red">{title}</span>
          <span className="block text-lg text-muted italic">{description}</span>
        </span>
        <span className="text-xl text-muted transition group-open:rotate-45" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="pt-2 pb-6">{children}</div>
    </details>
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
    <div className="flex flex-col gap-6">
      {actionData && "token" in actionData ? (
        <Alert tone="warning">
          Copy this now — it will not be shown again:
          <code className="mt-2 block border border-rule bg-paper-2 p-3 font-mono text-sm break-all">
            {actionData.token}
          </code>
        </Alert>
      ) : null}

      <Form method="post" className="flex items-end gap-4">
        <input
          name="name"
          placeholder="name it, e.g. laptop"
          aria-label="Token name"
          required
          maxLength={100}
          className={inputClass}
        />
        <Button type="submit" className="shrink-0">
          Issue token
        </Button>
      </Form>
      {actionData && "error" in actionData ? <Alert>{actionData.error}</Alert> : null}

      {tokens.length > 0 ? (
        <ul>
          {tokens.map((t) => (
            <li key={t.id} className="flex items-baseline gap-2 border-b border-ink/15 py-3">
              <span className="text-lg">{t.name}</span>
              <code className="font-mono text-xs text-muted">{t.prefix}…</code>
              <span className="leader" aria-hidden="true" />
              <span className="text-sm text-muted italic">
                {t.lastUsedAt ? `used ${new Date(t.lastUsedAt).toLocaleDateString()}` : "never used"}
              </span>
              <Form method="post">
                <input type="hidden" name="intent" value="revoke" />
                <input type="hidden" name="id" value={t.id} />
                <Button variant="danger" className="px-0 py-0 pl-3">
                  Revoke
                </Button>
              </Form>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
