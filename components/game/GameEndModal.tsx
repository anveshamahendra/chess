"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { PillButton } from "@/components/ui/PillButton";

interface GameEndModalProps {
  open: boolean;
  result: string | null;
  reason: string | null;
  isWhite: boolean;
  gameId: string;
  onClose: () => void;
}

const REASON_LABELS: Record<string, string> = {
  checkmate: "Checkmate",
  stalemate: "Stalemate",
  repetition: "Draw by repetition",
  insufficient_material: "Draw — insufficient material",
  fifty_move_rule: "Draw — fifty-move rule",
  resignation: "Resignation",
  timeout: "Time out",
  draw_agreed: "Draw agreed",
};

export function GameEndModal({ open, result, reason, isWhite, gameId, onClose }: GameEndModalProps) {
  const router = useRouter();

  if (!result) return null;

  const youWon = (result === "1-0" && isWhite) || (result === "0-1" && !isWhite);
  const isDraw = result === "1/2-1/2";

  const headline = isDraw ? "Draw" : youWon ? "You won" : "You lost";

  return (
    <Modal open={open} onClose={onClose}>
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white lowercase mb-2">{headline}</h2>
        <p className="text-[#a3a3a3] mb-8">{reason ? REASON_LABELS[reason] ?? reason : ""}</p>
        <div className="flex flex-col gap-3">
          <PillButton
            variant="primary"
            className="w-full"
            onClick={() => {
              onClose();
              router.push(`/analysis/${gameId}`);
            }}
          >
            View analysis
          </PillButton>
          <PillButton
            variant="secondary"
            className="w-full"
            onClick={() => {
              onClose();
              router.push("/play/new");
            }}
          >
            New game
          </PillButton>
        </div>
      </div>
    </Modal>
  );
}
