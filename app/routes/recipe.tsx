import { Link, data } from "react-router";

import { KeepAwake } from "~/components/keep-awake";
import { Alert, KindLabel, Logo, Ornament } from "~/components/ui";
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
        <h1 className="mt-12 text-center display text-5xl">{recipe.title}</h1>
        <div className="mt-8">
          <Alert>
            This recipe file has problems:
            <ul className="mt-2 list-disc pl-5">
              {recipe.invalid.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </Alert>
        </div>
        <pre className="mt-8 overflow-x-auto border border-rule bg-paper-2 p-4 font-mono text-sm whitespace-pre-wrap">
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
      <header className="pt-12 text-center sm:pt-16">
        <p className="flex flex-wrap justify-center gap-x-3 text-muted smallcaps">
          <KindLabel kind={recipe.kind} />
          {recipe.tags.map((tag) => (
            <span key={tag}>· {tag}</span>
          ))}
        </p>
        <h1 className="mt-4 display text-5xl leading-[0.95] text-balance sm:text-7xl">{recipe.title}</h1>
        {recipe.variantOf ? (
          <p className="mt-4 text-lg text-muted italic">
            a variation on{" "}
            <Link to={`/r/${recipe.variantOf}`} className="text-red not-italic smallcaps hover:underline">
              {recipe.variantOf}
            </Link>
          </p>
        ) : null}
        <Ornament className="mx-auto mt-8 max-w-[10rem]" />
      </header>

      {recipe.introHtml ? (
        <div
          className="recipe-body drop-cap mt-8 text-[1.35rem]! italic"
          // Rendered by renderMarkdown, which escapes raw HTML and unsafe links.
          dangerouslySetInnerHTML={{ __html: recipe.introHtml }}
        />
      ) : null}

      {facts.length > 0 ? (
        <dl className="mt-10 grid grid-cols-2 border-y border-rule text-center sm:grid-cols-4">
          {facts.map((fact, i) => (
            <div
              key={fact.label}
              className={`px-2 py-3 ${i % 2 ? "border-l" : ""} ${i > 0 ? "sm:border-l" : ""} ${i > 1 ? "border-t sm:border-t-0" : ""} border-rule`}
            >
              <dt className="text-sm text-muted smallcaps">{fact.label}</dt>
              <dd className="mt-0.5 display text-2xl figures">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {recipe.formula ? (
        <section className="mt-12">
          <h2 className="border-b border-rule pb-1 text-[1.15rem] font-semibold text-red smallcaps">The formula</h2>
          <table className="mt-2 w-full text-left text-[1.2rem] figures">
            <thead className="text-sm text-muted smallcaps">
              <tr>
                <th className="py-2 font-normal">Ingredient</th>
                <th className="py-2 text-right font-normal">Grams</th>
                {recipe.bakers ? <th className="py-2 pl-4 text-right font-normal">Baker’s %</th> : null}
              </tr>
            </thead>
            <tbody>
              {recipe.formula.map((entry, i) => (
                <tr key={i} className="border-t border-dotted border-ink/30">
                  <td className="py-2">
                    {entry.name}
                    {entry.note ? <span className="text-muted italic"> — {entry.note}</span> : null}
                  </td>
                  <td className="py-2 text-right">{entry.grams}</td>
                  {recipe.bakers ? (
                    <td className="py-2 pl-4 text-right text-red italic">
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
        className="recipe-body mt-4"
        // Rendered by renderMarkdown, which escapes raw HTML and unsafe links.
        dangerouslySetInnerHTML={{ __html: recipe.html }}
      />

      {recipe.source ? (
        <p className="mt-10 text-lg break-words text-muted italic">
          <span className="not-italic smallcaps">Source: </span>
          {recipe.sourceUrl ? (
            <a href={recipe.sourceUrl} rel="noreferrer noopener" className="text-red underline underline-offset-[3px]">
              {recipe.source}
            </a>
          ) : (
            recipe.source
          )}
        </p>
      ) : null}

      {recipe.log.length > 0 || recipe.logNotesHtml ? (
        <section className="mt-16 rule-double pt-6">
          <h2 className="text-center display text-3xl italic">Kitchen notes</h2>
          <ol className="mt-6">
            {recipe.log.map((entry, i) => (
              <li key={i} className="grid grid-cols-[6.5rem_1fr] gap-x-4 border-b border-ink/15 py-3 text-lg sm:grid-cols-[8rem_1fr]">
                <span className="text-muted figures smallcaps">{entry.date}</span>
                <span>
                  {entry.rating ? (
                    <span className="mr-3 text-red" role="img" aria-label={`${entry.rating} of 5`}>
                      {"★".repeat(entry.rating)}
                      <span className="opacity-25">{"★".repeat(5 - entry.rating)}</span>
                    </span>
                  ) : null}
                  {entry.notes ? <span className="italic">{entry.notes}</span> : null}
                </span>
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
    <div className="mx-auto min-h-screen max-w-2xl px-5 pb-24 sm:px-8">
      <nav className="sticky top-0 z-10 flex items-baseline justify-between gap-4 border-b border-rule bg-paper py-3">
        <Link to="/" className="whitespace-nowrap text-muted smallcaps hover:text-red">
          ← <span className="hidden sm:inline">The </span>index
        </Link>
        <Logo className="hidden sm:inline-flex" />
        <KeepAwake />
      </nav>
      <main>{children}</main>
    </div>
  );
}
