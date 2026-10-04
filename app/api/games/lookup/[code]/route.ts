import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, callerIp } from "@/lib/rateLimit";

// Same alphabet as generateRoomCode() in ../route.ts.
const ROOM_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const code = params.code.trim().toUpperCase();
  if (!ROOM_CODE_RE.test(code)) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // Room codes are a 32^6 space, so this endpoint is an existence oracle.
  // Without a cap it is trivially enumerable.
  if (!rateLimit(`room-lookup:${callerIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts, try again shortly." }, { status: 429 });
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

  // Only expose what the pre-join waiting room needs. The game id is a
  // capability for POST /api/games/:id/join, so signed-out visitors get the
  // status (to render the invite screen) but never the id.
  return NextResponse.json({
    ...(user ? { id: game.id } : {}),
    status: game.status,
    isParticipant,
  });
}
