import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import { Alert, AuthShell, Button, Field, textLinkClass } from "~/components/ui";
import { finishAuth } from "~/lib/auth-form.server";
import { getAuth, getSessionUser } from "~/lib/auth.server";
import { type TKey, getTranslator, translate, useT } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n.server";
import { allowAuthRequest } from "~/lib/rate-limit.server";
import { safeNext, withNext } from "~/lib/safe-next";
import { rootData, seo } from "~/lib/seo";

import type { Route } from "./+types/login";

export function meta({ matches }: Route.MetaArgs) {
  const { locale } = rootData(matches);
  return seo({
    matches,
    title: translate(locale, "login.metaTitle"),
    description: translate(locale, "login.subtitle"),
    path: "/login",
    alternates: true,
  });
}

/**
 * Also where the email confirmation link lands (see the sign-up action): on
 * success the user arrives signed in and goes on to `next`; on failure with
 * ?error=, and signing in sends a fresh link.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  if (await getSessionUser(request)) throw redirect(safeNext(params.get("next") ?? "/", request.url));
  const notice: TKey | null = params.has("reset")
    ? "login.passwordChanged"
    : params.has("error")
      ? "login.linkExpired"
      : null;
  return { notice };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  const translator = getTranslator(getLocale(request));
  const { t } = translator;

  if (!email || !password) {
    return { error: t("auth.err.required") };
  }
  if (!(await allowAuthRequest(request, "sign-in"))) return { error: t("auth.err.tooMany") };

  try {
    const response = await getAuth(request).api.signInEmail({
      // Where a fresh confirmation link leads, if the email is unconfirmed.
      body: { email, password, callbackURL: withNext("/login", safeNext(next, request.url)) },
      asResponse: true,
    });
    return await finishAuth(response, {
      request,
      next,
      translator,
      fallbackError:
        response.status === 401 || response.status === 400
          ? t("auth.err.incorrect")
          : t("auth.err.signIn"),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : t("auth.err.signIn") };
  }
}

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/";
  const busy = useNavigation().state === "submitting";
  const { t } = useT();

  return (
    <AuthShell
      title={t("login.title")}
      subtitle={t("login.subtitle")}
      footer={
        <>
          {t("login.newHere")}{" "}
          <Link to={withNext("/signup", next)} className={textLinkClass}>
            {t("login.createAccount")}
          </Link>
        </>
      }
    >
      {loaderData.notice ? (
        <div className="mb-6">
          <Alert tone="warning">{t(loaderData.notice)}</Alert>
        </div>
      ) : null}
      <Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label={t("field.email")} name="email" type="email" required autoComplete="email" autoFocus />
        <Field
          label={t("field.password")}
          name="password"
          type="password"
          required
          autoComplete="current-password"
          minLength={8}
          hint={
            <Link to="/forgot-password" className={textLinkClass}>
              {t("login.forgot")}
            </Link>
          }
        />
        {actionData?.error ? <Alert>{actionData.error}</Alert> : null}
        <Button type="submit" disabled={busy} className="mt-2 w-full py-3">
          {busy ? t("login.signingIn") : t("login.signIn")}
        </Button>
      </Form>
    </AuthShell>
  );
}
