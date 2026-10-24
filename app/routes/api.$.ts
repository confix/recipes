import { handleApi } from "~/api/router.server";

import type { Route } from "./+types/api.$";

/** Splat resource route: everything under /api/* except /api/auth/*. */
export async function loader({ request }: Route.LoaderArgs) {
  return handleApi(request);
}

export async function action({ request }: Route.ActionArgs) {
  return handleApi(request);
}
