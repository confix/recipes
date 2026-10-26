import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
// Fonts are bundled, not loaded from Google: no third party sees visitors.
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center p-6 text-center">
      <p className="text-sm text-muted smallcaps">Recipes · an erratum</p>
      <h1 className="mt-4 display text-8xl text-red italic">{message}</h1>
      <p className="mt-6 border-y border-rule py-4 text-xl italic">{details}</p>
      <p className="mt-6">
        <a href="/" className="text-red smallcaps underline underline-offset-4">
          Return to the index
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
