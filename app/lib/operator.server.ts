import { env } from "cloudflare:workers";

import { parseImprint } from "~/lib/imprint";

/** The site operator for the imprint and privacy policy; see app/lib/imprint.ts. */
export function getOperator() {
  const operator = parseImprint(env.IMPRINT);
  if (!operator) console.error("IMPRINT is not set: the imprint has no operator.");
  return operator;
}
