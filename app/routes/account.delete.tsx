import { Form, Link, useNavigation } from "react-router";

import { Alert, AuthShell, Button, Field, textLinkClass } from "~/components/ui";
import { getAuth, requireUser } from "~/lib/auth.server";
import { checkPassword, deleteAccount } from "~/lib/delete-account.server";
import { getTranslator, translate, useT } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n.server";
import { sendAccountMail } from "~/lib/mail.server";
import { OPERATOR } from "~/lib/operator";
import { allowAuthRequest } from "~/lib/rate-limit.server";
import { rootData, seo } from "~/lib/seo";
import { oauthHelpersContext } from "~/mcp/oauth-context";
import { indexedSlugs } from "~/recipes/search-index.server";

import type { Route } from "./+types/account.delete";

export function meta({ matches }: Route.MetaArgs) {
  return seo({ matches, title: translate(rootData(matches).locale, "delete.metaTitle"), noindex: true });
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const recipes = (await indexedSlugs(user.id)).length;
  return { email: user.email, recipes };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = await requireUser(request);
  const { t, locale } = getTranslator(getLocale(request));
  const password = String((await request.formData()).get("password") ?? "");

  if (!password) return { error: t("delete.passwordRequired") };
  if (!(await allowAuthRequest(request, "delete-account"))) return { error: t("auth.err.tooMany") };
  // A session alone is not enough: it could be a borrowed laptop.
  if (!(await checkPassword(request, password))) return { error: t("delete.wrongPassword") };

  // Only set on origins that serve OAuth (workers/app.ts). Grants are kept
  // per user, not per origin, so without the helpers they could not be
  // revoked: refuse rather than leave connected apps behind.
  let oauth;
  try {
    oauth = context.get(oauthHelpersContext);
  } catch {
    return { error: t("delete.needsHttps") };
  }
  await deleteAccount(user.id, oauth);

  try {
    await sendAccountMail("deleted", user, locale, { contact: OPERATOR.email });
  } catch (error) {
    // The account is gone either way; the email is only a receipt.
    console.error("Could not send account-deleted mail:", error);
  }

  // The session row went with the user; this clears the cookie too.
  const signOut = await getAuth(request).api.signOut({ headers: request.headers, asResponse: true });
  const headers = new Headers({ Location: "/?deleted" });
  const setCookie = signOut.headers.get("set-cookie");
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return new Response(null, { status: 302, headers });
}

export default function DeleteAccount({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  const { t, tn } = useT();

  return (
    <AuthShell
      title={t("delete.title")}
      subtitle={t("delete.subtitle", { email: loaderData.email })}
      footer={
        <Link to="/" className={textLinkClass}>
          {t("delete.keep")}
        </Link>
      }
    >
      <div className="flex flex-col gap-3 text-lg">
        <p>{tn("delete.what", loaderData.recipes)}</p>
        <p className="text-muted italic">{t("delete.copies")}</p>
        <p className="text-red">{t("delete.final")}</p>
      </div>
      <Form method="post" className="mt-8 flex flex-col gap-4">
        <Field
          label={t("delete.confirmLabel")}
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
        {actionData?.error ? <Alert>{actionData.error}</Alert> : null}
        <Button type="submit" variant="destructive" disabled={busy} className="mt-2 w-full py-3">
          {busy ? t("delete.deleting") : t("delete.submit")}
        </Button>
      </Form>
    </AuthShell>
  );
}
