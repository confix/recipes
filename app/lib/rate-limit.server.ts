import { env } from "cloudflare:workers";

/**
 * Per-client limits for the auth forms (AUTH_IP_LIMITER: 10 a minute per
 * scope and IP). Sign-up is open to anyone, so without these the sign-in,
 * reset and delete-account password checks could be guessed at full speed.
 *
 * The form actions call better-auth's API directly, which skips better-auth's
 * own rate limiter, so every action checks here; so does the /api/auth/*
 * route for clients that go to better-auth over HTTP.
 */
export type LimitScope = "sign-in" | "sign-up" | "reset" | "delete-account" | "auth-api";

export async function allowAuthRequest(request: Request, scope: LimitScope): Promise<boolean> {
  // Set by Cloudflare on every request; absent only in odd local setups,
  // where everyone then shares one bucket.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  try {
    return (await env.AUTH_IP_LIMITER.limit({ key: `${scope}:${ip}` })).success;
  } catch (error) {
    // Fail open: a broken limiter must not lock everyone out.
    console.error("Auth rate limiter failed:", error);
    return true;
  }
}
