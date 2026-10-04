import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[randomInt(chars.length)]).join("");
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = createAdminClient() || supabase;
  const body = await req.json();
  const roomCode = generateRoomCode();

  const { data, error } = await db
    .from("games")
    .insert({
      room_code: roomCode,
      white_player_id: user.id,
      status: "waiting",
      is_rated: body.isRated ?? true,
      time_control_minutes: body.timeControlMinutes ?? 10,
      time_control_increment: body.timeControlIncrement ?? 0,
      white_time_remaining_ms: (body.timeControlMinutes ?? 10) * 60000,
      black_time_remaining_ms: (body.timeControlMinutes ?? 10) * 60000,
    })
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ game: data });
}
