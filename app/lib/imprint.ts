/**
 * The site operator, from the IMPRINT secret: name on the first line, then
 * the postal address, and a contact email on any line. It is a secret rather
 * than code so a private person's address stays out of the repository.
 * Lines may be real newlines or a literal "\n" (handy in .dev.vars).
 */
export interface Operator {
  name: string;
  address: string[];
  email: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseImprint(value: string | undefined): Operator | null {
  const lines = (value ?? "")
    .split(/\r?\n|\\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const [name, ...rest] = lines;
  return {
    name,
    address: rest.filter((line) => !EMAIL.test(line)),
    email: rest.find((line) => EMAIL.test(line)) ?? null,
  };
}
