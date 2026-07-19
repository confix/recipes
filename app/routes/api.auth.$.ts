import { getAuth } from "~/lib/auth.server";

import type { Route } from "./+types/api.auth.$";

/**
 * Splat route: better-auth owns every path under /api/auth/*.
 * Its handler takes a web Request and returns a web Response, which is exactly
 * what a React Router resource route deals in — no adapter needed.
 */
export async function loader({ request }: Route.LoaderArgs) {
  return getAuth(request).handler(request);
}

export async function action({ request }: Route.ActionArgs) {
  return getAuth(request).handler(request);
}
