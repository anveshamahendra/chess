// Minimal in-memory sliding-window rate limiter for API routes.
//
// Keyed per bucket + caller. Suitable for a single Node process (next start,
// `next dev`); on serverless each warm instance keeps its own map, which is
// still enough to blunt room-code brute forcing from one origin.

type Bucket = { windowMs: number; hits: number[] };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 30_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    const newest = bucket.hits[bucket.hits.length - 1] ?? 0;
    if (now - newest > bucket.windowMs) buckets.delete(key);
  }
}

/** Returns false when the caller is over the limit for this window. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { windowMs, hits: [] };
    buckets.set(key, bucket);
  }

  bucket.windowMs = windowMs;
  bucket.hits = bucket.hits.filter((hit) => now - hit < windowMs);

  if (bucket.hits.length >= limit) return false;
  bucket.hits.push(now);
  return true;
}

/** Best-effort caller identity; Vercel populates x-forwarded-for. */
export function callerIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
