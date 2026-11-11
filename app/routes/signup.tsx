import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import { Alert, AuthShell, Button, Field, textLinkClass } from "~/components/ui";
import { finishAuth } from "~/lib/auth-form.server";
import { getAuth, getSessionUser } from "~/lib/auth.server";
import { getTranslator, translate, useT } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n.server";
import { allowAuthRequest } from "~/lib/rate-limit.server";
import { safeNext, withNext } from "~/lib/safe-next";
import { rootData, seo } from "~/lib/seo";

import type { Route } from "./+types/signup";

export function meta({ matches }: Route.MetaArgs) {
  const { locale } = rootData(matches);
  return seo({
    matches,
    title: translate(locale, "signup.metaTitle"),
    description: translate(locale, "signup.subtitle"),
    path: "/signup",
    alternates: true,
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getSessionUser(request)) throw redirect("/");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  const translator = getTranslator(getLocale(request));
  const { t } = translator;

  if (!email || !password) {
    return { error: t("auth.err.required") };
  }
  if (!(await allowAuthRequest(request, "sign-up"))) return { error: t("auth.err.tooMany") };

  try {
    const response = await getAuth(request).api.signUpEmail({
      body: {
        email,
        password,
        name: name || email.split("@")[0],
        // The confirmation link signs the user in and lands on /login,
        // which sends them on to `next`.
        callbackURL: withNext("/login", safeNext(next, request.url)),
      },
      asResponse: true,
    });
    // No session until the address is confirmed (auth.server.ts). A taken
    // address gives this same answer, by design.
    if (response.ok && !response.headers.get("set-cookie")) return { sent: email };
    return await finishAuth(response, {
      request,
      next,
      translator,
      fallbackError: t("auth.err.signUp"),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : t("auth.err.signUp") };
  }
}

export default function Signup({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/";
  const busy = useNavigation().state === "submitting";
  const { t } = useT();

  if (actionData && "sent" in actionData && actionData.sent) {
    return (
      <AuthShell title={t("signup.checkTitle")} subtitle={t("signup.checkSubtitle")}>
        <div className="flex flex-col gap-3 text-center text-lg">
          <p>{t("signup.checkBody", { email: actionData.sent })}</p>
          <p className="text-muted italic">{t("signup.checkHint")}</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("signup.title")}
      subtitle={t("signup.subtitle")}
      footer={
        <>
          {t("signup.haveAccount")}{" "}
          <Link to={withNext("/login", next)} className={textLinkClass}>
            {t("signup.signIn")}
          </Link>
        </>
      }
    >
      <Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label={t("field.name")} name="name" autoComplete="name" autoFocus />
        <Field label={t("field.email")} name="email" type="email" required autoComplete="email" />
        <Field
          label={t("field.password")}
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          hint={t("field.passwordHint")}
        />
        {actionData && "error" in actionData ? <Alert>{actionData.error}</Alert> : null}
        <Button type="submit" disabled={busy} className="mt-2 w-full py-3">
          {busy ? t("signup.creating") : t("signup.create")}
        </Button>
      </Form>
    </AuthShell>
  );
}
