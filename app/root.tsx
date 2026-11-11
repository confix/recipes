import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import { DEFAULT_LOCALE, useT } from "~/lib/i18n";
import { resolveLocale } from "~/lib/i18n.server";
import { seo, type RootData } from "~/lib/seo";

import type { Route } from "./+types/root";
// Fonts are bundled, not loaded from Google: no third party sees visitors.
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "manifest", href: "/site.webmanifest" },
];

/**
 * The UI language and the origin, for every route: components read the
 * locale through useT(), and meta() functions build absolute URLs
 * (canonical, Open Graph) from the origin. See app/lib/seo.ts.
 */
export async function loader({ request }: Route.LoaderArgs): Promise<RootData> {
  const { locale, explicit } = resolveLocale(request);
  return { locale, explicitLocale: explicit, origin: new URL(request.url).origin };
}

export function meta({ matches }: Route.MetaArgs) {
  return seo({ matches });
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData("root") as RootData | undefined;
  return (
    <html lang={data?.locale ?? DEFAULT_LOCALE}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f5efe3" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#161411" media="(prefers-color-scheme: dark)" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useT();
  let message = t("error.oops");
  let details = t("error.unexpected");
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : t("error.title");
    details =
      error.status === 404
        ? typeof error.data === "string" && error.data !== "Not Found"
          ? error.data
          : t("error.notFound")
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center p-6 text-center">
      <title>{`${message} · Recipes`}</title>
      <meta name="robots" content="noindex" />
      <p className="text-sm text-muted smallcaps">{t("error.eyebrow")}</p>
      <h1 className="mt-4 display text-8xl text-red italic">{message}</h1>
      <p className="mt-6 border-y border-rule py-4 text-xl italic">{details}</p>
      <p className="mt-6">
        <a href="/" className="text-red smallcaps underline underline-offset-4">
          {t("error.back")}
        </a>
      </p>
      {stack && (
        <pre className="mt-8 w-full overflow-x-auto border border-rule p-4 text-left font-mono text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
