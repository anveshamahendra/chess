import { NextRequest, NextResponse } from "next/server";
import { ipRateLimit } from "@/lib/rateLimit";

// Per-IP caps for the whole API surface. Generous enough that a real player
// (lookup + join + a move or two) never notices; tight enough that one origin
// can't flood the Node functions or Supabase.
const PER_MINUTE = 120;
const PER_FIVE_MINUTES = 400;

function tooMany(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

export async function middleware(req: NextRequest) {
  if (!(await ipRateLimit(req, "api", PER_MINUTE, 60_000))) {
    return tooMany(60);
  }
  if (!(await ipRateLimit(req, "api-long", PER_FIVE_MINUTES, 300_000))) {
    return tooMany(300);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
