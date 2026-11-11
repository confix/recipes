import { AuthorizationError } from "@cloudflare/workers-oauth-provider";
import { Form, data, isRouteErrorResponse, redirect } from "react-router";

import { Alert, AuthShell, Button } from "~/components/ui";
import { requireUser } from "~/lib/auth.server";
import { getTranslator, translate, useT } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n.server";
import { rootData, seo } from "~/lib/seo";
import { oauthHelpersContext } from "~/mcp/oauth-context";

import type { Route } from "./+types/authorize";

/**
 * OAuth consent for MCP clients. OAuthProvider parses and validates the
 * request; this page only signs the user in (via /login, which comes back
 * here with the query intact) and asks them to approve the client.
 *
 * beginConsent() binds a one-time handle to this browser with a cookie, and
 * approveConsent() checks both — that is the CSRF protection for the form.
 * The grant's props carry only the user id; tools resolve everything else
 * from it.
 */

export function meta({ matches }: Route.MetaArgs) {
  return seo({ matches, title: translate(rootData(matches).locale, "authorize.metaTitle"), noindex: true });
}

/** Forward the consent cookie and anti-framing headers from the loader. */
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return loaderHeaders;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const oauth = context.get(oauthHelpersContext);

  let authRequest;
  try {
    authRequest = await oauth.parseAuthRequest(request);
  } catch (error) {
    // Once the redirect URI is validated, errors go back to the client.
    if (error instanceof AuthorizationError && error.redirectTo) {
      throw redirect(error.redirectTo);
    }
    throw data(
      error instanceof Error ? error.message : "Invalid authorization request.",
      { status: 400 },
    );
  }

  const consent = await oauth.describeConsent(authRequest);
  const { handle, headers } = await oauth.beginConsent(authRequest);
  return data(
    {
      handle,
      email: user.email,
      clientName: consent.clientName,
      clientDomain: consent.clientDomain ?? null,
      redirectHost: consent.redirectHost,
      redirectIsLoopback: consent.redirectIsLoopback,
    },
    { headers },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = await requireUser(request);
  const oauth = context.get(oauthHelpersContext);
  const form = await request.formData();
  const handle = String(form.get("handle") ?? "");

  try {
    if (form.get("intent") !== "approve") {
      const denied = await oauth.denyConsent(request, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }

    const approved = await oauth.approveConsent(request, handle);
    const client = await oauth.lookupClient(approved.request.clientId);
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request,
      userId: user.id,
      metadata: { clientName: client?.clientName ?? approved.request.clientId },
      scope: approved.request.scope,
      props: { userId: user.id },
    });
    const headers = new Headers(approved.headers);
    headers.set("Location", redirectTo);
    return new Response(null, { status: 302, headers });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      // Expired, reused or unbound handle: start over from the client.
      throw data(getTranslator(getLocale(request)).t("authorize.expired"), {
        status: 400,
      });
    }
    throw error;
  }
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useT();
  const message =
    isRouteErrorResponse(error) && typeof error.data === "string"
      ? error.data
      : t("authorize.wrong");
  return (
    <AuthShell title={t("authorize.failed")}>
      <Alert>{message}</Alert>
    </AuthShell>
  );
}

export default function Authorize({ loaderData }: Route.ComponentProps) {
  const { handle, email, clientName, clientDomain, redirectHost, redirectIsLoopback } =
    loaderData;
  const { t, rich } = useT();

  return (
    <AuthShell
      eyebrow={t("authorize.eyebrow")}
      title={rich("authorize.title", { client: <em className="text-red">{clientName}</em> })}
      subtitle={
        clientDomain ? t("authorize.verified", { domain: clientDomain }) : t("authorize.unverified")
      }
    >
      <div className="flex flex-col gap-4 text-lg">
        <p>
          {rich("authorize.can", {
            verbs: <strong className="font-semibold">{t("authorize.verbs")}</strong>,
            email: <strong className="font-semibold">{email}</strong>,
          })}
        </p>
        <p className="text-muted italic">
          {rich("authorize.redirect", {
            host: <code className="font-mono text-sm not-italic">{redirectHost}</code>,
          })}
        </p>
        {redirectIsLoopback ? <Alert tone="warning">{t("authorize.loopback")}</Alert> : null}
      </div>

      <Form method="post" className="mt-8 flex gap-3">
        <input type="hidden" name="handle" value={handle} />
        <Button name="intent" value="deny" variant="secondary" className="flex-1 py-3">
          {t("authorize.deny")}
        </Button>
        <Button name="intent" value="approve" className="flex-1 py-3">
          {t("authorize.allow")}
        </Button>
      </Form>
    </AuthShell>
  );
}
