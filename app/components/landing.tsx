import type { ReactNode } from "react";
import { Link } from "react-router";

import { MCP_TOOLS, McpSetup } from "~/components/mcp-setup";
import { LegalLinks, Logo, Ornament } from "~/components/ui";
import { type TKey, useT } from "~/lib/i18n";

/**
 * The public front page, shown at / to signed-out visitors: what this is,
 * and how to connect an AI assistant to it. Laid out as a cookbook's front
 * matter: title page, contents, then short chapters.
 */

const CHAPTERS = [
  ["foreword", "I", "landing.ch.foreword"],
  ["conversation", "II", "landing.ch.conversation"],
  ["mcp", "III", "landing.ch.mcp"],
  ["tools", "IV", "landing.ch.tools"],
] as const satisfies readonly (readonly [string, string, TKey])[];

const RUNINS = [
  ["landing.plain.title", "landing.plain.body"],
  ["landing.meaning.title", "landing.meaning.body"],
  ["landing.bakers.title", "landing.bakers.body"],
  ["landing.scale.title", "landing.scale.body"],
  ["landing.share.title", "landing.share.body"],
  ["landing.stove.title", "landing.stove.body"],
] as const satisfies readonly (readonly [TKey, TKey])[];

export function Landing({ mcpUrl }: { mcpUrl: string }) {
  const { t, rich } = useT();
  return (
    <div className="mx-auto min-h-screen max-w-4xl px-5 sm:px-8">
      <header className="flex items-baseline justify-between gap-4 border-b border-rule py-4">
        <Logo />
        <nav className="flex items-baseline gap-5 smallcaps">
          <a href="#mcp" className="hidden text-muted hover:text-red sm:inline">
            {t("landing.connect")}
          </a>
          <Link to="/login" className="text-muted hover:text-red">
            {t("landing.signIn")}
          </Link>
          <Link to="/signup" className="text-red underline-offset-4 hover:underline">
            {t("landing.createAccount")}
          </Link>
        </nav>
      </header>

      <section className="py-20 text-center sm:py-28">
        <p className="text-muted smallcaps">{t("landing.edition")}</p>
        <h1 className="mt-6 display text-[5.5rem] leading-[0.85] sm:text-[9rem]">Recipes</h1>
        <p className="mx-auto mt-6 max-w-xl text-2xl text-muted italic sm:text-[1.7rem]">
          {t("landing.taglineBefore")} <span className="text-red">{t("landing.taglineAssistant")}</span>{" "}
          {t("landing.taglineAfter")}
        </p>
        <Ornament className="mx-auto mt-12 max-w-xs" />
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link to="/signup" className="bg-ink px-6 py-3 text-lg text-paper smallcaps hover:bg-red">
            {t("landing.begin")}
          </Link>
          <a href="#mcp" className="border border-ink px-6 py-3 text-lg smallcaps hover:bg-ink hover:text-paper">
            {t("landing.connectAssistant")}
          </a>
        </div>
      </section>

      <nav aria-label="Contents" className="mx-auto max-w-xl rule-double pt-6 pb-16">
        <p className="mb-4 text-center text-muted smallcaps">{t("landing.contents")}</p>
        <ol>
          {CHAPTERS.map(([id, numeral, title], i) => (
            <li key={id}>
              <a href={`#${id}`} className="group flex items-baseline py-1.5 text-xl">
                <span className="w-10 text-red smallcaps">{numeral}.</span>
                <span className="group-hover:text-red">{t(title)}</span>
                <span className="leader" aria-hidden="true" />
                <span className="figures">{i + 1}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Chapter id="foreword" numeral="I" title={t("landing.ch.foreword")}>
        <div className="drop-cap text-xl leading-relaxed sm:columns-2 sm:gap-10">
          <p>{t("landing.foreword")}</p>
          {RUNINS.map(([title, body]) => (
            <p key={title} className="mt-4">
              <Runin>{t(title)}</Runin> {t(body)}
            </p>
          ))}
        </div>
      </Chapter>

      <Chapter id="conversation" numeral="II" title={t("landing.ch.conversation")}>
        <div className="mx-auto max-w-2xl text-xl leading-relaxed">
          <Line speaker={t("landing.you")}>{t("landing.line1")}</Line>
          <Stage>{t("landing.stage1")}</Stage>
          <Line speaker={t("landing.assistant")}>
            {rich("landing.line2", {
              recipe: <em className="text-red underline underline-offset-[3px]">{t("landing.line2.recipe")}</em>,
            })}
          </Line>
          <Line speaker={t("landing.you")}>{t("landing.line3")}</Line>
          <Stage>{t("landing.stage2")}</Stage>
          <Line speaker={t("landing.assistant")}>{t("landing.line4")}</Line>
        </div>
      </Chapter>

      <Chapter id="mcp" numeral="III" title={t("landing.ch.mcp")}>
        <p className="mb-8 max-w-2xl text-xl leading-relaxed">{t("landing.mcpIntro")}</p>
        <McpSetup mcpUrl={mcpUrl} />
      </Chapter>

      <Chapter id="tools" numeral="IV" title={t("landing.ch.tools")}>
        <ul className="max-w-2xl">
          {MCP_TOOLS.map((name) => (
            <li key={name} className="flex items-baseline border-b border-ink/10 py-2">
              <code className="font-mono text-[0.9rem] text-red">{name}</code>
              <span className="leader" aria-hidden="true" />
              <span className="text-right text-lg italic">{t(`tool.${name}`)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-lg text-muted">
          {rich("landing.scripts", { path: <code className="font-mono text-sm">/api/recipes</code> })}
        </p>
      </Chapter>

      <footer className="mt-24 rule-double py-10 text-center">
        <p className="text-muted smallcaps">{t("landing.colophon")}</p>
        <p className="mx-auto mt-3 max-w-md text-lg text-muted italic">{t("landing.colophonText")}</p>
        <LegalLinks className="mt-6" />
      </footer>
    </div>
  );
}

function Chapter({
  id,
  numeral,
  title,
  children,
}: {
  id: string;
  numeral: string;
  title: string;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <section id={id} className="scroll-mt-6 border-t border-rule pt-10 pb-16">
      <p className="text-red smallcaps">{t("landing.chapter", { n: numeral })}</p>
      <h2 className="mt-1 mb-8 display text-4xl sm:text-5xl">{title}</h2>
      {children}
    </section>
  );
}

function Runin({ children }: { children: ReactNode }) {
  return <span className="text-red smallcaps">{children}</span>;
}

/** A line of dialogue, set like a play script. */
function Line({ speaker, children }: { speaker: string; children: ReactNode }) {
  return (
    <p className="my-4 grid gap-x-4 sm:grid-cols-[7rem_1fr]">
      <span className="text-red smallcaps sm:text-right">{speaker}.</span>
      <span>{children}</span>
    </p>
  );
}

function Stage({ children }: { children: ReactNode }) {
  return <p className="my-4 text-center text-lg text-muted italic">[ {children} ]</p>;
}
