import { env } from "cloudflare:workers";

import { type Locale, type TKey, translate } from "~/lib/i18n";

/**
 * Account emails, sent through Cloudflare Email Sending (the EMAIL binding).
 * The sender's domain must be onboarded to Email Sending, and the address
 * must match `allowed_sender_addresses` in wrangler.jsonc.
 *
 * Plain text only: every message is a sentence and a link, and text survives
 * every client and spam filter.
 *
 * Mail that can go to an address nobody has confirmed (verify, reset,
 * existing) must carry no text a visitor chose — no {name} — or the sign-up
 * form becomes a way to send anyone a message from our domain.
 */
export const MAIL_FROM = { name: "Recipes", email: "recipes@confix.run" };

const MAILS = {
  verify: { subject: "mail.verify.subject", body: "mail.verify.body" },
  existing: { subject: "mail.existing.subject", body: "mail.existing.body" },
  reset: { subject: "mail.reset.subject", body: "mail.reset.body" },
  deleted: { subject: "mail.deleted.subject", body: "mail.deleted.body" },
} satisfies Record<string, { subject: TKey; body: TKey }>;

export type AccountMail = keyof typeof MAILS;

/**
 * Sends one of the account emails to `to`, at most twice a minute per
 * address (AUTH_EMAIL_LIMITER) so nobody can turn the sign-up or reset forms
 * into a way to flood someone's inbox. Over the limit the message is dropped
 * silently: the forms already answer the same whether or not mail went out.
 *
 * Throws if the send itself fails.
 */
export async function sendAccountMail(
  kind: AccountMail,
  to: { name: string; email: string },
  locale: Locale,
  vars: Record<string, string> = {},
): Promise<void> {
  const address = to.email.trim().toLowerCase();
  if (!(await underMailLimit(address))) {
    console.warn(`Not sending ${kind} mail: rate limited.`);
    return;
  }
  const { subject, body } = MAILS[kind];
  await env.EMAIL.send({
    from: MAIL_FROM,
    to: address,
    subject: translate(locale, subject),
    text: translate(locale, body, { name: to.name || address, ...vars }),
  });
}

async function underMailLimit(address: string): Promise<boolean> {
  try {
    return (await env.AUTH_EMAIL_LIMITER.limit({ key: `mail:${address}` })).success;
  } catch (error) {
    // A broken limiter must not stop sign-up or password resets.
    console.error("Mail rate limiter failed:", error);
    return true;
  }
}
