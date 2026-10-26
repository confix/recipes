import { useState } from "react";

/**
 * How to connect an MCP client to this server, written as a recipe. Shown on
 * the public front page and, for signed-in users, on the home page. `mcpUrl`
 * comes from the request origin, so it is right in dev, preview and
 * production alike.
 */
export function McpSetup({ mcpUrl }: { mcpUrl: string }) {
  return (
    <div>
      <dl className="grid grid-cols-3 border-y border-rule text-center">
        <Fact label="Serves" value="any MCP client" />
        <Fact label="Time" value="one minute" />
        <Fact label="Keys to paste" value="none" />
      </dl>

      <h3 className="mt-8 border-b border-rule pb-1 text-red smallcaps">Ingredients</h3>
      <p className="mt-3 text-lg">The server address, which every client below needs:</p>
      <div className="mt-3">
        <CopyableCode code={mcpUrl} />
      </div>

      <h3 className="mt-10 border-b border-rule pb-1 text-red smallcaps">Method</h3>
      <div className="mt-2">
        <Variation title="Claude.ai & Claude Desktop">
          <Step n={1}>
            Open <em>Settings → Connectors</em> and choose <em>Add custom connector</em>.
          </Step>
          <Step n={2}>Paste the address and save.</Step>
          <Step n={3}>Sign in here when asked, and allow access.</Step>
        </Variation>
        <Variation title="Claude Code">
          <Step n={1}>In a terminal, run:</Step>
          <CopyableCode code={`claude mcp add --transport http recipes ${mcpUrl}`} />
          <Step n={2}>
            Inside Claude Code, run <code className="font-mono text-sm">/mcp</code> and sign in.
          </Step>
        </Variation>
        <Variation title="Any other client">
          <Step n={1}>Add a remote server using the Streamable HTTP transport and the address.</Step>
          <Step n={2}>
            Sign-in is OAuth with dynamic client registration; the client opens it for you.
          </Step>
        </Variation>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-rule px-2 py-3 not-first:border-l">
      <dt className="text-xs text-muted smallcaps">{label}</dt>
      <dd className="mt-0.5 text-lg italic">{value}</dd>
    </div>
  );
}

function Variation({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-x-8 border-b border-ink/15 py-5 sm:grid-cols-[13rem_1fr]">
      <h4 className="display text-xl italic">{title}</h4>
      <ol className="mt-2 flex flex-col gap-3 sm:mt-0">{children}</ol>
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_1fr] gap-2 text-lg leading-snug">
      <span className="display text-2xl leading-none text-red italic">{n}</span>
      <span>{children}</span>
    </li>
  );
}

export function CopyableCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-3 border border-rule bg-paper-2 px-3 py-2.5">
      <code className="min-w-0 flex-1 font-mono text-[0.8rem] leading-relaxed wrap-anywhere">{code}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="shrink-0 text-sm text-red smallcaps hover:underline"
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
