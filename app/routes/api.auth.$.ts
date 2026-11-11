import { getAuth } from "~/lib/auth.server";
import { allowAuthRequest } from "~/lib/rate-limit.server";

import type { Route } from "./+types/api.auth.$";

/**
 * Splat route: better-auth owns every path under /api/auth/*.
 * Its handler takes a web Request and returns a web Response, which is exactly
 * what a React Router resource route deals in — no adapter needed.
 *
 * The web forms call better-auth in-process; this is for the links in emails
 * (GET) and for clients talking to better-auth directly. Those POSTs get the
 * same rate limit as the forms.
 */
export async function loader({ request }: Route.LoaderArgs) {
  return getAuth(request).handler(request);
}

export async function action({ request }: Route.ActionArgs) {
  if (!(await allowAuthRequest(request, "auth-api"))) {
    return Response.json(
      { code: "TOO_MANY_REQUESTS", message: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  return getAuth(request).handler(request);
}
