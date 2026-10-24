import { AuthorizationError } from "@cloudflare/workers-oauth-provider";
import { Form, data, isRouteErrorResponse, redirect } from "react-router";

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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-2 p-6">
      <h1 className="text-2xl font-semibold">Could not connect</h1>
      <p role="alert" className="text-sm">
        {message}
      </p>
    </main>
  );
}

export default function Authorize({ loaderData }: Route.ComponentProps) {
  const { handle, email, clientName, clientDomain, redirectHost, redirectIsLoopback } =
    loaderData;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Connect {clientName}?</h1>
        {clientDomain ? (
          <p className="text-sm text-neutral-500">Verified domain: {clientDomain}</p>
        ) : (
          <p className="text-sm text-neutral-500">
            The app chose this name itself; it is not verified.
          </p>
        )}
        <p className="text-sm">
          It will be able to read, create, change and delete recipes in the
          collection of <strong>{email}</strong>.
        </p>
        <p className="text-sm text-neutral-500">
          You will be sent back to <code>{redirectHost}</code>.
        </p>
        {redirectIsLoopback ? (
          <p className="text-sm text-amber-700">
            That is an app on this computer. Only continue if you just started
            the connection yourself.
          </p>
        ) : null}
      </div>

      <Form method="post" className="flex gap-2">
        <input type="hidden" name="handle" value={handle} />
        <button
          name="intent"
          value="approve"
          className="flex-1 rounded bg-neutral-900 px-3 py-2 text-white"
        >
          Allow
        </button>
        <button
          name="intent"
          value="deny"
          className="flex-1 rounded border border-neutral-300 px-3 py-2"
        >
          Deny
        </button>
      </Form>
    </main>
  );
}
