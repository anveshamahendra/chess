import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!(await userRateLimit(user.id, "resign", 20, 60_000))) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const db = createAdminClient() || supabase;

  const { data: game } = await db.from("games").select("*").eq("id", params.id).maybeSingle();
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status !== "active") return NextResponse.json({ error: "Game not active" }, { status: 400 });

  const isWhite = game.white_player_id === user.id;
  const isBlack = game.black_player_id === user.id;
  if (!isWhite && !isBlack) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  const result = isWhite ? "0-1" : "1-0";

  const { data: updated, error } = await db
    .from("games")
    .update({
      status: "completed",
      result,
      result_reason: "resignation",
      ended_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (game.is_rated) {
    const whiteScore = result === "1-0" ? 1 : 0;
    const blackScore = 1 - whiteScore;
    await db.rpc("apply_elo_update", {
      p_game_id: params.id,
      p_white_score: whiteScore,
      p_black_score: blackScore,
    });
  }

  return NextResponse.json({ game: updated });
}
