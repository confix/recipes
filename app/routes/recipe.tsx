import { Link, data } from "react-router";

import { KeepAwake } from "~/components/keep-awake";
import { bakersPercentages, formatPercent } from "~/lib/bakers-math";
import { requireUser } from "~/lib/auth.server";
import { renderMarkdown } from "~/lib/markdown";
import { formatMinutes } from "~/lib/minutes";
import { parseLogSection, parseRecipe, withoutLog } from "~/recipes/format";
import { RecipeError, getRecipeSource } from "~/recipes/service.server";

import type { Route } from "./+types/recipe";

/**
 * Read-only recipe page for the kitchen: big type, the formula with baker's
 * percentages for bakes, the method, and the cooking log. Editing happens
 * through the API / MCP, not here.
 */

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData?.title ? `${loaderData.title} · Recipes` : "Recipes" }];
}

/**
 * Newest first (reversed before the stable sort, so same-day entries are
 * newest first too), plus any log lines that are not entries, as markdown.
 */
function logView(body: string) {
  const { entries, unrecognized } = parseLogSection(body);
  return {
    log: [...entries].reverse().sort((a, b) => b.date.localeCompare(a.date)),
    logNotesHtml: unrecognized.length ? renderMarkdown(unrecognized.join("\n")) : null,
  };
}

/** Only http(s) sources become links; anything else is shown as text. */
function safeHttpUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);

  let source;
  try {
    source = await getRecipeSource(user.id, params.slug);
  } catch (error) {
    if (error instanceof RecipeError && error.code === "not_found") {
      throw data("No such recipe.", { status: 404 });
    }
    throw error;
  }

  const parsed = parseRecipe(source.markdown);
  if (!parsed.ok) {
    // Still readable: show the raw file and what is wrong with it.
    return {
      title: params.slug,
      invalid: { issues: parsed.issues, markdown: source.markdown },
    } as const;
  }

  const fm = parsed.recipe.frontmatter;
  return {
    title: fm.title,
    invalid: null,
    kind: fm.kind,
    tags: fm.tags,
    servings: fm.servings ?? null,
    activeMinutes: fm.time?.active ?? null,
    totalMinutes: fm.time?.total ?? null,
    source: fm.source ?? null,
    sourceUrl: safeHttpUrl(fm.source),
    variantOf: fm.variant_of ?? null,
    bakers: fm.formula ? bakersPercentages(fm.formula) : null,
    formula: fm.formula ?? null,
    html: renderMarkdown(withoutLog(parsed.recipe.body)),
    ...logView(parsed.recipe.body),
  };
}

export default function Recipe({ loaderData: recipe }: Route.ComponentProps) {
  if (recipe.invalid) {
    return (
      <main className="mx-auto max-w-2xl p-4 sm:p-6">
        <Link to="/" className="text-sm text-neutral-500 underline">
          ← Recipes
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">{recipe.title}</h1>
        <div role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm dark:bg-red-950">
          <p className="mb-1">This recipe file has problems:</p>
          <ul className="list-disc pl-5">
            {recipe.invalid.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap text-sm">
          {recipe.invalid.markdown}
        </pre>
      </main>
    );
  }

  const facts = [
    recipe.kind === "bake" ? "Bake" : "Cook",
    recipe.servings ? `Serves ${recipe.servings}` : null,
    recipe.activeMinutes != null ? `${formatMinutes(recipe.activeMinutes)} active` : null,
    recipe.totalMinutes != null ? `${formatMinutes(recipe.totalMinutes)} total` : null,
  ].filter(Boolean);

  return (
    <main className="mx-auto max-w-2xl p-4 text-lg sm:p-6">
      <nav className="flex items-center justify-between">
        <Link to="/" className="text-sm text-neutral-500 underline">
          ← Recipes
        </Link>
        <KeepAwake />
      </nav>

      <header className="mt-4 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{recipe.title}</h1>
        <p className="text-base text-neutral-500">{facts.join(" · ")}</p>
        {recipe.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-sm">
            {recipe.tags.map((tag) => (
              <li key={tag} className="rounded bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
        {recipe.variantOf ? (
          <p className="text-sm">
            Variation of{" "}
            <Link to={`/r/${recipe.variantOf}`} className="underline">
              {recipe.variantOf}
            </Link>
          </p>
        ) : null}
        {recipe.source ? (
          <p className="break-words text-sm text-neutral-500">
            Source:{" "}
            {recipe.sourceUrl ? (
              <a href={recipe.sourceUrl} rel="noreferrer noopener" className="underline">
                {recipe.source}
              </a>
            ) : (
              recipe.source
            )}
          </p>
        ) : null}
      </header>

      {recipe.formula ? (
        <section className="mt-6">
          <h2 className="mb-2 text-xl font-semibold">Formula</h2>
          <table className="w-full text-left">
            <thead className="text-sm text-neutral-500">
              <tr>
                <th className="py-1 font-normal">Ingredient</th>
                <th className="py-1 text-right font-normal">g</th>
                {recipe.bakers ? <th className="py-1 text-right font-normal">%</th> : null}
              </tr>
            </thead>
            <tbody>
              {recipe.formula.map((entry, i) => (
                <tr key={i} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="py-1">
                    {entry.name}
                    {entry.note ? (
                      <span className="text-sm text-neutral-500">, {entry.note}</span>
                    ) : null}
                  </td>
                  <td className="py-1 text-right tabular-nums">{entry.grams}</td>
                  {recipe.bakers ? (
                    <td className="py-1 text-right tabular-nums">
                      {formatPercent(recipe.bakers.entries[i].percent)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {recipe.bakers ? (
            <p className="mt-2 text-base">
              Hydration <strong>{formatPercent(recipe.bakers.hydration)}</strong>
            </p>
          ) : null}
        </section>
      ) : null}

      <article
        className="recipe-body mt-6"
        // Rendered by renderMarkdown, which escapes raw HTML and unsafe links.
        dangerouslySetInnerHTML={{ __html: recipe.html }}
      />

      {recipe.log.length > 0 || recipe.logNotesHtml ? (
        <section className="mt-8">
          <h2 className="mb-2 text-xl font-semibold">Cooked</h2>
          <ul className="flex flex-col gap-1 text-base">
            {recipe.log.map((entry, i) => (
              <li key={i}>
                <span className="tabular-nums">{entry.date}</span>
                {entry.rating ? (
                  <span className="ml-2" role="img" aria-label={`${entry.rating} of 5`}>
                    {"★".repeat(entry.rating)}
                  </span>
                ) : null}
                {entry.notes ? <span className="ml-2 text-neutral-500">{entry.notes}</span> : null}
              </li>
            ))}
          </ul>
          {recipe.logNotesHtml ? (
            <div
              className="recipe-body text-base"
              // Rendered by renderMarkdown, which escapes raw HTML and unsafe links.
              dangerouslySetInnerHTML={{ __html: recipe.logNotesHtml }}
            />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
