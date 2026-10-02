"use client";

import { useState } from "react";
import { Flag, Handshake } from "lucide-react";
import { PillButton } from "@/components/ui/PillButton";
import { Modal } from "@/components/ui/Modal";

export function GameControls({
  onResign,
  onOfferDraw,
  disabled,
}: {
  onResign: () => void;
  onOfferDraw: () => void;
  disabled?: boolean;
}) {
  const [confirmResign, setConfirmResign] = useState(false);

  return (
    <div className="flex gap-2">
      <PillButton
        variant="secondary"
        className="flex items-center gap-2 !px-4"
        onClick={onOfferDraw}
        disabled={disabled}
      >
        <Handshake size={16} /> Offer draw
      </PillButton>
      <PillButton
        variant="danger"
        className="flex items-center gap-2 !px-4"
        onClick={() => setConfirmResign(true)}
        disabled={disabled}
      >
        <Flag size={16} /> Resign
      </PillButton>

      <Modal open={confirmResign} onClose={() => setConfirmResign(false)}>
        <h3 className="text-xl font-bold text-white mb-2">Resign this game?</h3>
        <p className="text-[#a3a3a3] text-sm mb-6">This counts as a loss and cannot be undone.</p>
        <div className="flex gap-3">
          <PillButton variant="secondary" className="flex-1" onClick={() => setConfirmResign(false)}>
            Cancel
          </PillButton>
          <PillButton
            variant="danger"
            className="flex-1"
            onClick={() => {
              setConfirmResign(false);
              onResign();
            }}
          >
            Resign
          </PillButton>
        </div>
      </Modal>
    </div>
  );
}
