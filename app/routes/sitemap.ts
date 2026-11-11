import { LOCALES } from "~/lib/i18n";
import { withLang } from "~/lib/seo";

import type { Route } from "./+types/sitemap";

/** The public, indexable pages. Everything else is private or unlisted. */
const PAGES = ["/", "/login", "/signup", "/imprint", "/privacy"];

export function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;

  const urls = PAGES.map((path) => {
    const alternates = [
      ...LOCALES.map(
        (l) =>
          `    <xhtml:link rel="alternate" hreflang="${l}" href="${origin}${withLang(path, l)}"/>`,
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${origin}${path}"/>`,
    ].join("\n");
    return `  <url>\n    <loc>${origin}${path}</loc>\n${alternates}\n  </url>`;
  }).join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
