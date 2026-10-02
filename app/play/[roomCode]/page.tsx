"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Square } from "chess.js";
import { NavBar } from "@/components/nav/NavBar";
import { PillButton } from "@/components/ui/PillButton";
import { ChessBoard } from "@/components/board/ChessBoard";
import { ClockDisplay } from "@/components/game/ClockDisplay";
import { MoveList } from "@/components/game/MoveList";
import { GameControls } from "@/components/game/GameControls";
import { GameEndModal } from "@/components/game/GameEndModal";
import { DrawOfferBanner } from "@/components/game/DrawOfferBanner";
import { useGameRealtime } from "@/hooks/useGameRealtime";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { playSound } from "@/lib/sounds";

export default function PlayRoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { user, isAuthed, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [gameId, setGameId] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  // Resolve room code -> game id
  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;
    const cleanCode = roomCode.trim().toUpperCase();
    supabase
      .from("games")
      .select("id")
      .eq("room_code", cleanCode)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setLookupError("Game not found. Double check the link.");
          return;
        }
        setGameId(data.id);
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode, supabase]);

  const { game, moves } = useGameRealtime(gameId ?? "");

  useEffect(() => {
    if (game?.status === "completed") setShowEndModal(true);
  }, [game?.status]);

  useEffect(() => {
    if (moves.length === 0) return;
    const last = moves[moves.length - 1];
    playSound(last.san.includes("x") ? "capture" : last.san.includes("+") ? "check" : "move");
  }, [moves.length]);

  const isWhite = game?.white_player_id === user?.id;
  const isBlack = game?.black_player_id === user?.id;
  const isParticipant = isWhite || isBlack;

  async function handleJoin() {
    if (!gameId) return;
    setJoining(true);
    const res = await fetch(`/api/games/${gameId}/join`, { method: "POST" });
    setJoining(false);
    if (!res.ok) {
      const body = await res.json();
      setLookupError(body.error ?? "Could not join game");
    }
  }

  async function handleMove(from: Square, to: Square, promotion?: string) {
    if (!gameId) return;
    await fetch(`/api/games/${gameId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, promotion }),
    });
  }

  async function handleResign() {
    if (!gameId) return;
    await fetch(`/api/games/${gameId}/resign`, { method: "POST" });
  }

  async function handleDrawOffer(action: "offer" | "accept" | "decline") {
    if (!gameId) return;
    await fetch(`/api/games/${gameId}/draw-offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
  }

  if (lookupError) {
    return (
      <div className="min-h-screen bg-[#f2f2f0]">
        <NavBar />
        <div className="px-4 py-10 text-center">
          <p className="text-gray-600 mb-4">{lookupError}</p>
          <PillButton variant="secondary" onClick={() => router.push("/play/new")}>
            Start a new game
          </PillButton>
        </div>
      </div>
    );
  }

  if (!game || authLoading) {
    return (
      <div className="min-h-screen bg-[#f2f2f0]">
        <NavBar />
        <div className="px-4 py-10 text-center text-gray-500">Loading game…</div>
      </div>
    );
  }

  // Waiting room
  if (game.status === "waiting") {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    return (
      <div className="min-h-screen bg-[#f2f2f0]">
        <NavBar />
        <div className="flex justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-[26px] bg-[#0a0a0a] p-8 text-center">
            <h1 className="text-3xl font-bold lowercase text-white mb-2">waiting room</h1>
            {isWhite ? (
              <>
                <p className="text-[#a3a3a3] text-sm mb-6">
                  Share this link with a friend. The game starts as soon as they join.
                </p>
                <div className="rounded-2xl bg-[#121212] px-4 py-3 mb-6 break-all text-white text-sm">
                  {shareUrl}
                </div>
                <PillButton
                  variant="primary"
                  className="w-full"
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                >
                  Copy link
                </PillButton>
              </>
            ) : isAuthed ? (
              <>
                <p className="text-[#a3a3a3] text-sm mb-6">You've been invited to a game.</p>
                <PillButton variant="primary" className="w-full" onClick={handleJoin} disabled={joining}>
                  {joining ? "Joining…" : "Join game"}
                </PillButton>
              </>
            ) : (
              <p className="text-[#a3a3a3] text-sm">Sign in to join this game.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isMyTurn =
    (game.fen_current.includes(" w ") && isWhite) ||
    (game.fen_current.includes(" b ") && isBlack);

  return (
    <div className="min-h-screen bg-[#f2f2f0]">
      <NavBar />
      <div className="flex flex-col lg:flex-row items-start justify-center gap-6 px-4 py-8">
        <div className="flex justify-center w-full lg:w-auto">
          <ChessBoard
            fen={game.fen_current === "start" ? "start" : game.fen_current}
            onMove={handleMove}
            orientation={isBlack ? "black" : "white"}
            interactive={isParticipant && isMyTurn && game.status === "active"}
            lastMove={
              moves.length > 0
                ? {
                    from: moves[moves.length - 1].from_square as Square,
                    to: moves[moves.length - 1].to_square as Square,
                  }
                : null
            }
          />
        </div>

        <div className="w-full max-w-sm flex flex-col gap-3">
          <ClockDisplay
            label="Opponent"
            remainingMs={isWhite ? game.black_time_remaining_ms : game.white_time_remaining_ms}
            isRunning={game.status === "active" && !isMyTurn}
            active={!isMyTurn}
          />
          <MoveList moves={moves} />
          <ClockDisplay
            label="You"
            remainingMs={isWhite ? game.white_time_remaining_ms : game.black_time_remaining_ms}
            isRunning={game.status === "active" && isMyTurn}
            active={isMyTurn}
          />

          {game.draw_offered_by && game.status === "active" && (
            <DrawOfferBanner
              offeredByMe={game.draw_offered_by === user?.id}
              onAccept={() => handleDrawOffer("accept")}
              onDecline={() => handleDrawOffer("decline")}
            />
          )}

          {isParticipant && game.status === "active" && (
            <GameControls
              onResign={handleResign}
              onOfferDraw={() => handleDrawOffer("offer")}
            />
          )}
        </div>
      </div>

      <GameEndModal
        open={showEndModal}
        result={game.result}
        reason={game.result_reason}
        isWhite={isWhite}
        gameId={game.id}
        onClose={() => setShowEndModal(false)}
      />
    </div>
  );
}
