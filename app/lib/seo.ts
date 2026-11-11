import type { MetaDescriptor } from "react-router";

import { DEFAULT_LOCALE, isLocale, LOCALES, translate, type Locale } from "./i18n";

/** Shape of the root loader's data, as seen from a route's `meta()`. */
export interface RootData {
  locale: Locale;
  explicitLocale: boolean;
  origin: string;
}

type AnyMatches = ReadonlyArray<{ id: string; loaderData?: unknown; data?: unknown } | undefined>;

export function rootData(matches: AnyMatches): RootData {
  const root = matches.find((m) => m?.id === "root");
  const data = (root?.loaderData ?? root?.data) as Partial<RootData> | undefined;
  return {
    locale: isLocale(data?.locale) ? data.locale : DEFAULT_LOCALE,
    explicitLocale: Boolean(data?.explicitLocale),
    origin: data?.origin ?? "",
  };
}

/** The brand; not translated. */
export const SITE_NAME = "Recipes";

const OG_LOCALE: Record<Locale, string> = { en: "en_US", de: "de_DE" };

interface SeoInput {
  matches: AnyMatches;
  /** Page title without the site suffix; omit for the site name alone. */
  title?: string;
  description?: string;
  /** Path for canonical/og:url, e.g. "/privacy". Omit on private pages. */
  path?: string;
  /** Absolute or root-relative image URL. Defaults to the site OG image. */
  image?: string;
  type?: "website" | "article";
  /**
   * Keep out of search results. Private pages and unlisted share links
   * still get titles and previews, they just aren't indexed.
   */
  noindex?: boolean;
  /** Emit hreflang alternates (only for pages that exist in every locale). */
  alternates?: boolean;
  jsonLd?: Record<string, unknown>;
}

/**
 * One place that knows every tag a page needs: title, description, canonical,
 * hreflang, Open Graph and Twitter cards, robots, and optional JSON-LD.
 * Child `meta()` exports replace the parent's entirely in React Router, so
 * every route goes through this rather than relying on root defaults.
 */
export function seo(input: SeoInput): MetaDescriptor[] {
  const { locale, explicitLocale, origin } = rootData(input.matches);
  const siteName = SITE_NAME;
  const title = input.title ? `${input.title} · ${siteName}` : `${siteName} · ${translate(locale, "app.tagline")}`;
  const description = input.description ?? translate(locale, "app.description");
  const image = absolute(origin, input.image ?? "/og-image.png");

  const tags: MetaDescriptor[] = [
    { title },
    { name: "description", content: description },
    { property: "og:site_name", content: siteName },
    { property: "og:title", content: input.title ?? siteName },
    { property: "og:description", content: description },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:image", content: image },
    { property: "og:locale", content: OG_LOCALE[locale] },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: input.title ?? siteName },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];

  if (input.image === undefined) {
    tags.push(
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
    );
  }

  if (input.noindex) {
    tags.push({ name: "robots", content: "noindex, nofollow" });
  }

  if (input.path !== undefined) {
    // The bare URL negotiates its language, so it is its own canonical;
    // `?lang=xx` URLs are the stable per-language variants.
    const canonical = absolute(
      origin,
      explicitLocale ? withLang(input.path, locale) : input.path,
    );
    tags.push(
      { tagName: "link", rel: "canonical", href: canonical },
      { property: "og:url", content: canonical },
    );
    if (input.alternates) {
      for (const l of LOCALES) {
        tags.push({
          tagName: "link",
          rel: "alternate",
          hrefLang: l,
          href: absolute(origin, withLang(input.path, l)),
        });
      }
      tags.push({
        tagName: "link",
        rel: "alternate",
        hrefLang: "x-default",
        href: absolute(origin, input.path),
      });
    }
  }

  if (input.jsonLd) {
    tags.push({ "script:ld+json": input.jsonLd });
  }

  return tags;
}

export function withLang(path: string, locale: Locale): string {
  return `${path}${path.includes("?") ? "&" : "?"}lang=${locale}`;
}

function absolute(origin: string, url: string): string {
  return /^https?:\/\//.test(url) ? url : `${origin}${url}`;
}
