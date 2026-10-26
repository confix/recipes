import { AuthorizationError } from "@cloudflare/workers-oauth-provider";
import { Form, data, isRouteErrorResponse, redirect } from "react-router";

import { Alert, AuthShell, Button } from "~/components/ui";
import { requireUser } from "~/lib/auth.server";
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

export function meta() {
  return [{ title: "Connect an app · Recipes" }];
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
      throw data("This sign-in link has expired. Start again from the app.", {
        status: 400,
      });
    }
    throw error;
  }
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message =
    isRouteErrorResponse(error) && typeof error.data === "string"
      ? error.data
      : "Something went wrong. Start again from the app.";
  return (
    <AuthShell title="Could not connect">
      <Alert>{message}</Alert>
    </AuthShell>
  );
}

export default function Authorize({ loaderData }: Route.ComponentProps) {
  const { handle, email, clientName, clientDomain, redirectHost, redirectIsLoopback } =
    loaderData;

  return (
    <AuthShell
      eyebrow="Recipes · a request for access"
      title={<>Connect <em className="text-red">{clientName}</em>?</>}
      subtitle={
        clientDomain ? (
          <>Verified domain: {clientDomain}</>
        ) : (
          "The app chose this name itself; it is not verified."
        )
      }
    >
      <div className="flex flex-col gap-4 text-lg">
        <p>
          It will be able to <strong className="font-semibold">read, create, change and delete</strong>{" "}
          recipes in the collection of <strong className="font-semibold">{email}</strong>.
        </p>
        <p className="text-muted italic">
          You will be sent back to <code className="font-mono text-sm not-italic">{redirectHost}</code>.
        </p>
        {redirectIsLoopback ? (
          <Alert tone="warning">
            That is an app on this computer. Only continue if you just started the
            connection yourself.
          </Alert>
        ) : null}
      </div>

      <Form method="post" className="mt-8 flex gap-3">
        <input type="hidden" name="handle" value={handle} />
        <Button name="intent" value="deny" variant="secondary" className="flex-1 py-3">
          Deny
        </Button>
        <Button name="intent" value="approve" className="flex-1 py-3">
          Allow
        </Button>
      </Form>
    </AuthShell>
  );
}
