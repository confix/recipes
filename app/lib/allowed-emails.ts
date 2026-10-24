/**
 * Who may create an account: the ALLOWED_EMAILS setting, a comma- or
 * whitespace-separated list of addresses. `*` lets anyone sign up. Unset or
 * empty lets no one — sign-up fails closed. Existing accounts are unaffected
 * either way; removing an address does not delete its account.
 */
export function isEmailAllowed(email: string, allowed: string | undefined): boolean {
  const entries = (allowed ?? "")
    .split(/[\s,]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (entries.includes("*")) return true;
  return entries.includes(email.trim().toLowerCase());
}
