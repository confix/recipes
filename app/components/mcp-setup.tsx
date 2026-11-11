import { useState } from "react";

import { type TKey, useT } from "~/lib/i18n";

/**
 * How to connect an MCP client to this server, written as a recipe. Shown on
 * the public front page and, for signed-in users, on the home page. `mcpUrl`
 * comes from the request origin, so it is right in dev, preview and
 * production alike.
 */
export function McpSetup({ mcpUrl }: { mcpUrl: string }) {
  const { t, rich } = useT();
  return (
    <div>
      <dl className="grid grid-cols-3 border-y border-rule text-center">
        <Fact label={t("mcp.serves")} value={t("mcp.servesValue")} />
        <Fact label={t("mcp.time")} value={t("mcp.timeValue")} />
        <Fact label={t("mcp.keys")} value={t("mcp.keysValue")} />
      </dl>

      <h3 className="mt-8 border-b border-rule pb-1 text-red smallcaps">{t("mcp.ingredients")}</h3>
      <p className="mt-3 text-lg">{t("mcp.address")}</p>
      <div className="mt-3">
        <CopyableCode code={mcpUrl} />
      </div>

      <h3 className="mt-10 border-b border-rule pb-1 text-red smallcaps">{t("mcp.method")}</h3>
      <div className="mt-2">
        <Variation title={t("mcp.claude.title")}>
          <Step n={1}>
            {rich("mcp.claude.1", {
              path: <em>{t("mcp.claude.1.path")}</em>,
              action: <em>{t("mcp.claude.1.action")}</em>,
            })}
          </Step>
          <Step n={2}>{t("mcp.claude.2")}</Step>
          <Step n={3}>{t("mcp.claude.3")}</Step>
        </Variation>
        <Variation title={t("mcp.code.title")}>
          <Step n={1}>{t("mcp.code.1")}</Step>
          <CopyableCode code={`claude mcp add --transport http recipes ${mcpUrl}`} />
          <Step n={2}>
            {rich("mcp.code.2", { command: <code className="font-mono text-sm">/mcp</code> })}
          </Step>
        </Variation>
        <Variation title={t("mcp.other.title")}>
          <Step n={1}>{t("mcp.other.1")}</Step>
          <Step n={2}>{t("mcp.other.2")}</Step>
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
  const { t } = useT();
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
        {copied ? t("mcp.copied") : t("mcp.copy")}
      </button>
    </div>
  );
}

/** The MCP tools, in the order the front page lists them (labels: `tool.<name>`). */
export const MCP_TOOLS = [
  "search_recipes",
  "find_similar",
  "get_recipe",
  "scale_recipe",
  "save_recipe",
  "log_cook",
  "share_recipe",
  "unshare_recipe",
  "list_tags",
  "delete_recipe",
] as const satisfies readonly ToolName[];

type ToolName = { [K in TKey]: K extends `tool.${infer N}` ? N : never }[TKey];
