import { Form, Link, useNavigation } from "react-router";

import { Alert, AuthShell, Button, Field, textLinkClass } from "~/components/ui";
import { getAuth } from "~/lib/auth.server";
import { getTranslator, translate, useT } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n.server";
import { allowAuthRequest } from "~/lib/rate-limit.server";
import { rootData, seo } from "~/lib/seo";

import type { Route } from "./+types/forgot-password";

export function meta({ matches }: Route.MetaArgs) {
  return seo({ matches, title: translate(rootData(matches).locale, "forgot.metaTitle"), noindex: true });
}

export async function action({ request }: Route.ActionArgs) {
  const email = String((await request.formData()).get("email") ?? "").trim();
  const { t } = getTranslator(getLocale(request));

  if (!email) return { error: t("forgot.emailRequired") };
  if (!(await allowAuthRequest(request, "reset"))) return { error: t("auth.err.tooMany") };

  try {
    // Answers the same whether or not the address has an account, so the
    // form cannot be used to find out who does. The emailed link lands on
    // /reset-password with ?token= (or ?error= if it has expired).
    await getAuth(request).api.requestPasswordReset({
      body: { email, redirectTo: "/reset-password" },
    });
  } catch (error) {
    console.error("Password reset request failed:", error);
  }
  return { sent: email };
}

export default function ForgotPassword({ actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  const { t } = useT();
  const sent = actionData && "sent" in actionData ? actionData.sent : null;

  return (
    <AuthShell
      title={t("forgot.title")}
      subtitle={sent ? undefined : t("forgot.subtitle")}
      footer={
        <Link to="/login" className={textLinkClass}>
          {t("forgot.back")}
        </Link>
      }
    >
      {sent ? (
        <p className="text-center text-lg">{t("forgot.sent", { email: sent })}</p>
      ) : (
        <Form method="post" className="flex flex-col gap-4">
          <Field label={t("field.email")} name="email" type="email" required autoComplete="email" autoFocus />
          {actionData && "error" in actionData ? <Alert>{actionData.error}</Alert> : null}
          <Button type="submit" disabled={busy} className="mt-2 w-full py-3">
            {busy ? t("forgot.sending") : t("forgot.submit")}
          </Button>
        </Form>
      )}
    </AuthShell>
  );
}
