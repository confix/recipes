import { Form, Link, data, redirect, useNavigation } from "react-router";

import { RecipePage, RecipeView } from "~/components/recipe-view";
import { Button } from "~/components/ui";
import { getSessionUser, requireUser } from "~/lib/auth.server";
import { getTranslator, useT } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n.server";
import { seo } from "~/lib/seo";
import { parseScale } from "~/recipes/scale";
import { RecipeError, getSharedRecipe, importSharedRecipe } from "~/recipes/service.server";
import { recipeView } from "~/recipes/view.server";
import { withNext } from "~/lib/safe-next";

import type { Route } from "./+types/shared";

/**
 * A recipe someone shared: readable by anyone with the link, no session
 * needed — the token resolves owner and slug (app/recipes/shares.server.ts).
 * Signed-in visitors can import their own copy; everyone else is offered a
 * sign-in that comes back here. The owner's cooking log is never shown.
 */

function minutes(n: number | null) {
  return n != null ? `PT${n}M` : undefined;
}

export function meta({ loaderData, matches }: Route.MetaArgs) {
  if (!loaderData) return seo({ matches, noindex: true });
  const { recipe, token, summary } = loaderData;
  return seo({
    matches,
    title: recipe.title,
    description: summary ?? undefined,
    path: `/s/${token}`,
    type: "article",
    // An unlisted link, not consent to be in search results: full link
    // previews for whoever it was sent to, but no indexing.
    noindex: true,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: recipe.title,
      description: summary ?? undefined,
      keywords: recipe.tags.join(", ") || undefined,
      recipeYield: recipe.servings ?? undefined,
      prepTime: minutes(recipe.activeMinutes),
      totalTime: minutes(recipe.totalMinutes),
      recipeIngredient: recipe.formula?.map((f) => `${f.grams} g ${f.name}`),
    },
  });
}

/** First paragraph of the intro, as plain text, for previews. */
function plainSummary(html: string | null): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 200 ? `${text.slice(0, 199).trimEnd()}…` : text || null;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const shared = await getSharedRecipe(params.token);
  if (!shared) throw data(getTranslator(getLocale(request)).t("shared.gone"), { status: 404 });

  // Optional: the page is public; a session only decides what to offer.
  const user = await getSessionUser(request);
  const recipe = recipeView(shared, parseScale(new URL(request.url).searchParams.get("scale")));
  return {
    token: params.token,
    signedIn: Boolean(user),
    ownSlug: user?.id === shared.ownerId ? shared.slug : null,
    summary: plainSummary(recipe.introHtml),
    recipe,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  // Signed out: off to /login?next=/s/<token>, and back here afterwards.
  const user = await requireUser(request);
  const shareUrl = `${new URL(request.url).origin}/s/${params.token}`;
  try {
    const { slug } = await importSharedRecipe(user.id, params.token, shareUrl);
    throw redirect(`/r/${slug}`);
  } catch (error) {
    if (error instanceof RecipeError && error.code === "not_found") {
      throw data(getTranslator(getLocale(request)).t("shared.gone"), { status: 404 });
    }
    throw error;
  }
}

export default function Shared({ loaderData }: Route.ComponentProps) {
  const { recipe, token, signedIn, ownSlug } = loaderData;
  const { t } = useT();
  const busy = useNavigation().state === "submitting";

  return (
    <RecipePage>
      <p className="pt-10 text-center text-sm text-muted smallcaps">{t("shared.eyebrow")}</p>
      <div className="-mt-8">
        <RecipeView
          recipe={recipe}
          linkVariant={false}
          aside={
            <aside className="mt-10 flex flex-col items-center gap-3 border-y border-rule py-5 text-center sm:flex-row sm:justify-between sm:text-left">
              {ownSlug ? (
                <>
                  <p className="text-lg italic">{t("shared.yours")}</p>
                  <Link to={`/r/${ownSlug}`} className="border border-ink px-5 py-2.5 smallcaps hover:bg-ink hover:text-paper">
                    {t("shared.open")}
                  </Link>
                </>
              ) : signedIn ? (
                <Form method="post" className="contents">
                  <p className="text-lg text-muted italic">{t("shared.importHint")}</p>
                  <Button type="submit" disabled={busy} className="shrink-0">
                    {t("shared.import")}
                  </Button>
                </Form>
              ) : (
                <>
                  <p className="text-lg text-muted italic">{t("shared.signInHint")}</p>
                  <Link
                    to={withNext("/login", `/s/${token}`)}
                    className="shrink-0 bg-ink px-5 py-2.5 text-paper smallcaps hover:bg-red"
                  >
                    {t("shared.signIn")}
                  </Link>
                </>
              )}
            </aside>
          }
        />
      </div>
    </RecipePage>
  );
}
