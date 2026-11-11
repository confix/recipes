import { Link } from "react-router";

import { LegalPage, OperatorAddress, Section } from "~/components/legal";
import { translate, useT } from "~/lib/i18n";
import type { Operator } from "~/lib/imprint";
import { getOperator } from "~/lib/operator.server";
import { rootData, seo } from "~/lib/seo";

import type { Route } from "./+types/privacy";

export function meta({ matches }: Route.MetaArgs) {
  return seo({
    matches,
    title: translate(rootData(matches).locale, "privacy.title"),
    path: "/privacy",
    alternates: true,
  });
}

export function loader() {
  return { operator: getOperator() };
}

/**
 * Keep this in step with what the app actually stores: the better-auth
 * tables, API tokens and share links (app/db/schema), recipes in R2 + D1,
 * embeddings via Workers AI + Vectorize, OAuth grants in KV, and the two
 * cookies (session, language). No analytics, no third-party requests (fonts
 * are bundled).
 *
 * Written out per language rather than through the UI dictionary: it is
 * structured prose. Change both versions together.
 */
export default function Privacy({ loaderData: { operator } }: Route.ComponentProps) {
  const { t, locale } = useT();
  return (
    <LegalPage eyebrow={t("privacy.eyebrow")} title={t("privacy.title")}>
      {locale === "de" ? <PrivacyDe operator={operator} /> : <PrivacyEn operator={operator} />}
    </LegalPage>
  );
}

const link = "text-red underline underline-offset-[3px]";

function PrivacyEn({ operator }: { operator: Operator | null }) {
  return (
    <>
      <p className="mt-8 text-center text-muted italic">As of 11 November 2026</p>

      <Section title="In short">
        <p>
          Recipes stores the account and recipes you give it so that you, and the apps you
          connect, can use them. There is no advertising, no analytics and no tracking. Everything
          runs on Cloudflare, and nothing is sold or passed on to anyone else. A recipe is only
          ever seen by others if you share it by link.
        </p>
      </Section>

      <Section title="Who is responsible">
        <p>The controller within the meaning of the GDPR is:</p>
        <OperatorAddress operator={operator} />
      </Section>

      <Section title="Hosting and access logs">
        <p>
          The site runs on Cloudflare (Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107,
          USA) as our processor. To deliver each page and protect the service from abuse,
          Cloudflare processes your IP address, the time, the address requested and your browser’s
          user agent. Recipes itself keeps no access logs.
        </p>
        <p>
          Cloudflare may process data in the USA. It is certified under the EU–U.S. Data Privacy
          Framework, and its data processing agreement includes the EU standard contractual
          clauses. Legal basis: Art. 6 (1) (f) GDPR. Our legitimate interest is running the site
          securely.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          To create an account we store your name, your email address, and your password as a
          one-way hash, never in plain text. Sign-up is limited to invited email addresses. Legal
          basis: Art. 6 (1) (b) GDPR, as this is needed to provide the service you signed up for.
        </p>
      </Section>

      <Section title="Cookies and sessions">
        <p>
          When you sign in, we set a session cookie. Alongside the session we store the IP address
          and browser user agent it was started from, so sessions can be recognised and ended. A
          session ends when you sign out, or after seven days without use.
        </p>
        <p>
          When you connect an app, a short-lived cookie ties the approval form to your browser, to
          prevent forged approvals.
        </p>
        <p>
          If you pick a language at the foot of a page, a cookie named <code>lang</code>{" "}
          remembers it for a year. It holds only the language code.
        </p>
        <p>
          These cookies are strictly necessary for a service you asked for, so they need no
          consent (§ 25 (2) no. 2 TDDDG). There are no other cookies.
        </p>
      </Section>

      <Section title="Your recipes">
        <p>
          Recipes you save, including tags, notes, and the dates and ratings in your cooking log,
          are stored in Cloudflare’s storage and database services. To make search by meaning
          work, each recipe’s text is sent to Cloudflare Workers AI, which turns it into a numeric
          fingerprint (an embedding). That fingerprint is stored in Cloudflare Vectorize. All of
          this happens at Cloudflare, as our processor. Legal basis: Art. 6 (1) (b) GDPR.
        </p>
      </Section>

      <Section title="Sharing a recipe by link">
        <p>
          You can create a link to a recipe. Anyone who has the link can read that recipe
          (title, description, ingredients, method and source) without an account, and anyone with
          an account can save their own copy of it. Your name, your email address and your cooking
          log are never shown. Shared pages ask search engines not to index them, but whoever has
          the link can pass it on.
        </p>
        <p>
          We store the link, which recipe it belongs to, and when it was created and switched off.
          You can switch a link off at any time; deleting the recipe switches it off too. Copies
          that others have already saved belong to their accounts. Legal basis: Art. 6 (1) (b)
          GDPR, as sharing is a feature you choose to use.
        </p>
      </Section>

      <Section title="Connected apps and API tokens">
        <p>
          When you connect an app such as Claude over MCP, we store the authorisation: the app’s
          name, your account and access tokens (as hashes). The app then receives the recipes you
          ask it to work with. What it does with them is governed by that app provider’s own
          privacy policy. You decide which apps to connect.
        </p>
        <p>
          Personal API tokens are stored as hashes, along with the name you give them and when
          they were created and last used. You can revoke them at any time.
        </p>
      </Section>

      <Section title="No third parties in your browser">
        <p>
          Fonts are served from this site, not from a font service. Pages load no scripts, images
          or other content from anyone else. “Keep screen on” uses a feature built into your
          browser and sends nothing to us.
        </p>
      </Section>

      <Section title="How long we keep data">
        <p>
          Account data and recipes are kept for as long as your account exists. A recipe you
          delete is removed with its search entry, and its share links stop working. To delete
          your account and everything in it, email the address above.
        </p>
      </Section>

      <Section title="Your rights">
        <p>Under the GDPR you have the right to:</p>
        <ul className="list-disc pl-6">
          <li>access your data (Art. 15)</li>
          <li>have it corrected (Art. 16)</li>
          <li>have it erased (Art. 17)</li>
          <li>restrict its processing (Art. 18)</li>
          <li>receive it in a portable form (Art. 20)</li>
          <li>object to processing based on legitimate interests (Art. 21)</li>
        </ul>
        <p>
          Your recipes are plain markdown, and you can export them at any time through the{" "}
          <Link to="/#mcp" className={link}>
            API or a connected app
          </Link>
          . You may also complain to a data protection supervisory authority (Art. 77 GDPR).
        </p>
        <p>
          You do not have to provide any data, but an account is needed to use the service. There
          is no automated decision-making or profiling.
        </p>
      </Section>
    </>
  );
}

