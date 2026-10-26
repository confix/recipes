import type { ReactNode } from "react";
import { Link } from "react-router";

import { MCP_TOOLS, McpSetup } from "~/components/mcp-setup";
import { LegalLinks, Logo, Ornament } from "~/components/ui";

/**
 * The public front page, shown at / to signed-out visitors: what this is,
 * and how to connect an AI assistant to it. Laid out as a cookbook's front
 * matter: title page, contents, then short chapters.
 */

const CHAPTERS = [
  ["foreword", "I", "Foreword"],
  ["conversation", "II", "A conversation in the kitchen"],
  ["mcp", "III", "Connecting your assistant"],
  ["tools", "IV", "What it can reach for"],
] as const;

export function Landing({ mcpUrl }: { mcpUrl: string }) {
  return (
    <div className="mx-auto min-h-screen max-w-4xl px-5 sm:px-8">
      <header className="flex items-baseline justify-between gap-4 border-b border-rule py-4">
        <Logo />
        <nav className="flex items-baseline gap-5 smallcaps">
          <a href="#mcp" className="hidden text-muted hover:text-red sm:inline">
            Connect
          </a>
          <Link to="/login" className="text-muted hover:text-red">
            Sign in
          </Link>
          <Link to="/signup" className="text-red underline-offset-4 hover:underline">
            Create account
          </Link>
        </nav>
      </header>

      <section className="py-20 text-center sm:py-28">
        <p className="text-muted smallcaps">Volume I · the invite-only edition</p>
        <h1 className="mt-6 display text-[5.5rem] leading-[0.85] sm:text-[9rem]">Recipes</h1>
        <p className="mx-auto mt-6 max-w-xl text-2xl text-muted italic sm:text-[1.7rem]">
          a private recipe box that your <span className="text-red">AI assistant</span> can read,
          write, and remember
        </p>
        <Ornament className="mx-auto mt-12 max-w-xs" />
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link to="/signup" className="bg-ink px-6 py-3 text-lg text-paper smallcaps hover:bg-red">
            Begin a collection
          </Link>
          <a href="#mcp" className="border border-ink px-6 py-3 text-lg smallcaps hover:bg-ink hover:text-paper">
            Connect your assistant
          </a>
        </div>
      </section>

      <nav aria-label="Contents" className="mx-auto max-w-xl rule-double pt-6 pb-16">
        <p className="mb-4 text-center text-muted smallcaps">Contents</p>
        <ol>
          {CHAPTERS.map(([id, numeral, title], i) => (
            <li key={id}>
              <a href={`#${id}`} className="group flex items-baseline py-1.5 text-xl">
                <span className="w-10 text-red smallcaps">{numeral}.</span>
                <span className="group-hover:text-red">{title}</span>
                <span className="leader" aria-hidden="true" />
                <span className="figures">{i + 1}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Chapter id="foreword" numeral="I" title="Foreword">
        <div className="drop-cap text-xl leading-relaxed sm:columns-2 sm:gap-10">
          <p>
            Every cook keeps a box of recipes: the dal you make on Tuesdays, the loaf you have
            been tuning for a year, the thing a friend once wrote on a napkin. This is that box,
            with one difference. Your assistant can open it.
          </p>
          <p className="mt-4">
            <Runin>Plain pages.</Runin> Each recipe is a markdown file with a little frontmatter.
            You can export it, keep it under version control, and read it anywhere.
          </p>
          <p className="mt-4">
            <Runin>Found by meaning.</Runin> Look things up by name or ingredient, or by a vague
            craving such as “something warming with chickpeas”.
          </p>
          <p className="mt-4">
            <Runin>For bakers.</Runin> Give a bake its formula in grams, and baker’s percentages
            and hydration are worked out for you.
          </p>
          <p className="mt-4">
            <Runin>At the stove.</Runin> Each recipe page uses large type in one column, and it can
            keep your phone’s screen awake while you cook.
          </p>
        </div>
      </Chapter>

      <Chapter id="conversation" numeral="II" title="A conversation in the kitchen">
        <div className="mx-auto max-w-2xl text-xl leading-relaxed">
          <Line speaker="You">Something cosy for tonight? Like that dal, but with more heat.</Line>
          <Stage>The assistant consults the index, by likeness.</Stage>
          <Line speaker="Assistant">
            You have a <em>Chana Masala</em> that you rated five stars. It is close to the dal and
            spicier, and takes about forty minutes. Shall I read it out?
          </Line>
          <Line speaker="You">Perfect. And log it for tonight, five stars.</Line>
          <Stage>The assistant writes in the cooking log.</Stage>
          <Line speaker="Assistant">Done. That is the seventh time you have made it.</Line>
        </div>
      </Chapter>

      <Chapter id="mcp" numeral="III" title="Connecting your assistant">
        <p className="mb-8 max-w-2xl text-xl leading-relaxed">
          Recipes is a remote MCP server. Add it to your client, sign in once and allow access.
          From then on, your assistant works with your own collection and no one else’s.
        </p>
        <McpSetup mcpUrl={mcpUrl} />
      </Chapter>

      <Chapter id="tools" numeral="IV" title="What it can reach for">
        <ul className="max-w-2xl">
          {MCP_TOOLS.map(([name, description]) => (
            <li key={name} className="flex items-baseline border-b border-ink/10 py-2">
              <code className="font-mono text-[0.9rem] text-red">{name}</code>
              <span className="leader" aria-hidden="true" />
              <span className="text-right text-lg italic">{description}</span>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-lg text-muted">
          Prefer scripts? After signing in you can issue a personal API token and use the REST
          API at <code className="font-mono text-sm">/api/recipes</code>.
        </p>
      </Chapter>

      <footer className="mt-24 rule-double py-10 text-center">
        <p className="text-muted smallcaps">Colophon</p>
        <p className="mx-auto mt-3 max-w-md text-lg text-muted italic">
          Set in Fraunces and Newsreader. Recipes are kept private to your account. Sign-up is by
          invitation.
        </p>
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
  return (
    <section id={id} className="scroll-mt-6 border-t border-rule pt-10 pb-16">
      <p className="text-red smallcaps">Chapter {numeral}</p>
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
