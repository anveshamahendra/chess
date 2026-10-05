import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await userRateLimit(user.id, "join", 10, 60_000))) {
    return NextResponse.json(
      { error: "You're joining games too quickly." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const db = createAdminClient() || supabase;

  const { data: game, error: fetchError } = await db
    .from("games")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (game.status !== "waiting") {
    return NextResponse.json({ error: "Game already started" }, { status: 400 });
  }

  if (game.white_player_id === user.id) {
    return NextResponse.json({ error: "Cannot join your own game" }, { status: 400 });
  }

  const { data, error } = await db
    .from("games")
    .update({
      black_player_id: user.id,
      status: "active",
      started_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("status", "waiting")
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    // 0 rows: the status check lost a race — someone else joined first.
    return NextResponse.json({ error: "Game already started" }, { status: 400 });
  }

  // The waiting room only needs enough to render the board header; don't hand
  // back the whole row (pgn, opponent UUIDs, clocks) to a just-joined stranger.
  const { id, room_code, status, started_at, time_control_minutes, time_control_increment } = data;
  return NextResponse.json({
    game: {
      id,
      room_code,
      status,
      started_at,
      time_control_minutes,
      time_control_increment,
      isParticipant: true,
    },
  });
}
