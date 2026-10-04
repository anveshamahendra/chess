"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Chess, Square } from "chess.js";
import { NavBar } from "@/components/nav/NavBar";
import { PillButton } from "@/components/ui/PillButton";
import { ChessBoard } from "@/components/board/ChessBoard";
import { ClockDisplay } from "@/components/game/ClockDisplay";
import { MoveList } from "@/components/game/MoveList";
import { Modal } from "@/components/ui/Modal";
import { MoveRow } from "@/hooks/useGameRealtime";
import { playSound } from "@/lib/sounds";
import { getBotMove, BotDifficulty } from "@/lib/chess/botEngine";
import { getGameStatus } from "@/lib/chess/engine";
import { cn } from "@/lib/utils";
import { Bot, RotateCcw, Flag, Sparkles, RefreshCw, Undo2 } from "lucide-react";

type ColorChoice = "white" | "black" | "random";

const DIFFICULTIES: { id: BotDifficulty; name: string; elo: number; desc: string; color: string }[] = [
  { id: "easy", name: "Novice", elo: 800, desc: "Casual & beginner friendly", color: "text-emerald-400" },
  { id: "medium", name: "Intermediate", elo: 1400, desc: "Tactical & solid club player", color: "text-amber-400" },
  { id: "hard", name: "Advanced", elo: 1800, desc: "Positional & sharp calculation", color: "text-rose-400" },
  { id: "master", name: "Master", elo: 2200, desc: "Deep alpha-beta search", color: "text-purple-400" },
];

const TIME_CONTROLS = [
  { label: "Casual (∞)", minutes: 0 },
  { label: "3 min", minutes: 3 },
  { label: "5 min", minutes: 5 },
  { label: "10 min", minutes: 10 },
];

