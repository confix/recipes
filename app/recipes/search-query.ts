/**
 * Turns free text into an FTS5 MATCH expression. Every term is reduced to
 * letters and digits and quoted, so user input can never inject FTS syntax
 * (column filters, NEAR, unbalanced quotes). Each term is a prefix match:
 * "tomat" finds "tomato" and "tomatoes".
 *
 * `all` requires every term (FTS5's implicit AND); `any` is the fallback when
 * that finds nothing.
 */
export function ftsQuery(
  input: string,
  mode: "all" | "any" = "all",
): string | null {
  const terms = input.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (terms.length === 0) return null;
  const unique = [...new Set(terms)].slice(0, 16);
  return unique.map((t) => `"${t}"*`).join(mode === "all" ? " " : " OR ");
}
