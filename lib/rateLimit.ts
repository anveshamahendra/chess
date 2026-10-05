// Rate limiting for API routes and middleware.
//
// Two backends:
//   1. Upstash Redis (sliding window) — shared across serverless instances, so
//      it actually holds under a distributed flood. Used when
//      UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
//   2. In-memory sliding window — per-instance fallback for local dev and for
//      deployments that haven't configured Redis yet.
//
// Redis errors fail *open* (allow the request, log the error): a Redis blip
// should not take the site down. The cost of that choice is that an attacker
// who can knock out the Upstash endpoint also removes the limits — which is
// why an edge-level layer (Cloudflare / Vercel WAF) is still worth having.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Bucket = { windowMs: number; hits: number[] };

const memoryBuckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 30_000) return;
  lastSweep = now;
  for (const [key, bucket] of memoryBuckets) {
    const newest = bucket.hits[bucket.hits.length - 1] ?? 0;
    if (now - newest > bucket.windowMs) memoryBuckets.delete(key);
  }
}

/** In-memory sliding window. Returns false when the caller is over the limit. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);

  let bucket = memoryBuckets.get(key);
  if (!bucket) {
    bucket = { windowMs, hits: [] };
    memoryBuckets.set(key, bucket);
  }

  bucket.windowMs = windowMs;
  bucket.hits = bucket.hits.filter((hit) => now - hit < windowMs);

  if (bucket.hits.length >= limit) return false;
  bucket.hits.push(now);
  return true;
}

// --- Redis backend -----------------------------------------------------------

// A Ratelimit instance is bound to one (limit, window) policy, so we cache one
// per distinct policy instead of building a new client per request.
const limiters = new Map<string, Ratelimit | null>();
let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redisClient = url && token ? new Redis({ url, token }) : null;
  return redisClient;
}

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  const policy = `${limit}/${windowMs}`;
  if (limiters.has(policy)) return limiters.get(policy)!;

  const redis = getRedis();
  const limiter = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
        // No analytics: keeps it to one Redis round trip per check.
        analytics: false,
      })
    : null;
  limiters.set(policy, limiter);
  return limiter;
}

async function check(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const limiter = getLimiter(limit, windowMs);
  if (!limiter) return rateLimit(key, limit, windowMs);

  try {
    const res = await limiter.limit(key);
    return res.success;
  } catch (err) {
    console.error("rateLimit: Redis check failed, allowing request", err);
    return true;
  }
}

/** Per-caller IP limit. Used by middleware and the room-code lookup route. */
export function ipRateLimit(
  req: Request,
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  return check(`ip:${callerIp(req)}:${key}`, limit, windowMs);
}

/** Per-authenticated-user limit. */
export function userRateLimit(
  userId: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  return check(`user:${userId}:${key}`, limit, windowMs);
}

/**
 * Best-effort caller identity.
 *
 * Prefers NextRequest.ip (populated by Vercel at the edge). Falls back to the
 * *rightmost* x-forwarded-for entry: with a single trusted proxy that is the
 * value the proxy appended, whereas the leftmost entry is client-supplied and
 * trivially spoofable.
 */
export function callerIp(req: Request): string {
  const nextReq = req as Request & { ip?: string };
  if (nextReq.ip) return nextReq.ip;

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const entries = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (entries.length > 0) return entries[entries.length - 1];
  }

  return req.headers.get("x-real-ip") ?? "unknown";
}
