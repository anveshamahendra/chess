"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { NavBar } from "@/components/nav/NavBar";
import { PillButton } from "@/components/ui/PillButton";
import { ChessBoard } from "@/components/board/ChessBoard";
import { EvalBar } from "@/components/board/EvalBar";
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
  const supabase = createClient();

  const [game, setGame] = useState<GameRow | null>(null);
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [names, setNames] = useState<{ white: string; black: string }>({ white: "White", black: "Black" });
  const [cursor, setCursor] = useState(0); // 0 = start position
  const [analysis, setAnalysis] = useState<MoveAnalysis[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("games")
      .select("id, white_player_id, black_player_id, result, result_reason")
      .eq("id", gameId)
      .maybeSingle()
      .then(({ data }) => setGame((data as GameRow) || null));

    supabase
      .from("moves")
      .select("id, move_number, player_color, san, fen_after")
      .eq("game_id", gameId)
      .order("move_number", { ascending: true })
      .then(({ data }) => setMoves((data as MoveRow[]) ?? []));
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
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await analyzeGame(moves.map((m) => ({ id: m.id, fen_after: m.fen_after })));
      setAnalysis(result);
    } catch {
      setAnalysisError(
        "Couldn't run the engine. Make sure a Stockfish WASM build is present at /public/stockfish/stockfish.js."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  const currentFen = cursor === 0 ? "start" : moves[cursor - 1]?.fen_after ?? "start";
  const currentAnalysis = cursor > 0 ? analysis?.[cursor - 1] : null;

  return (
    <div className="min-h-screen bg-[#f2f2f0]">
      <NavBar />
      <div className="px-4 md:px-8 py-8">
        <h1 className="text-3xl font-bold lowercase text-[#0a0a0a] mb-1">analysis</h1>
        <p className="text-gray-500 mb-8">
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
              {!analysis && (
                <PillButton variant="primary" className="flex-1" onClick={runAnalysis} disabled={analyzing || moves.length === 0}>
                  {analyzing ? "Analyzing…" : "Run analysis"}
                </PillButton>
              )}
            </div>

            {analysisError && <p className="text-[#ef4444] text-sm">{analysisError}</p>}

            <div className="rounded-2xl bg-[#0a0a0a] p-4 max-h-80 overflow-y-auto">
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
