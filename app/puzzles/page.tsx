"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Chess, Square } from "chess.js";
import { motion, AnimatePresence } from "framer-motion";
import { NavBar } from "@/components/nav/NavBar";
import { ChessBoard } from "@/components/board/ChessBoard";
import { PillButton } from "@/components/ui/PillButton";
import {
  BUILTIN_PUZZLES,
  ChessPuzzle,
  uciToMove,
  fetchDailyLichessPuzzle,
} from "@/lib/chess/puzzles";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import {
  Puzzle as PuzzleIcon,
  Flame,
  Award,
  Sparkles,
  HelpCircle,
  Eye,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Globe,
  Filter,
} from "lucide-react";

const STATS_KEY = "chess_puzzle_stats_v1";

interface PuzzleStats {
  rating: number;
  solved: number;
  failed: number;
  streak: number;
  bestStreak: number;
}

const DEFAULT_STATS: PuzzleStats = {
  rating: 1200,
  solved: 0,
  failed: 0,
  streak: 0,
  bestStreak: 0,
};

export default function PuzzlesPage() {
  const [puzzles, setPuzzles] = useState<ChessPuzzle[]>(BUILTIN_PUZZLES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filterTheme, setFilterTheme] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [isLoadingDaily, setIsLoadingDaily] = useState(false);

  // Stats
  const [stats, setStats] = useState<PuzzleStats>(DEFAULT_STATS);

  // Puzzle Play State
  const [chessInstance, setChessInstance] = useState<Chess>(() => new Chess());
  const [fen, setFen] = useState<string>("start");
  const [moveIndex, setMoveIndex] = useState(0); // Index into puzzle.moves (0 = first user move, 1 = computer response, etc.)
  const [status, setStatus] = useState<"in_progress" | "solved" | "failed">("in_progress");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState<number>(0); // 0 = none, 1 = piece hint, 2 = full move
  const [isShowingSolution, setIsShowingSolution] = useState(false);
  const [lastMoveSquares, setLastMoveSquares] = useState<{ from: Square; to: Square } | null>(null);
  const [ratingDiff, setRatingDiff] = useState<number | null>(null);

  const computerTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load stats from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STATS_KEY);
      if (stored) {
        setStats(JSON.parse(stored));
      }
    } catch {
      // Ignore
    }
  }, []);

  const saveStats = (newStats: PuzzleStats) => {
    setStats(newStats);
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(newStats));
    } catch {
      // Ignore
    }
  };

  // Filtered puzzles list
  const filteredPuzzles = useMemo(() => {
    return puzzles.filter((p) => {
      if (filterTheme !== "all" && !p.theme.toLowerCase().includes(filterTheme.toLowerCase())) {
        return false;
      }
      if (filterDifficulty === "beginner" && p.rating > 1000) return false;
      if (filterDifficulty === "intermediate" && (p.rating < 1000 || p.rating > 1500)) return false;
      if (filterDifficulty === "advanced" && p.rating <= 1500) return false;
      return true;
    });
  }, [puzzles, filterTheme, filterDifficulty]);

  const activePuzzle: ChessPuzzle = filteredPuzzles[currentIndex] ?? BUILTIN_PUZZLES[0];

  // Initialize or reset current puzzle position
  const loadPuzzle = useCallback(
    (puzzle: ChessPuzzle) => {
      if (computerTimerRef.current) clearTimeout(computerTimerRef.current);

      const game = new Chess(puzzle.fen);
      setChessInstance(game);
      setFen(game.fen());
      setMoveIndex(0);
      setStatus("in_progress");
      setFeedbackMsg(null);
      setHintLevel(0);
      setIsShowingSolution(false);
      setLastMoveSquares(null);
      setRatingDiff(null);
    },
    []
  );

  useEffect(() => {
    if (activePuzzle) {
      loadPuzzle(activePuzzle);
    }
  }, [activePuzzle, loadPuzzle]);

  // Handle user making a move on the board
  const handleUserMove = (from: Square, to: Square, promotion?: string) => {
    if (status === "solved" || isShowingSolution) return;

    const expectedMoveUci = activePuzzle.moves[moveIndex];
    if (!expectedMoveUci) return;

    const expected = uciToMove(expectedMoveUci);

    // Validate if the move matches the puzzle expected move
    const isCorrect =
      from === expected.from &&
      to === expected.to &&
      (!expected.promotion || promotion === expected.promotion);

    // Try executing move in chess.js
    try {
      const moveResult = chessInstance.move({
        from,
        to,
        promotion: promotion ?? "q",
      });

      if (!moveResult) return;

      const newFen = chessInstance.fen();
      setFen(newFen);
      setLastMoveSquares({ from, to });

      // Play appropriate sound
      if (moveResult.san.includes("#")) {
        playSound("gameEnd");
      } else if (moveResult.san.includes("+")) {
        playSound("check");
      } else if (moveResult.san.includes("x")) {
        playSound("capture");
      } else {
        playSound("move");
      }

      if (isCorrect) {
        const nextIdx = moveIndex + 1;

        // Check if there are more moves (computer response + user continuation)
        if (nextIdx < activePuzzle.moves.length) {
          setMoveIndex(nextIdx);
          setFeedbackMsg("Best move! Opponent responding...");

          // Schedule computer response move
          computerTimerRef.current = setTimeout(() => {
            const replyUci = activePuzzle.moves[nextIdx];
            if (!replyUci) return;

            const reply = uciToMove(replyUci);
            const compMove = chessInstance.move({
              from: reply.from,
              to: reply.to,
              promotion: reply.promotion ?? "q",
            });

            if (compMove) {
              setFen(chessInstance.fen());
              setLastMoveSquares({ from: reply.from, to: reply.to });
              setMoveIndex(nextIdx + 1);
              setFeedbackMsg("Your turn again!");

              if (compMove.san.includes("#")) playSound("gameEnd");
              else if (compMove.san.includes("+")) playSound("check");
              else if (compMove.san.includes("x")) playSound("capture");
              else playSound("move");
            }
          }, 450);
        } else {
          // PUZZLE SOLVED!
          setStatus("solved");
          setFeedbackMsg("Puzzle Solved! Brilliant tactic!");
          playSound("gameEnd");

          // Calculate rating delta
          const isHarder = activePuzzle.rating >= stats.rating;
          const delta = isHarder ? Math.max(12, Math.round((activePuzzle.rating - stats.rating) * 0.08 + 15)) : 10;
          setRatingDiff(delta);

          saveStats({
            rating: stats.rating + delta,
            solved: stats.solved + 1,
            failed: stats.failed,
            streak: stats.streak + 1,
            bestStreak: Math.max(stats.bestStreak, stats.streak + 1),
          });
        }
      } else {
        // INCORRECT MOVE
        setStatus("failed");
        setFeedbackMsg("Incorrect move. Try another approach!");

        if (status !== "failed") {
          const delta = Math.min(-8, Math.round((stats.rating - activePuzzle.rating) * 0.04 - 10));
          setRatingDiff(delta);

          saveStats({
            rating: Math.max(400, stats.rating + delta),
            solved: stats.solved,
            failed: stats.failed + 1,
            streak: 0,
            bestStreak: stats.bestStreak,
          });
        }

        // Revert the wrong move after a brief display so player can try again
        setTimeout(() => {
          chessInstance.undo();
          setFen(chessInstance.fen());
          setLastMoveSquares(null);
        }, 700);
      }
    } catch (e) {
      // Invalid chess move
    }
  };

  const handleNextPuzzle = () => {
    if (currentIndex < filteredPuzzles.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handlePrevPuzzle = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      setCurrentIndex(filteredPuzzles.length - 1);
    }
  };

  const handleResetPuzzle = () => {
    loadPuzzle(activePuzzle);
  };

  const handleShowHint = () => {
    if (hintLevel < 2) {
      setHintLevel((prev) => prev + 1);
    }
  };

  const handlePlaySolution = async () => {
    setIsShowingSolution(true);
    const game = new Chess(activePuzzle.fen);
    setChessInstance(game);
    setFen(game.fen());

    for (let i = 0; i < activePuzzle.moves.length; i++) {
      await new Promise((res) => setTimeout(res, 600));
      const m = uciToMove(activePuzzle.moves[i]);
      const res = game.move({ from: m.from, to: m.to, promotion: m.promotion ?? "q" });
      if (res) {
        setFen(game.fen());
        setLastMoveSquares({ from: m.from, to: m.to });
        if (res.san.includes("#")) playSound("gameEnd");
        else if (res.san.includes("x")) playSound("capture");
        else playSound("move");
      }
    }
    setStatus("failed");
    setFeedbackMsg("Solution revealed. Review the key moves above!");
  };

  const handleLoadDaily = async () => {
    setIsLoadingDaily(true);
    const daily = await fetchDailyLichessPuzzle();
    setIsLoadingDaily(false);
    if (daily) {
      setPuzzles((prev) => [daily, ...prev]);
      setCurrentIndex(0);
      loadPuzzle(daily);
    }
  };

  // Hint calculation
  const currentExpectedMove = activePuzzle?.moves[moveIndex]
    ? uciToMove(activePuzzle.moves[moveIndex])
    : null;

  const hintText = useMemo(() => {
    if (hintLevel === 0 || !currentExpectedMove) return null;
    if (hintLevel === 1) {
      return activePuzzle.hint ?? `Hint: Focus on piece starting at ${currentExpectedMove.from.toUpperCase()}.`;
    }
    return `Move: ${currentExpectedMove.from.toUpperCase()} → ${currentExpectedMove.to.toUpperCase()}`;
  }, [hintLevel, currentExpectedMove, activePuzzle]);

  const uniqueThemes = useMemo(() => {
    const set = new Set<string>();
    BUILTIN_PUZZLES.forEach((p) => set.add(p.theme));
    return Array.from(set);
  }, []);

  return (
    <div className="min-h-screen bg-[#f2f2f0]">
      <NavBar />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header and Stats Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#34c77b]/20 text-[#34c77b]">
                <PuzzleIcon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold lowercase text-[#0a0a0a]">tactical puzzles</h1>
                <p className="text-gray-500 text-sm">
                  Sharpen your tactical vision with curated master challenges.
                </p>
              </div>
            </div>
          </div>

          {/* Player Stats Badges */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#0a0a0a] text-white px-4 py-2.5 rounded-2xl shadow-sm">
              <Award className="h-4 w-4 text-[#f5a524]" />
              <span className="text-xs text-[#a3a3a3]">Rating:</span>
              <span className="text-sm font-bold">{stats.rating}</span>
            </div>

            <div className="flex items-center gap-2 bg-[#0a0a0a] text-white px-4 py-2.5 rounded-2xl shadow-sm">
              <Flame className="h-4 w-4 text-[#ff5722]" />
              <span className="text-xs text-[#a3a3a3]">Streak:</span>
              <span className="text-sm font-bold">{stats.streak}</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-black/5">
              <span className="text-xs text-gray-500">Solved:</span>
              <span className="text-sm font-bold text-gray-800">{stats.solved}</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white rounded-2xl p-3 mb-6 shadow-sm border border-black/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase px-2">
              <Filter className="h-3.5 w-3.5" />
              Filter:
            </div>

            {/* Difficulty Filter */}
            <select
              value={filterDifficulty}
              onChange={(e) => {
                setFilterDifficulty(e.target.value);
                setCurrentIndex(0);
              }}
              className="bg-[#f5f5f4] text-xs font-medium text-gray-800 rounded-xl px-3 py-1.5 border-0 focus:ring-2 focus:ring-black outline-none cursor-pointer"
            >
              <option value="all">All Difficulties</option>
              <option value="beginner">Beginner (&lt;1000)</option>
              <option value="intermediate">Intermediate (1000-1500)</option>
              <option value="advanced">Advanced (&gt;1500)</option>
            </select>

            {/* Theme Filter */}
            <select
              value={filterTheme}
              onChange={(e) => {
                setFilterTheme(e.target.value);
                setCurrentIndex(0);
              }}
              className="bg-[#f5f5f4] text-xs font-medium text-gray-800 rounded-xl px-3 py-1.5 border-0 focus:ring-2 focus:ring-black outline-none cursor-pointer"
            >
              <option value="all">All Tactical Themes</option>
              {uniqueThemes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Daily Puzzle Quick Button */}
          <button
            onClick={handleLoadDaily}
            disabled={isLoadingDaily}
            className="flex items-center gap-1.5 bg-[#0a0a0a] text-white text-xs font-medium px-3 py-1.5 rounded-xl hover:bg-[#222] transition-colors disabled:opacity-50"
          >
            <Globe className="h-3.5 w-3.5 text-[#34c77b]" />
            {isLoadingDaily ? "Fetching..." : "Play Lichess Daily Puzzle"}
          </button>
        </div>

        {/* Main Chess Area */}
        <div className="flex flex-col lg:flex-row items-start justify-center gap-6">
          {/* Chess Board Container */}
          <div className="flex flex-col items-center w-full lg:w-auto">
            {/* Top Indicator */}
            <div className="w-full max-w-[560px] flex items-center justify-between bg-[#0a0a0a] rounded-2xl px-4 py-3 mb-3 text-white">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold">{activePuzzle.title}</span>
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-md font-mono text-[#34c77b]">
                  {activePuzzle.rating} elo
                </span>
                <span className="text-xs bg-white/5 text-[#a3a3a3] px-2 py-0.5 rounded-md">
                  {activePuzzle.theme}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#a3a3a3]">
                  {activePuzzle.playerColor === "white" ? "⚪ White to move" : "⚫ Black to move"}
                </span>
              </div>
            </div>

            {/* Chessboard Component */}
            <ChessBoard
              fen={fen}
              onMove={handleUserMove}
              orientation={activePuzzle.playerColor}
              interactive={status !== "solved" && !isShowingSolution}
              lastMove={lastMoveSquares}
            />

            {/* Dynamic Status / Feedback Message */}
            <AnimatePresence mode="wait">
              {feedbackMsg && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={cn(
                    "w-full max-w-[560px] mt-3 px-4 py-2.5 rounded-2xl text-sm font-medium flex items-center justify-between",
                    status === "solved"
                      ? "bg-[#22c55e]/15 text-[#16a34a] border border-[#22c55e]/30"
                      : status === "failed"
                      ? "bg-[#ef4444]/15 text-[#dc2626] border border-[#ef4444]/30"
                      : "bg-[#0a0a0a] text-white"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {status === "solved" ? (
                      <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />
                    ) : status === "failed" ? (
                      <XCircle className="h-4 w-4 text-[#ef4444]" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-[#f5a524]" />
                    )}
                    <span>{feedbackMsg}</span>
                  </div>

                  {ratingDiff !== null && (
                    <span
                      className={cn(
                        "text-xs font-bold font-mono px-2 py-0.5 rounded-md",
                        ratingDiff > 0 ? "bg-[#22c55e]/20 text-[#15803d]" : "bg-[#ef4444]/20 text-[#b91c1c]"
                      )}
                    >
                      {ratingDiff > 0 ? `+${ratingDiff}` : `${ratingDiff}`}
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Action & Explanation Panel */}
          <div className="w-full max-w-sm flex flex-col gap-4">
            {/* Puzzle Details Card */}
            <div className="bg-[#0a0a0a] rounded-[26px] p-6 text-white shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-wider text-[#a3a3a3] font-semibold">
                  Puzzle #{currentIndex + 1} of {filteredPuzzles.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevPuzzle}
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"
                    title="Previous puzzle"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleNextPuzzle}
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"
                    title="Next puzzle"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <h2 className="text-xl font-bold mb-1">{activePuzzle.title}</h2>
              <p className="text-sm text-[#a3a3a3] mb-4">{activePuzzle.description}</p>

              {/* Hint Display */}
              {hintText && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-[#1f1a10] border border-[#f5a524]/30 rounded-2xl p-3.5 mb-4 text-[#f5a524] text-xs flex items-start gap-2.5"
                >
                  <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{hintText}</span>
                </motion.div>
              )}

              {/* Explanation upon Solve or Solution */}
              {(status === "solved" || isShowingSolution) && activePuzzle.explanation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-3.5 mb-4 text-xs text-gray-300"
                >
                  <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#34c77b]" />
                    Tactical Solution:
                  </div>
                  {activePuzzle.explanation}
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 mt-2">
                {status === "solved" ? (
                  <PillButton variant="primary" className="w-full" onClick={handleNextPuzzle}>
                    <div className="flex items-center justify-center gap-2">
                      <span>Next Puzzle</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </PillButton>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleShowHint}
                      disabled={hintLevel >= 2 || isShowingSolution}
                      className="flex items-center justify-center gap-1.5 bg-[#181818] hover:bg-[#222] text-xs font-medium text-[#f5a524] py-3 rounded-2xl border border-white/5 transition-colors disabled:opacity-40"
                    >
                      <HelpCircle className="h-4 w-4" />
                      {hintLevel === 0 ? "Get Hint" : "Full Move"}
                    </button>

                    <button
                      onClick={handleResetPuzzle}
                      className="flex items-center justify-center gap-1.5 bg-[#181818] hover:bg-[#222] text-xs font-medium text-white py-3 rounded-2xl border border-white/5 transition-colors"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset
                    </button>
                  </div>
                )}

                {status !== "solved" && (
                  <button
                    onClick={handlePlaySolution}
                    disabled={isShowingSolution}
                    className="flex items-center justify-center gap-1.5 bg-transparent hover:bg-white/5 text-xs text-[#a3a3a3] hover:text-white py-2.5 rounded-2xl transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Reveal Solution
                  </button>
                )}
              </div>
            </div>

            {/* Tactical Training Tips Card */}
            <div className="bg-white rounded-[26px] p-5 shadow-sm border border-black/5 text-gray-700">
              <h3 className="text-sm font-bold text-[#0a0a0a] mb-2 flex items-center gap-2">
                <span>💡</span> Tactical Tip
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Always calculate <strong>forcing moves</strong> in order: Checks first, Captures second,
                Threats third (C-C-T method). Keep an eye out for loose or undefended pieces.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
