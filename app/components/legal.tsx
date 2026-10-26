import type { ReactNode } from "react";
import { Link } from "react-router";

import { Alert, LegalLinks, Logo, Ornament } from "~/components/ui";
import type { Operator } from "~/lib/imprint";

/** Long-form legal text, set like the back matter of a book. */
export function LegalPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-5 pb-16 sm:px-8">
      <header className="flex items-baseline justify-between gap-4 border-b border-rule py-4">
        <Link to="/" aria-label="Recipes">
          <Logo />
        </Link>
        <Link to="/" className="text-muted smallcaps hover:text-red">
          ← Back
        </Link>
      </header>
      <main>
        <div className="pt-14 pb-4 text-center">
          <p className="text-muted smallcaps">{eyebrow}</p>
          <h1 className="mt-3 display text-5xl sm:text-6xl">{title}</h1>
          <Ornament className="mx-auto mt-8 max-w-[10rem]" />
        </div>
        <div className="legal text-[1.15rem] leading-relaxed">{children}</div>
      </main>
      <footer className="mt-16 rule-double pt-6">
        <LegalLinks />
      </footer>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="border-b border-rule pb-1 text-[1.1rem] font-semibold text-red smallcaps">{title}</h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** The operator's name, address and email, or a visible gap if unset. */
export function OperatorAddress({ operator }: { operator: Operator | null }) {
  if (!operator) {
    return <Alert>The operator’s details have not been configured (the IMPRINT setting).</Alert>;
  }
  return (
    <address className="not-italic">
      <span className="block">{operator.name}</span>
      {operator.address.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
      {operator.email ? (
        <span className="mt-2 block">
          Email:{" "}
          <a href={`mailto:${operator.email}`} className="text-red underline underline-offset-[3px]">
            {operator.email}
          </a>
        </span>
      ) : null}
    </address>
  );
}
