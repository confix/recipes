import { data } from "react-router";

import { RecipePage, RecipeView, ShareBox } from "~/components/recipe-view";
import { Alert } from "~/components/ui";
import { requireUser } from "~/lib/auth.server";
import { getTranslator, useT } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n.server";
import { seo } from "~/lib/seo";
import { parseRecipe } from "~/recipes/format";
import { parseScale } from "~/recipes/scale";
import {
  RecipeError,
  getRecipeSource,
  getShareToken,
  shareRecipe,
  unshareRecipe,
} from "~/recipes/service.server";
import { logView, recipeView } from "~/recipes/view.server";

import type { Route } from "./+types/recipe";

/**
 * The owner's recipe page for the kitchen: the recipe (scalable), its
 * cooking log, and the share controls. Editing happens through the API /
 * MCP, not here.
 */

export function meta({ loaderData, matches }: Route.MetaArgs) {
  return seo({ matches, title: loaderData?.title, noindex: true });
}

async function loadSource(request: Request, userId: string, slug: string) {
  try {
    return await getRecipeSource(userId, slug);
  } catch (error) {
    if (error instanceof RecipeError && error.code === "not_found") {
      throw data(getTranslator(getLocale(request)).t("recipe.notFound"), { status: 404 });
    }
    throw error;
  }
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const source = await loadSource(request, user.id, params.slug);

  const parsed = parseRecipe(source.markdown);
  if (!parsed.ok) {
    // Still readable: show the raw file and what is wrong with it.
    return {
      title: params.slug,
      invalid: { issues: parsed.issues, markdown: source.markdown },
    } as const;
  }

  const url = new URL(request.url);
  const token = await getShareToken(user.id, params.slug);
  return {
    invalid: null,
    ...recipeView(parsed.recipe, parseScale(url.searchParams.get("scale"))),
    ...logView(parsed.recipe.body),
    shareUrl: token ? `${url.origin}/s/${token}` : null,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const intent = (await request.formData()).get("intent");
  try {
    if (intent === "share") await shareRecipe(user.id, params.slug);
    else if (intent === "unshare") await unshareRecipe(user.id, params.slug);
  } catch (error) {
    if (error instanceof RecipeError && error.code === "not_found") {
      throw data(getTranslator(getLocale(request)).t("recipe.notFound"), { status: 404 });
    }
    throw error;
  }
  return null;
}

export default function Recipe({ loaderData: recipe }: Route.ComponentProps) {
  const { t } = useT();

  if (recipe.invalid) {
    return (
      <RecipePage>
        <h1 className="mt-12 text-center display text-5xl">{recipe.title}</h1>
        <div className="mt-8">
          <Alert>
            {t("recipe.problems")}
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
      </RecipePage>
    );
  }

  return (
    <RecipePage>
      <RecipeView recipe={recipe}>
        {recipe.log.length > 0 || recipe.logNotesHtml ? (
          <section className="mt-16 rule-double pt-6">
            <h2 className="text-center display text-3xl italic">{t("recipe.notes")}</h2>
            <ol className="mt-6">
              {recipe.log.map((entry, i) => (
                <li key={i} className="grid grid-cols-[6.5rem_1fr] gap-x-4 border-b border-ink/15 py-3 text-lg sm:grid-cols-[8rem_1fr]">
                  <span className="text-muted figures smallcaps">{entry.date}</span>
                  <span>
                    {entry.rating ? (
                      <span className="mr-3 text-red" role="img" aria-label={t("recipe.stars", { rating: entry.rating })}>
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

        <ShareBox shareUrl={recipe.shareUrl} title={recipe.title} />
      </RecipeView>
    </RecipePage>
  );
}
