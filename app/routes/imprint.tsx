import { LegalPage, OperatorAddress, Section } from "~/components/legal";
import { getOperator } from "~/lib/operator.server";

import type { Route } from "./+types/imprint";

export function meta() {
  return [{ title: "Imprint · Recipes" }];
}

export function loader() {
  return { operator: getOperator() };
}

export default function Imprint({ loaderData: { operator } }: Route.ComponentProps) {
  return (
    <LegalPage eyebrow="Impressum" title="Imprint">
      <Section title="Information pursuant to § 5 DDG">
        <OperatorAddress operator={operator} />
        <p className="text-muted italic">
          Recipes is a private, non-commercial project. Accounts are by invitation only.
        </p>
      </Section>

      <Section title="Responsible for content pursuant to § 18 (2) MStV">
        <p>{operator?.name ?? "The operator named above"}, at the address above.</p>
      </Section>

      <Section title="Your recipes">
        <p>
          Each recipe belongs to the account that saved it and is visible only to that account.
          The operator does not publish or review what users store.
        </p>
      </Section>
    </LegalPage>
  );
}
