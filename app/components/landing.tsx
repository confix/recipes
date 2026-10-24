import { Link } from "react-router";

import { MCP_TOOLS, McpSetup } from "~/components/mcp-setup";
import { BowlIcon, ClockIcon, KindBadge, Logo } from "~/components/ui";

/**
 * The public front page, shown at / to signed-out visitors: what this is,
 * and how to connect an AI assistant to it.
 */
export function Landing({ mcpUrl }: { mcpUrl: string }) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[48rem] bg-[radial-gradient(60rem_36rem_at_15%_-10%,var(--color-brand-200),transparent_65%),radial-gradient(40rem_30rem_at_95%_10%,var(--color-amber-200),transparent_65%)] opacity-70 dark:bg-[radial-gradient(60rem_36rem_at_15%_-10%,var(--color-brand-900),transparent_65%),radial-gradient(40rem_30rem_at_95%_10%,var(--color-amber-950),transparent_65%)] dark:opacity-50"
      />

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <a href="#mcp" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-stone-600 hover:text-stone-900 sm:inline dark:text-stone-400 dark:hover:text-stone-100">
            Connect
          </a>
          <Link to="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-900/5 dark:text-stone-300 dark:hover:bg-white/10">
            Sign in
          </Link>
          <Link to="/signup" className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200">
            Create account
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-200 backdrop-blur dark:bg-white/5 dark:text-brand-300 dark:ring-brand-900">
              <span className="size-1.5 rounded-full bg-brand-500" />
              Works with Claude and any MCP client
            </p>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
              Your recipe box, <span className="text-brand-600 italic dark:text-brand-400">fluent in AI</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-stone-600 dark:text-stone-400">
              Save a recipe straight from a chat, ask for “something like that dal, but
              spicier”, and read it in the kitchen with the screen kept on. Your recipes
              stay plain markdown you own.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white shadow-sm shadow-brand-900/20 hover:bg-brand-700">
                Get started
              </Link>
              <a href="#mcp" className="rounded-xl bg-white px-5 py-3 font-semibold text-stone-800 ring-1 ring-stone-300 ring-inset hover:bg-stone-50 dark:bg-stone-900 dark:text-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800">
                Connect your assistant
              </a>
            </div>
            <p className="mt-4 text-sm text-stone-500">Sign-up is currently invite-only.</p>
          </div>

          <ChatMock />
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature title="Markdown you own" body="Each recipe is one markdown file with a little frontmatter. Export it, version it, read it anywhere." />
            <Feature title="Search by meaning" body="Find recipes by name, ingredient, or a vague craving. Similar-recipe search is built in." />
            <Feature title="Made for bakers" body="Give a bake its formula in grams and get baker’s percentages and hydration for free." />
            <Feature title="Kitchen mode" body="Large type, one column, and a switch that keeps your phone’s screen awake while you cook." />
          </div>
        </section>

        <section id="mcp" className="scroll-mt-8 border-y border-stone-900/5 bg-white/60 py-20 dark:border-white/5 dark:bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold tracking-wider text-brand-700 uppercase dark:text-brand-400">MCP setup</p>
              <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight">Connect your assistant in a minute</h2>
              <p className="mt-4 text-lg text-stone-600 dark:text-stone-400">
                Recipes is a remote MCP server. Add it to your client, sign in once, and allow
                access. Your assistant then works only with your own collection.
              </p>
            </div>

            <div className="mt-10">
              <McpSetup mcpUrl={mcpUrl} />
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <h3 className="font-display text-2xl font-semibold">What your assistant can do</h3>
                <p className="mt-2 text-stone-600 dark:text-stone-400">
                  Ask in plain language: “save this recipe”, “what can I make with leeks?”, “I made
                  the sourdough today, 4 stars, needed more salt”.
                </p>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {MCP_TOOLS.map(([name, description]) => (
                  <li key={name} className="rounded-xl bg-white px-4 py-3 ring-1 ring-stone-900/5 dark:bg-stone-900 dark:ring-white/10">
                    <code className="text-sm font-semibold text-brand-700 dark:text-brand-300">{name}</code>
                    <span className="block text-sm text-stone-600 dark:text-stone-400">{description}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-10 text-sm text-stone-500">
              Prefer scripts? After signing in you can create a personal API token and use the REST API at{" "}
              <code>/api/recipes</code>.
            </p>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10 text-sm text-stone-500 sm:px-6">
        <Logo className="scale-90 opacity-80" />
        <span>Recipes stay private to your account.</span>
      </footer>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white/80 p-5 ring-1 ring-stone-900/5 backdrop-blur dark:bg-stone-900/70 dark:ring-white/10">
      <span className="grid size-9 place-items-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
        <BowlIcon className="size-5" />
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{body}</p>
    </div>
  );
}

/** A static picture of a conversation with the connector, for the hero. */
function ChatMock() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="absolute -inset-4 -z-10 rotate-2 rounded-[2rem] bg-brand-600/10 dark:bg-brand-500/10" />
      <div className="rounded-3xl bg-white p-5 shadow-2xl shadow-stone-900/10 ring-1 ring-stone-900/5 sm:p-6 dark:bg-stone-900 dark:ring-white/10">
        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-stone-100 px-4 py-2.5 text-sm dark:bg-stone-800">
          Something cosy for tonight? Like that dal, but with more heat.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 font-mono text-xs text-brand-800 ring-1 ring-brand-200 dark:bg-brand-950/50 dark:text-brand-300 dark:ring-brand-900">
            <span className="size-1.5 rounded-full bg-emerald-500" /> find_similar
          </span>
        </div>

        <p className="mt-3 text-sm text-stone-700 dark:text-stone-300">
          You have a <strong>Chana Masala</strong> you rated ★★★★★. It is close to the dal and
          spicier. About 40 minutes:
        </p>

        <div className="mt-4 rounded-2xl bg-paper p-4 ring-1 ring-stone-900/5 dark:bg-paper-dark dark:ring-white/10">
          <div className="flex items-center justify-between">
            <KindBadge kind="cook" />
            <span className="flex items-center gap-1 text-xs font-medium text-stone-500">
              <ClockIcon className="size-3.5" /> 40 min
            </span>
          </div>
          <p className="mt-2 font-display text-lg font-semibold">Chana Masala</p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Chickpeas in a tangy, spiced tomato gravy.
          </p>
          <p className="mt-2 text-xs text-stone-500">
            Made 6 times · <span className="text-amber-500">★ 4.8</span>
          </p>
        </div>

        <div className="mt-4 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-stone-100 px-4 py-2.5 text-sm dark:bg-stone-800">
          Perfect. Log it for tonight, 5 stars.
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 font-mono text-xs text-brand-800 ring-1 ring-brand-200 dark:bg-brand-950/50 dark:text-brand-300 dark:ring-brand-900">
            <span className="size-1.5 rounded-full bg-emerald-500" /> log_cook
          </span>
        </div>
      </div>
    </div>
  );
}
