import { Link, data } from "react-router";

import { KeepAwake } from "~/components/keep-awake";
import { Alert, KindBadge } from "~/components/ui";
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

/**
 * The description paragraph(s) before the first heading, so the page can
 * show them under the title and above the formula.
 */
function splitIntro(markdown: string) {
  const heading = /^#{1,6}\s/m.exec(markdown);
  if (!heading) return { intro: "", rest: markdown };
  return { intro: markdown.slice(0, heading.index).trim(), rest: markdown.slice(heading.index) };
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
  const { intro, rest } = splitIntro(withoutLog(parsed.recipe.body));
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
    introHtml: intro ? renderMarkdown(intro) : null,
    html: renderMarkdown(rest),
    ...logView(parsed.recipe.body),
  };
}

export default function Recipe({ loaderData: recipe }: Route.ComponentProps) {
  if (recipe.invalid) {
    return (
      <Page>
        <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight">{recipe.title}</h1>
        <div className="mt-6">
          <Alert>
            <p className="mb-1 font-medium">This recipe file has problems:</p>
            <ul className="list-disc pl-5">
              {recipe.invalid.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </Alert>
        </div>
        <pre className="mt-6 overflow-x-auto rounded-2xl bg-white p-4 text-sm whitespace-pre-wrap ring-1 ring-stone-900/5 dark:bg-stone-900 dark:ring-white/10">
          {recipe.invalid.markdown}
        </pre>
      </Page>
    );
  }

  const facts = [
    recipe.servings ? { label: "Serves", value: recipe.servings } : null,
    recipe.activeMinutes != null ? { label: "Active", value: formatMinutes(recipe.activeMinutes) } : null,
    recipe.totalMinutes != null ? { label: "Total", value: formatMinutes(recipe.totalMinutes) } : null,
    recipe.bakers ? { label: "Hydration", value: formatPercent(recipe.bakers.hydration) } : null,
  ].filter((fact) => fact != null);

  return (
    <Page>
      <header className="mt-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind={recipe.kind} />
          {recipe.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-stone-200/70 px-2.5 py-0.5 text-xs font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300"
            >
              {tag}
            </span>
          ))}
        </div>
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
          {recipe.title}
        </h1>
        {recipe.introHtml ? (
          <div
            className="recipe-body text-xl text-stone-700 dark:text-stone-300"
            // Rendered by renderMarkdown, which escapes raw HTML and unsafe links.
            dangerouslySetInnerHTML={{ __html: recipe.introHtml }}
          />
        ) : null}
        {recipe.variantOf || recipe.source ? (
          <div className="flex flex-col gap-1 text-sm text-stone-600 dark:text-stone-400">
            {recipe.variantOf ? (
              <p>
                Variation of{" "}
                <Link to={`/r/${recipe.variantOf}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                  {recipe.variantOf}
                </Link>
              </p>
            ) : null}
            {recipe.source ? (
              <p className="break-words">
                Source:{" "}
                {recipe.sourceUrl ? (
                  <a
                    href={recipe.sourceUrl}
                    rel="noreferrer noopener"
                    className="font-medium text-brand-700 hover:underline dark:text-brand-300"
                  >
                    {recipe.source}
                  </a>
                ) : (
                  recipe.source
                )}
              </p>
            ) : null}
          </div>
        ) : null}

        {facts.length > 0 ? (
          <dl className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-stone-900/5 ring-1 ring-stone-900/5 sm:grid-cols-4 dark:bg-white/10 dark:ring-white/10">
            {facts.map((fact) => (
              <div key={fact.label} className="bg-white px-4 py-3 dark:bg-stone-900">
                <dt className="text-xs font-semibold tracking-wider text-stone-500 uppercase">{fact.label}</dt>
                <dd className="mt-0.5 font-display text-xl font-semibold">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </header>

      {recipe.formula ? (
        <section className="mt-10 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-900/5 sm:p-6 dark:bg-stone-900 dark:ring-white/10">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Formula</h2>
          <table className="mt-3 w-full text-left">
            <thead className="text-xs font-semibold tracking-wider text-stone-500 uppercase">
              <tr>
                <th className="py-2">Ingredient</th>
                <th className="py-2 text-right">Grams</th>
                {recipe.bakers ? <th className="py-2 text-right">Baker's %</th> : null}
              </tr>
            </thead>
            <tbody>
              {recipe.formula.map((entry, i) => (
                <tr key={i} className="border-t border-stone-900/5 dark:border-white/10">
                  <td className="py-2.5">
                    {entry.name}
                    {entry.note ? (
                      <span className="text-sm text-stone-500">, {entry.note}</span>
                    ) : null}
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums">{entry.grams}</td>
                  {recipe.bakers ? (
                    <td className="py-2.5 text-right text-brand-700 tabular-nums dark:text-brand-300">
                      {formatPercent(recipe.bakers.entries[i].percent)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <article
        className="recipe-body mt-6"
        // Rendered by renderMarkdown, which escapes raw HTML and unsafe links.
        dangerouslySetInnerHTML={{ __html: recipe.html }}
      />

      {recipe.log.length > 0 || recipe.logNotesHtml ? (
        <section className="mt-12 border-t border-stone-900/10 pt-8 dark:border-white/10">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Cooking log</h2>
          <ol className="mt-4 flex flex-col gap-3 text-base">
            {recipe.log.map((entry, i) => (
              <li key={i} className="relative border-l-2 border-brand-200 pl-4 dark:border-brand-900">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-medium tabular-nums">{entry.date}</span>
                  {entry.rating ? (
                    <span className="text-amber-500" role="img" aria-label={`${entry.rating} of 5`}>
                      {"★".repeat(entry.rating)}
                      <span className="text-stone-300 dark:text-stone-700">{"★".repeat(5 - entry.rating)}</span>
                    </span>
                  ) : null}
                </div>
                {entry.notes ? (
                  <p className="mt-0.5 text-stone-600 dark:text-stone-400">{entry.notes}</p>
                ) : null}
              </li>
            ))}
          </ol>
          {recipe.logNotesHtml ? (
            <div
              className="recipe-body text-base"
              // Rendered by renderMarkdown, which escapes raw HTML and unsafe links.
              dangerouslySetInnerHTML={{ __html: recipe.logNotesHtml }}
            />
          ) : null}
        </section>
      ) : null}
    </Page>
  );
}

/** Kitchen reading: one column, large type, a way back and the screen lock. */
function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-10 border-b border-stone-900/5 bg-paper/80 backdrop-blur dark:border-white/5 dark:bg-paper-dark/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          >
            <span aria-hidden="true">←</span> All recipes
          </Link>
          <KeepAwake />
        </div>
      </nav>
      <main className="mx-auto max-w-3xl px-4 pb-24 text-lg sm:px-6">{children}</main>
    </div>
  );
}
