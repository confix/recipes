import { redirect } from "react-router";

import { getAuth } from "~/lib/auth.server";

import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
  const response = await getAuth(request).api.signOut({
    headers: request.headers,
    asResponse: true,
  });

  const headers = new Headers({ Location: "/" });
  // Forward the cookie-clearing header — that's what actually ends the session.
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) headers.append("Set-Cookie", setCookie);

  return new Response(null, { status: 302, headers });
}

export async function loader() {
  throw redirect("/");
}
