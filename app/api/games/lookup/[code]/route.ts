import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Same alphabet as generateRoomCode() in ../route.ts.
const ROOM_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const code = params.code.trim().toUpperCase();
  if (!ROOM_CODE_RE.test(code)) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const db = createAdminClient() || supabase;

  const { data: game, error } = await db
    .from("games")
    .select("id, status, white_player_id, black_player_id")
    .eq("room_code", code)
    .maybeSingle();

  if (error || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const isParticipant =
    !!user && (game.white_player_id === user.id || game.black_player_id === user.id);

  // Only expose what the pre-join waiting room needs; never player UUIDs.
  return NextResponse.json({
    id: game.id,
    status: game.status,
    isParticipant,
  });
}