export default function PlayBotPage() {
  const [inGame, setInGame] = useState(false);
  const [difficulty, setDifficulty] = useState<BotDifficulty>("medium");
  const [colorChoice, setColorChoice] = useState<ColorChoice>("white");
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [selectedTC, setSelectedTC] = useState(TIME_CONTROLS[0]);

  // Game state
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState("start");
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [gameOver, setGameOver] = useState<{
    result: string;
    reason: string;
    winner: "player" | "bot" | "draw";
  } | null>(null);

  // Clocks
  const [playerTimeMs, setPlayerTimeMs] = useState(0);
  const [botTimeMs, setBotTimeMs] = useState(0);

  const botTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startNewGame = useCallback(() => {
    chess.reset();
    setFen("start");
    setMoves([]);
    setGameOver(null);
    setIsBotThinking(false);

    let chosenColor: "white" | "black" = "white";
    if (colorChoice === "random") {
      chosenColor = Math.random() < 0.5 ? "white" : "black";
    } else {
      chosenColor = colorChoice;
    }
    setPlayerColor(chosenColor);

    const initialMs = selectedTC.minutes * 60 * 1000;
    setPlayerTimeMs(initialMs);
    setBotTimeMs(initialMs);

    setInGame(true);
  }, [chess, colorChoice, selectedTC]);

  // Trigger bot's first move if bot is White
  useEffect(() => {
    if (!inGame || gameOver) return;

    const isBotTurn = (chess.turn() === "w" && playerColor === "black") ||
                      (chess.turn() === "b" && playerColor === "white");

    if (isBotTurn && !isBotThinking) {
      triggerBotMove();
    }
  }, [inGame, playerColor, fen, gameOver]);

  // Handle clock countdown
  useEffect(() => {
    if (!inGame || gameOver || selectedTC.minutes === 0) return;

    const interval = setInterval(() => {
      const isPlayerTurn = (chess.turn() === "w" && playerColor === "white") ||
                           (chess.turn() === "b" && playerColor === "black");

      if (isPlayerTurn) {
        setPlayerTimeMs((prev) => {
          if (prev <= 100) {
            setGameOver({
              result: playerColor === "white" ? "0-1" : "1-0",
              reason: "Time out",
              winner: "bot",
            });
            playSound("gameEnd");
            return 0;
          }
          return prev - 100;
        });
      } else {
        setBotTimeMs((prev) => {
          if (prev <= 100) {
            setGameOver({
              result: playerColor === "white" ? "1-0" : "0-1",
              reason: "Bot timed out",
              winner: "player",
            });
            playSound("gameEnd");
            return 0;
          }
          return prev - 100;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [inGame, gameOver, selectedTC.minutes, chess, playerColor]);

  const triggerBotMove = async () => {
    setIsBotThinking(true);
    // Add realistic reaction time delay (300ms - 800ms)
    const delay = Math.floor(Math.random() * 400) + 350;

    botTimerRef.current = setTimeout(async () => {
      try {
        const botMove = await getBotMove(chess.fen(), difficulty);
        if (!botMove) {
          setIsBotThinking(false);
          return;
        }

        const moveResult = chess.move({
          from: botMove.from,
          to: botMove.to,
          promotion: botMove.promotion,
        });

        if (moveResult) {
          const newFen = chess.fen();
          setFen(newFen);

          const moveRow: MoveRow = {
            id: `bot-${Date.now()}`,
            game_id: "bot-game",
            move_number: moves.length + 1,
            player_color: playerColor === "white" ? "black" : "white",
            san: moveResult.san,
            fen_after: newFen,
            from_square: moveResult.from,
            to_square: moveResult.to,
            time_taken_ms: delay,
            created_at: new Date().toISOString(),
          };

          setMoves((prev) => [...prev, moveRow]);

          // Play move / capture / check sound
          if (moveResult.san.includes("#")) {
            playSound("gameEnd");
          } else if (moveResult.san.includes("+")) {
            playSound("check");
          } else if (moveResult.san.includes("x")) {
            playSound("capture");
          } else {
            playSound("move");
          }

          // Check for game status
          const status = getGameStatus(chess);
          if (status.over) {
            const isWinnerPlayer = (status.result === "1-0" && playerColor === "white") ||
                                  (status.result === "0-1" && playerColor === "black");
            setGameOver({
              result: status.result ?? "1/2-1/2",
              reason: status.reason ? status.reason.replace(/_/g, " ") : "Game over",
              winner: status.result === "1/2-1/2" ? "draw" : isWinnerPlayer ? "player" : "bot",
            });
            playSound("gameEnd");
          }
        }
      } catch (err) {
        console.error("Bot move calculation error:", err);
      } finally {
        setIsBotThinking(false);
      }
    }, delay);
  };

  const handlePlayerMove = (from: Square, to: Square, promotion?: string) => {
    if (gameOver || isBotThinking) return;

    const isPlayerTurn = (chess.turn() === "w" && playerColor === "white") ||
                         (chess.turn() === "b" && playerColor === "black");
    if (!isPlayerTurn) return;

    try {
      const moveResult = chess.move({ from, to, promotion });
      if (!moveResult) return;

      const newFen = chess.fen();
      setFen(newFen);

      const moveRow: MoveRow = {
        id: `player-${Date.now()}`,
        game_id: "bot-game",
        move_number: moves.length + 1,
        player_color: playerColor,
        san: moveResult.san,
        fen_after: newFen,
        from_square: moveResult.from,
        to_square: moveResult.to,
        time_taken_ms: 0,
        created_at: new Date().toISOString(),
      };

      setMoves((prev) => [...prev, moveRow]);

      // Sound
      if (moveResult.san.includes("#")) {
        playSound("gameEnd");
      } else if (moveResult.san.includes("+")) {
        playSound("check");
      } else if (moveResult.san.includes("x")) {
        playSound("capture");
      } else {
        playSound("move");
      }

      // Check game status
      const status = getGameStatus(chess);
      if (status.over) {
        const isWinnerPlayer = (status.result === "1-0" && playerColor === "white") ||
                              (status.result === "0-1" && playerColor === "black");
        setGameOver({
          result: status.result ?? "1/2-1/2",
          reason: status.reason ? status.reason.replace(/_/g, " ") : "Game over",
          winner: status.result === "1/2-1/2" ? "draw" : isWinnerPlayer ? "player" : "bot",
        });
        playSound("gameEnd");
      }
    } catch {
      // Invalid move
    }
  };

  const handleResign = () => {
    if (gameOver) return;
    setGameOver({
      result: playerColor === "white" ? "0-1" : "1-0",
      reason: "Resignation",
      winner: "bot",
    });
    playSound("gameEnd");
  };

  const handleUndo = () => {
    if (gameOver || isBotThinking || moves.length === 0) return;
    if (botTimerRef.current) clearTimeout(botTimerRef.current);

    // If it's player's turn, undo bot's move and player's previous move (2 plies)
    // If it's bot's turn, undo player's move (1 ply)
    const isPlayerTurn = (chess.turn() === "w" && playerColor === "white") ||
                         (chess.turn() === "b" && playerColor === "black");
    
    const pliesToUndo = isPlayerTurn ? Math.min(2, moves.length) : 1;
    for (let i = 0; i < pliesToUndo; i++) {
      chess.undo();
    }

    setFen(chess.fen());
    setMoves((prev) => prev.slice(0, prev.length - pliesToUndo));
    setIsBotThinking(false);
  };

  const activeBotMeta = DIFFICULTIES.find((d) => d.id === difficulty) ?? DIFFICULTIES[1];
  const isPlayerTurn = (chess.turn() === "w" && playerColor === "white") ||
                       (chess.turn() === "b" && playerColor === "black");

  return (
    <div className="min-h-screen bg-page">
      <NavBar />

      {!inGame ? (
        // Setup Screen
        <div className="flex justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-[26px] bg-card p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f5a524]/20 text-[#f5a524]">
                <Bot className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-bold lowercase text-white">play vs bot</h1>
            </div>
            <p className="text-[#a3a3a3] text-sm mb-6">
              Test your skills against an instant AI chess opponent.
            </p>

            {/* Difficulty */}
            <p className="text-[#a3a3a3] text-sm mb-2 font-medium">Difficulty Level</p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-2xl border text-left transition-all",
                    difficulty === d.id
                      ? "bg-[#1f1f1f] border-white/40 shadow-md"
                      : "bg-card-alt border-transparent text-[#a3a3a3] hover:bg-[#181818]"
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-semibold text-sm text-white">{d.name}</span>
                    <span className={cn("text-xs font-mono font-bold", d.color)}>~{d.elo}</span>
                  </div>
                  <span className="text-xs text-[#a3a3a3] line-clamp-1">{d.desc}</span>
                </button>
              ))}
            </div>

            {/* Side Selection */}
            <p className="text-[#a3a3a3] text-sm mb-2 font-medium">Play As</p>
            <div className="grid grid-cols-3 gap-2 mb-6">
              <button
                onClick={() => setColorChoice("white")}
                className={cn(
                  "py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                  colorChoice === "white"
                    ? "bg-white text-[#0a0a0a]"
                    : "bg-card-alt text-[#a3a3a3] hover:bg-[#1a1a1a]"
                )}
              >
                <span className="text-lg">⚪</span> White
              </button>
              <button
                onClick={() => setColorChoice("black")}
                className={cn(
                  "py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                  colorChoice === "black"
                    ? "bg-white text-[#0a0a0a]"
                    : "bg-card-alt text-[#a3a3a3] hover:bg-[#1a1a1a]"
                )}
              >
                <span className="text-lg">⚫</span> Black
              </button>
              <button
                onClick={() => setColorChoice("random")}
                className={cn(
                  "py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                  colorChoice === "random"
                    ? "bg-white text-[#0a0a0a]"
                    : "bg-card-alt text-[#a3a3a3] hover:bg-[#1a1a1a]"
                )}
              >
                <span className="text-lg">🎲</span> Random
              </button>
            </div>

            {/* Time Control */}
            <p className="text-[#a3a3a3] text-sm mb-2 font-medium">Time Control</p>
            <div className="grid grid-cols-2 gap-2 mb-8">
              {TIME_CONTROLS.map((tc) => (
                <button
                  key={tc.label}
                  onClick={() => setSelectedTC(tc)}
                  className={cn(
                    "rounded-2xl py-3 text-sm font-medium transition-colors",
                    selectedTC.label === tc.label
                      ? "bg-white text-[#0a0a0a]"
                      : "bg-card-alt text-[#a3a3a3] hover:bg-[#1a1a1a]"
                  )}
                >
                  {tc.label}
                </button>
              ))}
            </div>

            <PillButton variant="primary" className="w-full" onClick={startNewGame}>
              Start Match
            </PillButton>
          </div>
        </div>
      ) : (
        // Active Game Screen
        <div className="flex flex-col lg:flex-row items-start justify-center gap-6 px-4 py-8 max-w-6xl mx-auto">
          {/* Chess Board Area */}
          <div className="flex flex-col items-center w-full lg:w-auto">
            {/* Bot Profile Header */}
            <div className="w-full max-w-[560px] flex items-center justify-between bg-card rounded-2xl px-4 py-2.5 mb-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#f5a524]/20 flex items-center justify-center text-[#f5a524]">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Bot ({activeBotMeta.name})</span>
                    <span className={cn("text-xs font-mono font-bold", activeBotMeta.color)}>
                      {activeBotMeta.elo}
                    </span>
                  </div>
                  <p className="text-xs text-[#a3a3a3]">
                    {playerColor === "white" ? "Black" : "White"}
                  </p>
                </div>
              </div>

              {isBotThinking && (
                <div className="flex items-center gap-2 bg-[#1a1a1a] px-3 py-1 rounded-full text-xs text-[#f5a524] animate-pulse">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Thinking…</span>
                </div>
              )}
            </div>

            {/* Board */}
            <ChessBoard
              fen={fen === "start" ? "start" : fen}
              onMove={handlePlayerMove}
              orientation={playerColor}
              interactive={inGame && isPlayerTurn && !gameOver && !isBotThinking}
              lastMove={
                moves.length > 0
                  ? {
                      from: moves[moves.length - 1].from_square as Square,
                      to: moves[moves.length - 1].to_square as Square,
                    }
                  : null
              }
            />

            {/* Player Info Footer */}
            <div className="w-full max-w-[560px] flex items-center justify-between bg-card rounded-2xl px-4 py-2.5 mt-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">You</span>
                <span className="text-xs text-[#a3a3a3]">({playerColor})</span>
              </div>
              {isPlayerTurn && !gameOver && (
                <span className="text-xs bg-[#22c55e]/20 text-[#22c55e] px-2.5 py-0.5 rounded-full font-medium">
                  Your turn
                </span>
              )}
            </div>
          </div>

          {/* Sidebar Controls */}
          <div className="w-full max-w-sm flex flex-col gap-3">
            {/* Clocks (if timed) */}
            {selectedTC.minutes > 0 && (
              <>
                <ClockDisplay
                  label="Bot"
                  remainingMs={botTimeMs}
                  isRunning={inGame && !gameOver && !isPlayerTurn}
                  active={!isPlayerTurn && !gameOver}
                />
              </>
            )}

            {/* Move List */}
            <MoveList moves={moves} />

            {selectedTC.minutes > 0 && (
              <ClockDisplay
                label="You"
                remainingMs={playerTimeMs}
                isRunning={inGame && !gameOver && isPlayerTurn}
                active={isPlayerTurn && !gameOver}
              />
            )}

            {/* In-Game Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleUndo}
                disabled={isBotThinking || moves.length === 0 || !!gameOver}
                className="flex items-center justify-center gap-2 rounded-2xl bg-card py-3 text-sm font-medium text-white hover:bg-[#181818] dark:hover:bg-[#242424] disabled:opacity-40 transition-colors"
              >
                <Undo2 className="h-4 w-4" />
                Undo Move
              </button>

              <button
                onClick={handleResign}
                disabled={!!gameOver}
                className="flex items-center justify-center gap-2 rounded-2xl bg-card py-3 text-sm font-medium text-[#ef4444] hover:bg-[#181818] dark:hover:bg-[#242424] disabled:opacity-40 transition-colors"
              >
                <Flag className="h-4 w-4" />
                Resign
              </button>
            </div>

            <button
              onClick={() => setInGame(false)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-card-alt py-3 text-sm font-medium text-[#a3a3a3] hover:text-white hover:bg-[#1a1a1a] dark:hover:bg-[#242424] transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Change Settings / New Match
            </button>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameOver && (
        <Modal open={true} onClose={() => setGameOver(null)}>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white lowercase mb-2">
              {gameOver.winner === "player"
                ? "You won!"
                : gameOver.winner === "bot"
                ? "Bot won!"
                : "Draw"}
            </h2>
            <p className="text-[#a3a3a3] mb-6 capitalize">{gameOver.reason}</p>
            <div className="flex flex-col gap-3">
              <PillButton variant="primary" className="w-full" onClick={startNewGame}>
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Play Again
                </div>
              </PillButton>
              <PillButton
                variant="secondary"
                className="w-full"
                onClick={() => setInGame(false)}
              >
                Change Difficulty / Settings
              </PillButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
