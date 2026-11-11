import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALES, type Locale } from "./i18n";

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** Best match from an Accept-Language header, honouring q-weights. */
function fromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}

export interface ResolvedLocale {
  locale: Locale;
  /**
   * True when the URL pinned the locale (`?lang=de`). Those URLs are the
   * stable, crawlable per-language addresses that hreflang points at; the
   * bare URL negotiates and acts as x-default.
   */
  explicit: boolean;
}

/**
 * Resolve the UI language: `?lang=` beats the cookie set by the language
 * switcher, which beats the browser's Accept-Language.
 */
export function resolveLocale(request: Request): ResolvedLocale {
  const param = new URL(request.url).searchParams.get("lang");
  if (isLocale(param)) return { locale: param, explicit: true };

  const cookie = cookieValue(request, LOCALE_COOKIE);
  if (isLocale(cookie)) return { locale: cookie, explicit: false };

  return {
    locale: fromAcceptLanguage(request.headers.get("accept-language")) ?? DEFAULT_LOCALE,
    explicit: false,
  };
}

export function getLocale(request: Request): Locale {
  return resolveLocale(request).locale;
}

export function localeCookie(locale: Locale): string {
  // A year; Lax so it rides along on the top-level navigation back from the
  // switcher. Not HttpOnly-sensitive — it holds nothing but "en"/"de".
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export { LOCALES };
