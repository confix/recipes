import type { TKey, Translator } from "~/lib/i18n";
import { safeNext } from "~/lib/safe-next";

/**
 * Shared by the sign-in and sign-up actions: turn a better-auth response
 * (called with asResponse: true) into either an error to show or the
 * redirect that carries the new session.
 */

/** better-auth error codes we have our own, translated, wording for. */
const AUTH_ERRORS: Record<string, TKey> = {
  INVALID_EMAIL_OR_PASSWORD: "auth.err.incorrect",
  USER_ALREADY_EXISTS: "auth.err.exists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "auth.err.exists",
  PASSWORD_TOO_SHORT: "auth.err.passwordShort",
  INVALID_EMAIL: "auth.err.invalidEmail",
};

/**
 * better-auth error bodies are shaped { message, code } but that is not
 * guaranteed across versions. Known codes get our translated wording; a 403
 * is the sign-up allowlist (app/lib/auth.server.ts); anything else shows
 * better-auth's own (English) message, then a generic one rather than
 * rendering "undefined" at the user.
 */
async function readAuthError(response: Response, fallback: string, { t }: Translator): Promise<string> {
  if (response.status === 403) return t("auth.err.notInvited");
  try {
    const body = (await response.json()) as { message?: string; code?: string };
    const known = body?.code ? AUTH_ERRORS[body.code] : undefined;
    if (known) return t(known);
    if (body?.message) return body.message;
  } catch {
    // non-JSON body; fall through
  }
  return fallback;
}

export async function finishAuth(
  response: Response,
  {
    request,
    next,
    fallbackError,
    translator,
  }: { request: Request; next: string; fallbackError: string; translator: Translator },
): Promise<Response | { error: string }> {
  // With asResponse: true, better-auth REPORTS failures as a non-2xx
  // Response rather than throwing. Without this check a bad password
  // redirects as if it worked, then bounces off requireUser with no
  // explanation.
  if (!response.ok) {
    return { error: await readAuthError(response, fallbackError, translator) };
  }

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    // Authenticated but no session cookie: never expected. Fail loudly
    // rather than redirect into a login loop.
    return { error: translator.t("auth.err.noSession") };
  }

  // That Set-Cookie header IS the session; forward it verbatim. Only
  // same-site relative redirects — `next` is user-controlled and would
  // otherwise be an open redirect.
  const headers = new Headers({ "Set-Cookie": setCookie });
  headers.set("Location", safeNext(next, request.url));
  return new Response(null, { status: 302, headers });
}
