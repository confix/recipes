import { redirect } from "react-router";

import { isLocale } from "~/lib/i18n";
import { localeCookie } from "~/lib/i18n.server";
import { safeNext } from "~/lib/safe-next";

import type { Route } from "./+types/locale";

/** Language switcher target: pin the choice in a cookie and go back. */
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const locale = form.get("locale");
  // Same-origin only — redirectTo is user-controlled.
  const location = safeNext(String(form.get("redirectTo") ?? "/"), request.url);

  if (!isLocale(locale)) throw redirect(location);
  throw redirect(location, { headers: { "Set-Cookie": localeCookie(locale) } });
}

export async function loader() {
  throw redirect("/");
}
