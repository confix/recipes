import { Form, Link, redirect, useNavigation } from "react-router";

import { Alert, AuthShell, Button, Field, textLinkClass } from "~/components/ui";
import { readAuthError } from "~/lib/auth-form.server";
import { getAuth } from "~/lib/auth.server";
import { getTranslator, translate, useT } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n.server";
import { allowAuthRequest } from "~/lib/rate-limit.server";
import { rootData, seo } from "~/lib/seo";

import type { Route } from "./+types/reset-password";

export function meta({ matches }: Route.MetaArgs) {
  return seo({ matches, title: translate(rootData(matches).locale, "reset.metaTitle"), noindex: true });
}

/**
 * The emailed link goes through better-auth (/api/auth/reset-password/:token),
 * which checks the token and comes back here with ?token=, or with ?error=
 * when it is unknown or expired.
 */
export function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const token = params.get("error") ? null : params.get("token");
  return { token };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const newPassword = String(form.get("password") ?? "");
  const translator = getTranslator(getLocale(request));
  const { t } = translator;

  if (!newPassword) return { error: t("auth.err.required") };
  if (!(await allowAuthRequest(request, "reset"))) return { error: t("auth.err.tooMany") };

  const response = await getAuth(request).api.resetPassword({
    body: { token, newPassword },
    asResponse: true,
  });
  if (!response.ok) return { error: await readAuthError(response, t("reset.failed"), translator) };
  // Every session was signed out with the old password; sign in afresh.
  throw redirect("/login?reset");
}

export default function ResetPassword({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  const { t } = useT();

  if (!loaderData.token) {
    return (
      <AuthShell title={t("reset.expiredTitle")} subtitle={t("reset.expired")}>
        <p className="text-center">
          <Link to="/forgot-password" className={textLinkClass}>
            {t("reset.again")}
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("reset.title")} subtitle={t("reset.subtitle")}>
      <Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="token" value={loaderData.token} />
        <Field
          label={t("reset.newPassword")}
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          hint={t("field.passwordHint")}
          autoFocus
        />
        {actionData?.error ? <Alert>{actionData.error}</Alert> : null}
        <Button type="submit" disabled={busy} className="mt-2 w-full py-3">
          {busy ? t("reset.saving") : t("reset.submit")}
        </Button>
      </Form>
    </AuthShell>
  );
}
