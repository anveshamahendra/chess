import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Chess } from "chess.js";
import { getGameStatus } from "@/lib/chess/engine";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { from, to, promotion } = await req.json();
  const db = createAdminClient() || supabase;

  const { data: game } = await db.from("games").select("*").eq("id", params.id).maybeSingle();
  if (!game || game.status !== "active") {
    return NextResponse.json({ error: "Game not active" }, { status: 400 });
  }

  const isWhite = game.white_player_id === user.id;
  const isBlack = game.black_player_id === user.id;
  if (!isWhite && !isBlack) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  const chess = new Chess(game.fen_current === "start" ? undefined : game.fen_current);
  const turnColor = chess.turn() === "w" ? "white" : "black";
  const playerColor = isWhite ? "white" : "black";
  if (turnColor !== playerColor) {
    return NextResponse.json({ error: "Not your turn" }, { status: 400 });
  }

  // Clock accounting: charge elapsed time since the last move against the mover.
  const now = Date.now();
  const lastMoveAt = game.last_move_at ? new Date(game.last_move_at).getTime() : new Date(game.started_at ?? game.created_at).getTime();
  const elapsedMs = Math.max(0, now - lastMoveAt);
  const incrementMs = (game.time_control_increment ?? 0) * 1000;

  const moverRemainingBefore = isWhite ? game.white_time_remaining_ms : game.black_time_remaining_ms;
  const moverRemainingAfterElapsed = moverRemainingBefore - elapsedMs;

  if (moverRemainingAfterElapsed <= 0) {
    // Timeout loss for the mover, regardless of move legality.
    const result = isWhite ? "0-1" : "1-0";
    const updatePayload = {
      status: "completed",
      result,
      result_reason: "timeout",
      ended_at: new Date().toISOString(),
      ...(isWhite ? { white_time_remaining_ms: 0 } : { black_time_remaining_ms: 0 }),
    };
    const { data: updated } = await db.from("games").update(updatePayload).eq("id", params.id).select().maybeSingle();

    if (game.is_rated) {
      const whiteScore = result === "1-0" ? 1 : 0;
      await db.rpc("apply_elo_update", { p_game_id: params.id, p_white_score: whiteScore, p_black_score: 1 - whiteScore });
    }

    return NextResponse.json({ error: "Time out", game: updated }, { status: 400 });
  }

  let move;
  try {
    move = chess.move({ from, to, promotion });
  } catch {
    return NextResponse.json({ error: "Illegal move" }, { status: 400 });
  }
  if (!move) return NextResponse.json({ error: "Illegal move" }, { status: 400 });

  const { count } = await db
    .from("moves")
    .select("*", { count: "exact", head: true })
    .eq("game_id", params.id);

  await db.from("moves").insert({
    game_id: params.id,
    move_number: (count ?? 0) + 1,
    player_color: playerColor,
    san: move.san,
    from_square: move.from,
    to_square: move.to,
    fen_after: chess.fen(),
    time_taken_ms: elapsedMs,
  });

  const status = getGameStatus(chess);
  const moverRemainingAfter = moverRemainingAfterElapsed + incrementMs;

  const updatePayload: Record<string, unknown> = {
    fen_current: chess.fen(),
    pgn: chess.pgn(),
    last_move_at: new Date(now).toISOString(),
    draw_offered_by: null,
    ...(isWhite ? { white_time_remaining_ms: moverRemainingAfter } : { black_time_remaining_ms: moverRemainingAfter }),
  };

  if (status.over) {
    updatePayload.status = "completed";
    updatePayload.result = status.result;
    updatePayload.result_reason = status.reason;
    updatePayload.ended_at = new Date().toISOString();
  }

  const { data: updated, error } = await db
    .from("games")
    .update(updatePayload)
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status.over && game.is_rated) {
    const whiteScore = status.result === "1-0" ? 1 : status.result === "0-1" ? 0 : 0.5;
    const blackScore = 1 - whiteScore;
    await db.rpc("apply_elo_update", {
      p_game_id: params.id,
      p_white_score: whiteScore,
      p_black_score: blackScore,
    });
  }

  return NextResponse.json({ game: updated, move });
}
