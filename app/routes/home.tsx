import { Form } from "react-router";

import { createToken, listTokens, revokeToken } from "~/api/tokens.server";
import { requireUser } from "~/lib/auth.server";

import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Recipes" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return {
    user: { name: user.name, email: user.email },
    tokens: await listTokens(user.id),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();

  if (form.get("intent") === "revoke") {
    await revokeToken(user.id, String(form.get("id") ?? ""));
    return null;
  }

  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  if (!name) return { error: "Give the token a name." };
  const { token } = await createToken(user.id, name);
  return { token };
}

/**
 * The web UI is intentionally tiny: recipes are managed through the API (and
 * the MCP server). This page exists to sign in and issue API tokens.
 */
export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const { user, tokens } = loaderData;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Recipes</h1>
          <p className="text-sm text-neutral-500">{user.email}</p>
        </div>
        <Form method="post" action="/logout">
          <button className="text-sm text-neutral-500 underline">Sign out</button>
        </Form>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">API tokens</h2>
        <p className="text-sm text-neutral-500">
          Use as <code>Authorization: Bearer …</code> against <code>/api</code>.
        </p>

        {actionData && "token" in actionData ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="mb-1">Copy this now — it will not be shown again:</p>
            <code className="break-all">{actionData.token}</code>
          </div>
        ) : null}

        <Form method="post" className="flex gap-2">
          <input
            name="name"
            placeholder="Token name, e.g. laptop"
            required
            maxLength={100}
            className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <button className="rounded bg-neutral-900 px-3 py-2 text-sm text-white">
            Create token
          </button>
        </Form>
        {actionData && "error" in actionData ? (
          <p role="alert" className="text-sm text-red-600">
            {actionData.error}
          </p>
        ) : null}

        <ul className="divide-y divide-neutral-200 text-sm">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2">
              <span>
                {t.name} <code className="text-neutral-500">{t.prefix}…</code>
                <span className="ml-2 text-neutral-400">
                  {t.lastUsedAt
                    ? `last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                    : "never used"}
                </span>
              </span>
              <Form method="post">
                <input type="hidden" name="intent" value="revoke" />
                <input type="hidden" name="id" value={t.id} />
                <button className="text-red-600 underline">Revoke</button>
              </Form>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
