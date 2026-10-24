import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import { getAuth, getSessionUser } from "~/lib/auth.server";
import { safeNext } from "~/lib/safe-next";

import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Sign in · Recipes" }];
}

/**
 * better-auth error bodies are shaped { message, code } but that is not
 * guaranteed across versions, so fall back to the status text rather than
 * rendering "undefined" at the user.
 */
async function readAuthError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    if (body?.message) return body.message;
  } catch {
    // non-JSON body; fall through
  }
  return response.status === 401 || response.status === 400
    ? "Incorrect email or password."
    : "Could not sign you in. Please try again.";
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getSessionUser(request)) throw redirect("/");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "signin");
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const next = String(form.get("next") ?? "/");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const auth = getAuth(request);

  try {
    // asResponse gives us better-auth's Set-Cookie header, which we forward
    // verbatim on the redirect — that header IS the session.
    const response =
      intent === "signup"
        ? await auth.api.signUpEmail({
            body: { email, password, name: name || email.split("@")[0] },
            asResponse: true,
          })
        : await auth.api.signInEmail({
            body: { email, password },
            asResponse: true,
          });

    // With asResponse: true, better-auth REPORTS failures as a non-2xx
    // Response rather than throwing — so the catch below never sees them.
    // Without this check a bad password redirects as if it worked, then
    // bounces off requireUser with no explanation.
    if (!response.ok) {
      return { error: await readAuthError(response) };
    }

    const setCookie = response.headers.get("set-cookie");
    if (!setCookie) {
      // Authenticated but no session cookie: never expected. Fail loudly
      // rather than redirect into a login loop.
      return { error: "Signed in but no session was issued. Please try again." };
    }

    const headers = new Headers({ "Set-Cookie": setCookie });
    // Only same-site relative redirects — `next` is user-controlled and would
    // otherwise be an open redirect.
    headers.set("Location", safeNext(next, request.url));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not sign you in.";
    return { error: message };
  }
}

export default function Login({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/";
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Recipes</h1>
        <p className="text-sm text-neutral-500">
          Sign in to your collection.
        </p>
      </div>

      <Form method="post" className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />

        <label className="flex flex-col gap-1 text-sm">
          Name <span className="text-neutral-400">(sign up only)</span>
          <input
            name="name"
            autoComplete="name"
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            minLength={8}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>

        {actionData?.error ? (
          <p role="alert" className="text-sm text-red-600">
            {actionData.error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            name="intent"
            value="signin"
            disabled={busy}
            className="flex-1 rounded bg-neutral-900 px-3 py-2 text-white disabled:opacity-50"
          >
            Sign in
          </button>
          <button
            name="intent"
            value="signup"
            disabled={busy}
            className="flex-1 rounded border border-neutral-300 px-3 py-2 disabled:opacity-50"
          >
            Sign up
          </button>
        </div>
      </Form>
    </main>
  );
}
