"use client";

import { useEffect, useState } from "react";
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
import { playSound } from "@/lib/sounds";

interface RoomLookup {
  // Absent for signed-out visitors: the API withholds the game id until the
  // caller is authenticated, so it can't be used as a pre-auth join token.
  id?: string;
  status: string;
  isParticipant: boolean;
}

export default function PlayRoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { user, isAuthed, loading: authLoading } = useAuth();
  const router = useRouter();

  const [lookup, setLookup] = useState<RoomLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Transient notice for rejected actions (rate limits, illegal moves, …).
  useEffect(() => {
    if (!actionError) return;
    const timer = setTimeout(() => setActionError(null), 4000);
    return () => clearTimeout(timer);
  }, [actionError]);

  async function reportActionError(res: Response) {
    if (res.status === 429) {
      setActionError("Slow down — try again in a moment.");
      return;
    }
    try {
      const body = await res.json();
      setActionError(body.error ?? "Something went wrong.");
    } catch {
      setActionError("Something went wrong.");
    }
  }

  // Resolve room code -> game id. RLS only lets participants read games, so
  // invitees (who aren't participants yet) resolve the code server-side.
  // Signed-out visitors get the status but no id, so wait for auth to settle
  // and re-run once we know who is asking.
  useEffect(() => {
    if (!roomCode || authLoading) return;
    let cancelled = false;
    const cleanCode = roomCode.trim().toUpperCase();
    fetch(`/api/games/lookup/${encodeURIComponent(cleanCode)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setLookupError("Game not found. Double check the link.");
          return;
        }
        if (!res.ok) {
          setLookupError("Could not load this game. Try again.");
          return;
        }
        setLookup((await res.json()) as RoomLookup);
      })
      .catch(() => {
        if (!cancelled) setLookupError("Could not load this game. Try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode, authLoading, user?.id]);

  const gameId = lookup?.id ?? "";
  const { game, moves, loading: gameLoading, refetch } = useGameRealtime(gameId);

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
    if (!res.ok) {
      setJoining(false);
      const body = await res.json();
      setLookupError(body.error ?? "Could not join game");
      return;
    }
    // We're a participant now — refetch (RLS blocked the read until this
    // point). Keep joining=true so the invite UI can't flash again.
    await refetch();
    setJoining(false);
  }

  async function handleMove(from: Square, to: Square, promotion?: string) {
    if (!gameId) return;
    const res = await fetch(`/api/games/${gameId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, promotion }),
    });
    if (!res.ok) await reportActionError(res);
  }

  async function handleResign() {
    if (!gameId) return;
    const res = await fetch(`/api/games/${gameId}/resign`, { method: "POST" });
    if (!res.ok) await reportActionError(res);
  }

  async function handleDrawOffer(action: "offer" | "accept" | "decline") {
    if (!gameId) return;
    const res = await fetch(`/api/games/${gameId}/draw-offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) await reportActionError(res);
  }

  if (lookupError) {
    return (
      <div className="min-h-screen bg-page">
        <NavBar />
        <div className="px-4 py-10 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">{lookupError}</p>
          <PillButton variant="secondary" onClick={() => router.push("/play/new")}>
            Start a new game
          </PillButton>
        </div>
      </div>
    );
  }

  if (!lookup || gameLoading || authLoading) {
    return (
      <div className="min-h-screen bg-page">
        <NavBar />
        <div className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">Loading game…</div>
      </div>
    );
  }

  // RLS blocks the read: we're not a participant (or the game is gone).
  if (!game) {
    if (lookup.status === "waiting" && !lookup.isParticipant) {
      return (
        <div className="min-h-screen bg-page">
          <NavBar />
          <div className="flex justify-center px-4 py-10">
            <div className="w-full max-w-md rounded-[26px] bg-card p-8 text-center">
              <h1 className="text-3xl font-bold lowercase text-white mb-2">waiting room</h1>
              {isAuthed ? (
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

    return (
      <div className="min-h-screen bg-page">
        <NavBar />
        <div className="px-4 py-10 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {lookup.status === "active" ? "This game already started." : "This game isn't available to you."}
          </p>
          <PillButton variant="secondary" onClick={() => router.push("/play/new")}>
            Start a new game
          </PillButton>
        </div>
      </div>
    );
  }

  // Waiting room
  if (game.status === "waiting") {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    return (
      <div className="min-h-screen bg-page">
        <NavBar />
        <div className="flex justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-[26px] bg-card p-8 text-center">
            <h1 className="text-3xl font-bold lowercase text-white mb-2">waiting room</h1>
            {isWhite ? (
              <>
                <p className="text-[#a3a3a3] text-sm mb-6">
                  Share this link with a friend. The game starts as soon as they join.
                </p>
                <div className="rounded-2xl bg-card-alt px-4 py-3 mb-6 break-all text-white text-sm">
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
            ) : (
              <p className="text-[#a3a3a3] text-sm">Waiting for the game to start…</p>
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
    <div className="min-h-screen bg-page">
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
          {actionError && (
            <div className="rounded-2xl bg-card-alt px-4 py-3 text-center text-sm text-[#a3a3a3]">
              {actionError}
            </div>
          )}
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
