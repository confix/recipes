import { LegalPage, OperatorAddress, Section } from "~/components/legal";
import { translate, useT } from "~/lib/i18n";
import { OPERATOR } from "~/lib/operator";
import { rootData, seo } from "~/lib/seo";

import type { Route } from "./+types/imprint";

export function meta({ matches }: Route.MetaArgs) {
  return seo({
    matches,
    title: translate(rootData(matches).locale, "imprint.title"),
    path: "/imprint",
    alternates: true,
  });
}

export default function Imprint() {
  const { t, rich } = useT();
  return (
    <LegalPage eyebrow={t("imprint.eyebrow")} title={t("imprint.title")}>
      <Section title={t("imprint.info")}>
        <OperatorAddress />
        <p className="text-muted italic">{t("imprint.private")}</p>
        <p className="text-muted italic">
          {rich("imprint.personal", {
            link: (
              <a href="https://quebi.de" className="text-red underline underline-offset-[3px]">
                quebi.de
              </a>
            ),
          })}
        </p>
      </Section>

      <Section title={t("imprint.responsible")}>
        <p>{t("imprint.atAddress", { name: OPERATOR.name })}</p>
      </Section>

      <Section title={t("imprint.recipes")}>
        <p>{t("imprint.recipesText")}</p>
      </Section>
    </LegalPage>
  );
}
