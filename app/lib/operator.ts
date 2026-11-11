/**
 * The site operator, for the imprint (§ 5 DDG) and the privacy policy. The
 * same details are public on confix.run/imprint; keep the two in step.
 */
export const OPERATOR = {
  name: "Florian Pirchmoser",
  address: ["Geitau 22", "83735 Bayrischzell", "Germany"],
  email: "fp@quebi.de",
} as const;

export type Operator = typeof OPERATOR;
