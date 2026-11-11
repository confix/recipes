import type { Route } from "./+types/robots";

/**
 * Private areas are disallowed outright. Share links (/s/*) are NOT listed
 * here on purpose: they carry a noindex meta tag, and a crawler can only see
 * that tag if it's allowed to fetch the page.
 */
export function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const body = [
    "User-agent: *",
    "Disallow: /api/",
    "Disallow: /r/",
    "Disallow: /mcp",
    "Disallow: /oauth/",
    "Disallow: /authorize",
    "Disallow: /logout",
    "Disallow: /locale",
    "Allow: /",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
