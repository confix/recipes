import { safeNext } from "~/lib/safe-next";

/**
 * Shared by the sign-in and sign-up actions: turn a better-auth response
 * (called with asResponse: true) into either an error to show or the
 * redirect that carries the new session.
 */

/**
 * better-auth error bodies are shaped { message, code } but that is not
 * guaranteed across versions, so fall back to a generic message rather than
 * rendering "undefined" at the user.
 */
async function readAuthError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    if (body?.message) return body.message;
  } catch {
    // non-JSON body; fall through
  }
  return fallback;
}

export async function finishAuth(
  response: Response,
  { request, next, fallbackError }: { request: Request; next: string; fallbackError: string },
): Promise<Response | { error: string }> {
  // With asResponse: true, better-auth REPORTS failures as a non-2xx
  // Response rather than throwing. Without this check a bad password
  // redirects as if it worked, then bounces off requireUser with no
  // explanation.
  if (!response.ok) {
    return { error: await readAuthError(response, fallbackError) };
  }

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    // Authenticated but no session cookie: never expected. Fail loudly
    // rather than redirect into a login loop.
    return { error: "Signed in but no session was issued. Please try again." };
  }

  // That Set-Cookie header IS the session; forward it verbatim. Only
  // same-site relative redirects — `next` is user-controlled and would
  // otherwise be an open redirect.
  const headers = new Headers({ "Set-Cookie": setCookie });
  headers.set("Location", safeNext(next, request.url));
  return new Response(null, { status: 302, headers });
}