function PrivacyDe({ operator }: { operator: Operator | null }) {
  return (
    <>
      <p className="mt-8 text-center text-muted italic">Stand: 11. November 2026</p>

      <Section title="Kurz gesagt">
        <p>
          Recipes speichert das Konto und die Rezepte, die du ihm gibst, damit du und die Apps, die
          du verbindest, sie nutzen können. Es gibt keine Werbung, keine Analyse und kein Tracking.
          Alles läuft bei Cloudflare, und nichts wird verkauft oder an andere weitergegeben. Andere
          sehen ein Rezept nur, wenn du es per Link teilst.
        </p>
      </Section>

      <Section title="Verantwortlicher">
        <p>Verantwortlich im Sinne der DSGVO ist:</p>
        <OperatorAddress operator={operator} />
      </Section>

      <Section title="Hosting und Zugriffsprotokolle">
        <p>
          Die Website läuft bei Cloudflare (Cloudflare, Inc., 101 Townsend St, San Francisco, CA
          94107, USA) als unserem Auftragsverarbeiter. Um jede Seite auszuliefern und den Dienst vor
          Missbrauch zu schützen, verarbeitet Cloudflare deine IP-Adresse, den Zeitpunkt, die
          aufgerufene Adresse und die Kennung deines Browsers. Recipes selbst führt keine
          Zugriffsprotokolle.
        </p>
        <p>
          Cloudflare kann Daten in den USA verarbeiten. Cloudflare ist unter dem EU-U.S. Data
          Privacy Framework zertifiziert, und der Auftragsverarbeitungsvertrag enthält die
          Standardvertragsklauseln der EU. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Unser
          berechtigtes Interesse ist der sichere Betrieb der Website.
        </p>
      </Section>

      <Section title="Dein Konto">
        <p>
          Für ein Konto speichern wir deinen Namen, deine E-Mail-Adresse und dein Passwort als
          Einweg-Hash, niemals im Klartext. Registrieren können sich nur eingeladene
          E-Mail-Adressen. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO, da dies für den Dienst nötig
          ist, für den du dich angemeldet hast.
        </p>
      </Section>

      <Section title="Cookies und Sitzungen">
        <p>
          Wenn du dich anmeldest, setzen wir ein Sitzungs-Cookie. Zur Sitzung speichern wir die
          IP-Adresse und Browser-Kennung, mit der sie begonnen wurde, damit Sitzungen erkannt und
          beendet werden können. Eine Sitzung endet, wenn du dich abmeldest, oder nach sieben Tagen
          ohne Nutzung.
        </p>
        <p>
          Wenn du eine App verbindest, verknüpft ein kurzlebiges Cookie das Freigabeformular mit
          deinem Browser, um gefälschte Freigaben zu verhindern.
        </p>
        <p>
          Wählst du unten auf einer Seite eine Sprache, merkt sich ein Cookie namens{" "}
          <code>lang</code> diese Wahl für ein Jahr. Es enthält nur den Sprachcode.
        </p>
        <p>
          Diese Cookies sind für einen von dir gewünschten Dienst unbedingt erforderlich und
          brauchen daher keine Einwilligung (§ 25 Abs. 2 Nr. 2 TDDDG). Weitere Cookies gibt es
          nicht.
        </p>
      </Section>

      <Section title="Deine Rezepte">
        <p>
          Rezepte, die du speicherst, samt Schlagwörtern, Notizen und den Daten und Bewertungen in
          deinem Kochtagebuch, liegen in den Speicher- und Datenbankdiensten von Cloudflare. Damit
          die Suche nach Bedeutung funktioniert, wird der Text jedes Rezepts an Cloudflare Workers
          AI geschickt, das daraus einen numerischen Fingerabdruck (ein Embedding) berechnet. Dieser
          wird in Cloudflare Vectorize gespeichert. All das geschieht bei Cloudflare als unserem
          Auftragsverarbeiter. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
        </p>
      </Section>

      <Section title="Rezepte per Link teilen">
        <p>
          Du kannst einen Link zu einem Rezept erstellen. Wer den Link hat, kann dieses Rezept
          (Titel, Beschreibung, Zutaten, Zubereitung und Quelle) ohne Konto lesen, und wer ein Konto
          hat, kann eine eigene Kopie davon speichern. Dein Name, deine E-Mail-Adresse und dein
          Kochtagebuch werden nie angezeigt. Geteilte Seiten bitten Suchmaschinen, sie nicht zu
          indexieren; wer den Link hat, kann ihn aber weitergeben.
        </p>
        <p>
          Wir speichern den Link, zu welchem Rezept er gehört und wann er erstellt und abgeschaltet
          wurde. Du kannst einen Link jederzeit abschalten; auch das Löschen des Rezepts schaltet
          ihn ab. Kopien, die andere schon gespeichert haben, gehören zu deren Konten.
          Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO, da Teilen eine Funktion ist, die du bewusst
          nutzt.
        </p>
      </Section>

      <Section title="Verbundene Apps und API-Tokens">
        <p>
          Wenn du eine App wie Claude über MCP verbindest, speichern wir die Freigabe: den Namen der
          App, dein Konto und die Zugriffstokens (als Hashes). Die App erhält dann die Rezepte, mit
          denen sie für dich arbeiten soll. Was sie damit tut, regelt die Datenschutzerklärung ihres
          Anbieters. Du entscheidest, welche Apps du verbindest.
        </p>
        <p>
          Persönliche API-Tokens speichern wir als Hashes, zusammen mit dem Namen, den du ihnen
          gibst, und wann sie erstellt und zuletzt benutzt wurden. Du kannst sie jederzeit
          widerrufen.
        </p>
      </Section>

      <Section title="Keine Dritten in deinem Browser">
        <p>
          Schriften kommen von dieser Website, nicht von einem Schriftendienst. Die Seiten laden
          keine Skripte, Bilder oder anderen Inhalte von anderen. „Bildschirm wach halten“ nutzt eine
          eingebaute Funktion deines Browsers und schickt uns nichts.
        </p>
      </Section>

      <Section title="Speicherdauer">
        <p>
          Kontodaten und Rezepte bleiben gespeichert, solange dein Konto besteht. Ein gelöschtes
          Rezept wird mit seinem Sucheintrag entfernt, und seine Links zum Teilen funktionieren
          nicht mehr. Um dein Konto mit allem darin zu löschen, schreib an die oben genannte
          E-Mail-Adresse.
        </p>
      </Section>

      <Section title="Deine Rechte">
        <p>Nach der DSGVO hast du das Recht auf:</p>
        <ul className="list-disc pl-6">
          <li>Auskunft über deine Daten (Art. 15)</li>
          <li>Berichtigung (Art. 16)</li>
          <li>Löschung (Art. 17)</li>
          <li>Einschränkung der Verarbeitung (Art. 18)</li>
          <li>Datenübertragbarkeit (Art. 20)</li>
          <li>Widerspruch gegen Verarbeitung auf Grundlage berechtigter Interessen (Art. 21)</li>
        </ul>
        <p>
          Deine Rezepte sind schlichtes Markdown, und du kannst sie jederzeit über die{" "}
          <Link to="/#mcp" className={link}>
            API oder eine verbundene App
          </Link>{" "}
          exportieren. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren
          (Art. 77 DSGVO).
        </p>
        <p>
          Du musst keine Daten angeben, aber ohne Konto lässt sich der Dienst nicht nutzen. Es gibt
          keine automatisierte Entscheidungsfindung und kein Profiling.
        </p>
      </Section>
    </>
  );
}
