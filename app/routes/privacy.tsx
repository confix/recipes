import { Link } from "react-router";

import { LegalPage, OperatorAddress, Section } from "~/components/legal";
import { getOperator } from "~/lib/operator.server";

import type { Route } from "./+types/privacy";

export function meta() {
  return [{ title: "Privacy policy · Recipes" }];
}

export function loader() {
  return { operator: getOperator() };
}

/**
 * Keep this in step with what the app actually stores: the better-auth
 * tables and API tokens (app/db/schema), recipes in R2 + D1, embeddings via
 * Workers AI + Vectorize, OAuth grants in KV. No analytics, no third-party
 * requests (fonts are bundled).
 */
export default function Privacy({ loaderData: { operator } }: Route.ComponentProps) {
  return (
    <LegalPage eyebrow="Datenschutzerklärung" title="Privacy policy">
      <p className="mt-8 text-center text-muted italic">As of 26 October 2026</p>

      <Section title="In short">
        <p>
          Recipes stores the account and recipes you give it so that you, and the apps you
          connect, can use them. There is no advertising, no analytics and no tracking. Everything
          runs on Cloudflare, and nothing is sold or passed on to anyone else.
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
          Both cookies are strictly necessary for a service you asked for, so they need no
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
          delete is removed with its search entry. To delete your account and everything in it,
          email the address above.
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
          <Link to="/#mcp" className="text-red underline underline-offset-[3px]">
            API or a connected app
          </Link>
          . You may also complain to a data protection supervisory authority (Art. 77 GDPR).
        </p>
        <p>
          You do not have to provide any data, but an account is needed to use the service. There
          is no automated decision-making or profiling.
        </p>
      </Section>
    </LegalPage>
  );
}
