import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import { Alert, AuthShell, Button, Field, textLinkClass } from "~/components/ui";
import { finishAuth } from "~/lib/auth-form.server";
import { getAuth, getSessionUser } from "~/lib/auth.server";
import { withNext } from "~/lib/safe-next";

import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Sign in · Recipes" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getSessionUser(request)) throw redirect("/");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  try {
    const response = await getAuth(request).api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    return await finishAuth(response, {
      request,
      next,
      fallbackError:
        response.status === 401 || response.status === 400
          ? "Incorrect email or password."
          : "Could not sign you in. Please try again.",
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not sign you in." };
  }
}

export default function Login({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/";
  const busy = useNavigation().state === "submitting";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your recipe collection."
      footer={
        <>
          New here?{" "}
          <Link to={withNext("/signup", next)} className={textLinkClass}>
            Create an account
          </Link>
        </>
      }
    >
      <Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" name="email" type="email" required autoComplete="email" autoFocus />
        <Field
          label="Password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          minLength={8}
        />
        {actionData?.error ? <Alert>{actionData.error}</Alert> : null}
        <Button type="submit" disabled={busy} className="mt-2 w-full py-3">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </Form>
    </AuthShell>
  );
}
