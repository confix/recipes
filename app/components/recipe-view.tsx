import { useEffect, useState, type ReactNode } from "react";
import { Form, Link, useLocation } from "react-router";

import { KeepAwake } from "~/components/keep-awake";
import { CopyableCode } from "~/components/mcp-setup";
import { Button, KindLabel, LegalLinks, Logo, Ornament, inputClass } from "~/components/ui";
import { formatPercent } from "~/lib/bakers-math";
import { useT } from "~/lib/i18n";
import { formatMinutes } from "~/lib/minutes";
import { formatFactor } from "~/recipes/scale";
import type { RecipeViewData } from "~/recipes/view.server";

/**
 * A recipe set for the kitchen: big type, the formula with baker's
 * percentages for bakes, the method. Used by the owner's page (/r/:slug) and
 * the public share page (/s/:token); each adds its own parts around it
 * (`aside` under the facts, `children` after the method).
 */
export function RecipeView({
  recipe,
  linkVariant = true,
  aside,
  children,
}: {
  recipe: RecipeViewData;
  /** variant_of names a recipe in the owner's collection: only link it there. */
  linkVariant?: boolean;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useT();
  const facts = [
    recipe.servings ? { label: t("recipe.serves"), value: recipe.servings } : null,
    recipe.activeMinutes != null ? { label: t("recipe.active"), value: formatMinutes(recipe.activeMinutes) } : null,
    recipe.totalMinutes != null ? { label: t("recipe.total"), value: formatMinutes(recipe.totalMinutes) } : null,
    recipe.bakers ? { label: t("recipe.hydration"), value: formatPercent(recipe.bakers.hydration) } : null,
  ].filter((fact) => fact != null);

  return (
    <>
      <header className="pt-12 text-center sm:pt-16">
        <p className="flex flex-wrap justify-center gap-x-3 text-muted smallcaps">
          <KindLabel kind={recipe.kind} />
          {recipe.tags.map((tag) => (
            <span key={tag}>· {tag}</span>
          ))}
        </p>
        <h1 className="mt-4 display text-5xl leading-[0.95] text-balance sm:text-7xl">{recipe.title}</h1>
        {recipe.variantOf && linkVariant ? (
          <p className="mt-4 text-lg text-muted italic">
            {t("recipe.variationOf")}{" "}
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

      <ScaleControl scale={recipe.scale} />

      {aside}

      {recipe.formula ? (
        <section className="mt-12">
          <h2 className="border-b border-rule pb-1 text-[1.15rem] font-semibold text-red smallcaps">{t("recipe.formula")}</h2>
          <table className="mt-2 w-full text-left text-[1.2rem] figures">
            <thead className="text-sm text-muted smallcaps">
              <tr>
                <th className="py-2 font-normal">{t("recipe.ingredient")}</th>
                <th className="py-2 text-right font-normal">{t("recipe.grams")}</th>
                {recipe.bakers ? <th className="py-2 pl-4 text-right font-normal">{t("recipe.bakers")}</th> : null}
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
          <span className="not-italic smallcaps">{t("recipe.source")} </span>
          {recipe.sourceUrl ? (
            <a href={recipe.sourceUrl} rel="noreferrer noopener" className="text-red underline underline-offset-[3px]">
              {recipe.source}
            </a>
          ) : (
            recipe.source
          )}
        </p>
      ) : null}

      {children}
    </>
  );
}

const PRESETS = [0.5, 1, 2, 3];

/**
 * Halve, double, or any factor. Plain links and a GET form on `?scale=`, so a
 * scaled page is a URL: it works without JavaScript, survives a reload, and
 * can be sent to someone (the MCP scale_recipe tool links to it).
 */
function ScaleControl({ scale }: { scale: number | null }) {
  const { t } = useT();
  const { pathname } = useLocation();
  const current = scale ?? 1;
  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-2">
        <span className="text-sm text-muted smallcaps">{t("scale.label")}</span>
        {PRESETS.map((factor) => (
          <Link
            key={factor}
            to={factor === 1 ? pathname : `${pathname}?scale=${factor}`}
            preventScrollReset
            replace
            aria-current={factor === current ? "true" : undefined}
            className={
              factor === current
                ? "display text-xl text-red italic"
                : "display text-xl text-muted hover:text-red"
            }
          >
            {formatFactor(factor)}
          </Link>
        ))}
        <Form method="get" preventScrollReset replace className="flex items-baseline gap-2">
          <input
            type="number"
            name="scale"
            step="any"
            min={0.1}
            max={20}
            defaultValue={PRESETS.includes(current) ? undefined : current}
            placeholder="1.5"
            aria-label={t("scale.custom")}
            className={`${inputClass} w-16 py-0 text-center text-lg`}
          />
          <Button type="submit" variant="ghost" className="px-0 py-0">
            {t("scale.apply")}
          </Button>
        </Form>
      </div>
      {scale ? (
        <p className="max-w-lg text-center text-base text-muted italic">
          {t("scale.scaled", { factor: formatFactor(scale) })}{" "}
          <Link to={pathname} preventScrollReset replace className="text-red not-italic smallcaps hover:underline">
            {t("scale.reset")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}

/**
 * The owner's share controls: make a public link, copy or send it, or switch
 * it off. The link itself is just a token; see app/recipes/shares.server.ts.
 */
export function ShareBox({ shareUrl, title }: { shareUrl: string | null; title: string }) {
  const { t } = useT();
  // After hydration only: the server can't know, and guessing would mismatch.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare("share" in navigator), []);

  return (
    <section className="mt-16 border-t border-rule pt-6">
      <h2 className="text-[1.15rem] font-semibold text-red smallcaps">{t("share.title")}</h2>
      {shareUrl ? (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-lg">{t("share.active")}</p>
          <CopyableCode code={shareUrl} />
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
            {canShare ? (
              <Button
                type="button"
                variant="secondary"
                className="py-1.5"
                onClick={() => navigator.share({ title, url: shareUrl }).catch(() => {})}
              >
                {t("share.native")}
              </Button>
            ) : null}
            <Form method="post" className="flex flex-wrap items-baseline gap-x-3">
              <input type="hidden" name="intent" value="unshare" />
              <Button variant="danger" className="px-0 py-0">
                {t("share.revoke")}
              </Button>
              <span className="text-base text-muted italic">{t("share.revokeHint")}</span>
            </Form>
          </div>
        </div>
      ) : (
        <Form method="post" className="mt-3 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <input type="hidden" name="intent" value="share" />
          <p className="max-w-md text-lg text-muted italic">{t("share.intro")}</p>
          <Button type="submit" variant="secondary" className="shrink-0">
            {t("share.create")}
          </Button>
        </Form>
      )}
    </section>
  );
}

/** Kitchen reading: one column, large type, a way back and the screen lock. */
export function RecipePage({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-5 pb-24 sm:px-8">
      <nav className="sticky top-0 z-10 flex items-baseline justify-between gap-4 border-b border-rule bg-paper py-3">
        <Link to="/" className="whitespace-nowrap text-muted smallcaps hover:text-red">
          ← <span className="hidden sm:inline">{t("recipe.backThe")}</span>
          {t("recipe.back")}
        </Link>
        <Logo className="hidden sm:inline-flex" />
        <KeepAwake />
      </nav>
      <main>{children}</main>
      <footer className="mt-20 rule-double pt-6">
        <LegalLinks />
      </footer>
    </div>
  );
}
