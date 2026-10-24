/**
 * Where to send the user after signing in. `next` is user-controlled, so only
 * same-origin targets are allowed, or it is an open redirect. Resolving it as
 * a URL catches what a prefix check misses, such as `/\evil.com`, which
 * browsers treat as `//evil.com`.
 */
export function safeNext(next: string, base: string): string {
  try {
    const target = new URL(next, base);
    if (target.origin === new URL(base).origin) {
      return target.pathname + target.search + target.hash;
    }
  } catch {
    // unparseable: fall through
  }
  return "/";
}
