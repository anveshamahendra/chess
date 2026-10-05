import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userRateLimit } from "@/lib/rateLimit";

// action: "offer" | "accept" | "decline"
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!(await userRateLimit(user.id, "draw-offer", 20, 60_000))) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const { action } = await req.json();
  const db = createAdminClient() || supabase;

  const { data: game } = await db.from("games").select("*").eq("id", params.id).maybeSingle();
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status !== "active") return NextResponse.json({ error: "Game not active" }, { status: 400 });

  const isWhite = game.white_player_id === user.id;
  const isBlack = game.black_player_id === user.id;
  if (!isWhite && !isBlack) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  if (action === "offer") {
    if (game.draw_offered_by) {
      return NextResponse.json({ error: "A draw offer is already pending" }, { status: 400 });
    }
    const { data: updated, error } = await db
      .from("games")
      .update({ draw_offered_by: user.id })
      .eq("id", params.id)
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ game: updated });
  }

  if (action === "decline") {
    const { data: updated, error } = await db
      .from("games")
      .update({ draw_offered_by: null })
      .eq("id", params.id)
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ game: updated });
  }

  if (action === "accept") {
    if (!game.draw_offered_by || game.draw_offered_by === user.id) {
      return NextResponse.json({ error: "No draw offer to accept" }, { status: 400 });
    }
    const { data: updated, error } = await db
      .from("games")
      .update({
        status: "completed",
        result: "1/2-1/2",
        result_reason: "draw_agreed",
        ended_at: new Date().toISOString(),
        draw_offered_by: null,
      })
      .eq("id", params.id)
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (game.is_rated) {
      await db.rpc("apply_elo_update", { p_game_id: params.id, p_white_score: 0.5, p_black_score: 0.5 });
    }

    return NextResponse.json({ game: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
