import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: "Failed to join game. Please verify database RLS update policy." }, { status: 500 });
  }
  return NextResponse.json({ game: data });
}
