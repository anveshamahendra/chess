"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { NavBar } from "@/components/nav/NavBar";
import { PillButton } from "@/components/ui/PillButton";
import { ChessBoard } from "@/components/board/ChessBoard";
import { EvalBar } from "@/components/board/EvalBar";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { analyzeGame, MoveAnalysis } from "@/lib/chess/analyzeGame";
import { cn } from "@/lib/utils";

interface MoveRow {
  id: string;
  move_number: number;
  player_color: string;
  san: string;
  fen_after: string;
}

interface GameRow {
  id: string;
  white_player_id: string;
  black_player_id: string;
  result: string | null;
  result_reason: string | null;
}

const CLASSIFICATION_COLOR: Record<MoveAnalysis["classification"], string> = {
  best: "#34c77b",
  good: "#5b8def",
  inaccuracy: "#f5a524",
  mistake: "#ec4899",
  blunder: "#ef4444",
};

export default function AnalysisPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { isAuthed, loading: authLoading } = useAuth();

  const [game, setGame] = useState<GameRow | null>(null);
  const [gameLoaded, setGameLoaded] = useState(false);
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [movesLoaded, setMovesLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [names, setNames] = useState<{ white: string; black: string }>({ white: "White", black: "Black" });
  const [cursor, setCursor] = useState(0); // 0 = start position
  const [analysis, setAnalysis] = useState<MoveAnalysis[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    let active = true;
    // RLS only lets participants read the game; null means unknown id or
    // no access.
    setGameLoaded(false);
    setMovesLoaded(false);
    setLoadError(null);

    (async () => {
      try {
        const { data, error } = await supabase
          .from("games")
          .select("id, white_player_id, black_player_id, result, result_reason")
          .eq("id", gameId)
          .maybeSingle();
        if (error) throw error;
        if (active) setGame((data as GameRow) || null);
      } catch {
        if (active) setLoadError("Couldn't load this game. Check your connection and try again.");
      } finally {
        if (active) setGameLoaded(true);
      }
    })();

    (async () => {
      try {
        const { data, error } = await supabase
          .from("moves")
          .select("id, move_number, player_color, san, fen_after")
          .eq("game_id", gameId)
          .order("move_number", { ascending: true });
        if (error) throw error;
        if (active) setMoves((data as MoveRow[]) ?? []);
      } catch {
        if (active) setLoadError("Couldn't load this game's moves. Check your connection and try again.");
      } finally {
        if (active) setMovesLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [gameId, supabase]);

  useEffect(() => {
    if (!game) return;
    async function loadNames() {
      let whiteName = "White";
      let blackName = "Black";
      if (game?.white_player_id) {
        const { data } = await supabase.from("profiles").select("username").eq("id", game.white_player_id).maybeSingle();
        if (data?.username) whiteName = data.username;
      }
      if (game?.black_player_id) {
        const { data } = await supabase.from("profiles").select("username").eq("id", game.black_player_id).maybeSingle();
        if (data?.username) blackName = data.username;
      }
      setNames({ white: whiteName, black: blackName });
    }
    loadNames();
  }, [game, supabase]);

  async function runAnalysis() {
    const controller = new AbortController();
    abortRef.current = controller;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);
    setProgress({ done: 0, total: moves.length });
    try {
      const result = await analyzeGame(
        moves.map((m) => ({ id: m.id, fen_after: m.fen_after })),
        {
          signal: controller.signal,
          onProgress: (done, total) => setProgress({ done, total }),
          onUpdate: (partial) => setAnalysis(partial),
        }
      );
      setAnalysis(result);
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        setAnalysisError(
          "Couldn't run the engine. Make sure a Stockfish WASM build is present at /public/stockfish/stockfish.js."
        );
      }
    } finally {
      setAnalyzing(false);
      setProgress(null);
    }
  }

  const currentFen = cursor === 0 ? "start" : moves[cursor - 1]?.fen_after ?? "start";
  const currentAnalysis = cursor > 0 ? analysis?.[cursor - 1] : null;

  if (!gameLoaded || authLoading) {
    return (
      <div className="min-h-screen bg-page">
        <NavBar />
        <div className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">Loading…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-page">
        <NavBar />
        <div className="px-4 py-10 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">{loadError}</p>
          <PillButton variant="secondary" onClick={() => window.location.reload()}>
            Retry
          </PillButton>
        </div>
      </div>
    );
  }

  if (!game) {
    // RLS returns no row for unknown ids and for games you're not in.
    const signedOut = !isAuthed;
    return (
      <div className="min-h-screen bg-page">
        <NavBar />
        <div className="px-4 py-10 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {signedOut ? "Sign in to view this game." : "This game isn't available to you."}
          </p>
          <PillButton
            variant="secondary"
            onClick={() => router.push(signedOut ? "/sign-in" : "/")}
          >
            {signedOut ? "Sign in" : "Back home"}
          </PillButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <NavBar />
      <div className="px-4 md:px-8 py-8">
        <h1 className="text-3xl font-bold lowercase text-[#0a0a0a] dark:text-[#f5f5f5] mb-1">analysis</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          {names.white} vs {names.black}
          {game?.result ? ` · ${game.result}${game.result_reason ? ` (${game.result_reason})` : ""}` : ""}
        </p>

        <div className="flex flex-col lg:flex-row items-start justify-center gap-6">
          <div className="flex items-stretch gap-3">
            {analysis && (
              <EvalBar evalCp={currentAnalysis?.evalCp ?? 0} mateIn={currentAnalysis?.mateIn ?? null} />
            )}
            <ChessBoard fen={currentFen} onMove={() => {}} interactive={false} />
          </div>

          <div className="w-full max-w-sm flex flex-col gap-3">
            <div className="flex gap-2">
              <PillButton variant="secondary" className="!px-4" onClick={() => setCursor((c) => Math.max(0, c - 1))}>
                ←
              </PillButton>
              <PillButton
                variant="secondary"
                className="!px-4"
                onClick={() => setCursor((c) => Math.min(moves.length, c + 1))}
              >
                →
              </PillButton>
              {(!analysis || analyzing) && (
                <PillButton
                  variant="primary"
                  className="flex-1"
                  onClick={runAnalysis}
                  disabled={analyzing || !movesLoaded || moves.length === 0}
                >
                  {analyzing
                    ? `Analyzing… ${progress?.done ?? 0}/${progress?.total ?? moves.length}`
                    : "Run analysis"}
                </PillButton>
              )}
            </div>

            {movesLoaded && moves.length === 0 && !loadError && (
              <p className="text-[#a3a3a3] text-sm">This game has no moves to analyze.</p>
            )}

            {analysisError && <p className="text-[#ef4444] text-sm">{analysisError}</p>}

            <div className="rounded-2xl bg-card p-4 max-h-80 overflow-y-auto">
              <p className="text-[#a3a3a3] text-sm mb-3">Moves</p>
              <div className="space-y-1">
                {moves.map((m, i) => {
                  const a = analysis?.[i];
                  return (
                    <button
                      key={m.id}
                      onClick={() => setCursor(i + 1)}
                      className={cn(
                        "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-[15px] transition-colors",
                        cursor === i + 1 ? "bg-white/10" : "hover:bg-white/5"
                      )}
                    >
                      <span className="text-white">
                        {m.player_color === "white" ? `${m.move_number}. ` : ""}
                        {m.san}
                      </span>
                      {a && (
                        <span
                          className="text-xs font-medium capitalize"
                          style={{ color: CLASSIFICATION_COLOR[a.classification] }}
                        >
                          {a.classification}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
