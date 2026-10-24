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

/** A link to `path` that keeps `next`, e.g. when moving between /login and /signup. */
export function withNext(path: string, next: string): string {
  return next && next !== "/" ? `${path}?next=${encodeURIComponent(next)}` : path;
}
