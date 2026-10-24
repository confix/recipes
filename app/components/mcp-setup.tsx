import { useState } from "react";

/**
 * How to connect an MCP client to this server. Shown on the public front
 * page and, for signed-in users, on the home page. `mcpUrl` comes from the
 * request origin, so it is right in dev, preview and production alike.
 */
export function McpSetup({ mcpUrl }: { mcpUrl: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SetupCard
        step="Claude.ai & Claude Desktop"
        body={
          <>
            Open <strong>Settings → Connectors</strong>, choose <strong>Add custom connector</strong>,
            and paste this URL. You will be asked to sign in and allow access.
          </>
        }
        code={mcpUrl}
      />
      <SetupCard
        step="Claude Code"
        body="Add the server from your terminal, then run /mcp inside Claude Code to sign in."
        code={`claude mcp add --transport http recipes ${mcpUrl}`}
      />
      <SetupCard
        step="Any other MCP client"
        body="Use the Streamable HTTP transport with this URL. Sign-in is OAuth with dynamic client registration, so there is no key to paste."
        code={mcpUrl}
      />
    </div>
  );
}

function SetupCard({ step, body, code }: { step: string; body: React.ReactNode; code: string }) {
  return (
    <div className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-900/5 dark:bg-stone-900 dark:ring-white/10">
      <h3 className="font-display text-lg font-semibold">{step}</h3>
      <p className="mt-2 mb-4 text-sm text-stone-600 dark:text-stone-400">{body}</p>
      <CopyableCode code={code} />
    </div>
  );
}

export function CopyableCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-auto flex items-start gap-2 rounded-xl bg-stone-900 p-3 text-stone-100 dark:bg-black/50">
      <code className="min-w-0 flex-1 font-mono text-xs leading-relaxed wrap-anywhere">{code}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold text-stone-300 ring-1 ring-stone-700 transition hover:bg-stone-800 hover:text-white"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export const MCP_TOOLS = [
  ["search_recipes", "keyword and natural-language search"],
  ["find_similar", "recipes like this one, or like a description"],
  ["get_recipe", "read the full markdown"],
  ["save_recipe", "create or edit a recipe"],
  ["log_cook", "record that you made it, with a rating"],
  ["list_tags", "every tag in your collection"],
  ["delete_recipe", "remove a recipe"],
] as const;
