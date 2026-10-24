import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import { Alert, AuthShell, Button, Field, textLinkClass } from "~/components/ui";
import { finishAuth } from "~/lib/auth-form.server";
import { getAuth, getSessionUser } from "~/lib/auth.server";
import { withNext } from "~/lib/safe-next";

import type { Route } from "./+types/signup";

export function meta() {
  return [{ title: "Create account · Recipes" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getSessionUser(request)) throw redirect("/");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  try {
    // Who may sign up is decided in auth.server.ts (the email allowlist);
    // its refusal comes back here as an error message.
    const response = await getAuth(request).api.signUpEmail({
      body: { email, password, name: name || email.split("@")[0] },
      asResponse: true,
    });
    return await finishAuth(response, {
      request,
      next,
      fallbackError: "Could not create your account. Please try again.",
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create your account." };
  }
}

export default function Signup({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/";
  const busy = useNavigation().state === "submitting";

  return (
    <AuthShell
      title="Create your account"
      subtitle="Sign-up is invite-only. Use the email address you were invited with."
      footer={
        <>
          Already have an account?{" "}
          <Link to={withNext("/login", next)} className={textLinkClass}>
            Sign in
          </Link>
        </>
      }
    >
      <Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Name" name="name" autoComplete="name" autoFocus />
        <Field label="Email" name="email" type="email" required autoComplete="email" />
        <Field
          label="Password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          hint="At least 8 characters."
        />
        {actionData?.error ? <Alert>{actionData.error}</Alert> : null}
        <Button type="submit" disabled={busy} className="mt-2 w-full py-3">
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </Form>
    </AuthShell>
  );
}
