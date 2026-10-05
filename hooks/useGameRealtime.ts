"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface GameRow {
  id: string;
  room_code: string;
  white_player_id: string | null;
  black_player_id: string | null;
  status: string;
  fen_current: string;
  pgn: string;
  white_time_remaining_ms: number;
  black_time_remaining_ms: number;
  result: string | null;
  result_reason: string | null;
  is_rated: boolean;
  time_control_minutes: number;
  time_control_increment: number;
  draw_offered_by: string | null;
  started_at: string | null;
}

export interface MoveRow {
  id: string;
  game_id: string;
  move_number: number;
  player_color: string;
  san: string;
  fen_after: string;
  from_square: string;
  to_square: string;
  time_taken_ms: number | null;
  created_at: string;
}

export function useGameRealtime(gameId: string) {
  const [game, setGame] = useState<GameRow | null>(null);
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [loadedGameId, setLoadedGameId] = useState<string | null>(null);
  const supabase = createClient();

  const fetchInitial = useCallback(async () => {
    if (!gameId) {
      setGame(null);
      setMoves([]);
      setLoadedGameId(null);
      return;
    }
    const { data: gameData } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .maybeSingle();
    setGame(gameData as GameRow);

    const { data: movesData } = await supabase
      .from("moves")
      .select("*")
      .eq("game_id", gameId)
      .order("move_number", { ascending: true });
    setMoves((movesData as MoveRow[]) || []);
    setLoadedGameId(gameId);
  }, [gameId, supabase]);

  useEffect(() => {
    if (!gameId) return;
    fetchInitial();
  }, [gameId, fetchInitial]);

  // Only subscribe once the initial read succeeded: RLS only lets
  // participants read the game, so a null result means subscribing would be
  // pointless — and after joining we want a channel authorized as a
  // participant.
  const canSubscribe = !!game && game.id === gameId;

  useEffect(() => {
    if (!gameId || !canSubscribe) return;

    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => setGame(payload.new as GameRow)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "moves", filter: `game_id=eq.${gameId}` },
        (payload) => setMoves((prev) => [...prev, payload.new as MoveRow])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, canSubscribe, supabase]);

  // Derived synchronously so a gameId change never presents stale data as
  // loaded (no flash of the wrong screen between renders).
  const loading = gameId !== "" && loadedGameId !== gameId;

  return { game, moves, loading, refetch: fetchInitial };
}
