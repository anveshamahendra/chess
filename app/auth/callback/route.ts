import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Only same-site paths: reject protocol-relative ("//evil.com") and
// backslash tricks, fall back to the dashboard.
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) {
    return next;
  }
  return "/dashboard";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  // Behind a proxy (nginx / Vercel) the public origin lives in the
  // forwarded headers rather than the request URL.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = forwardedHost ?? url.host;
  const proto = forwardedProto ?? url.protocol.replace(":", "");
  const origin = `${proto}://${host}`;

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: account } = await supabase.rpc("get_my_account");
      const row = Array.isArray(account) ? account[0] : account;
      if (row && row.username_confirmed === false) {
        return NextResponse.redirect(
          `${origin}/onboarding/username?next=${encodeURIComponent(next)}`
        );
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=oauth`);
}
