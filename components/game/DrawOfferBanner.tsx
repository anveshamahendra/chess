"use client";

import { PillButton } from "@/components/ui/PillButton";

export function DrawOfferBanner({
  offeredByMe,
  onAccept,
  onDecline,
}: {
  offeredByMe: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="rounded-2xl bg-[#121212] px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-sm text-white">
        {offeredByMe ? "Draw offer sent — waiting for opponent." : "Your opponent offered a draw."}
      </span>
      {!offeredByMe && (
        <div className="flex gap-2 shrink-0">
          <PillButton variant="primary" className="!px-4 !py-2 text-sm" onClick={onAccept}>
            Accept
          </PillButton>
          <PillButton variant="secondary" className="!px-4 !py-2 text-sm" onClick={onDecline}>
            Decline
          </PillButton>
        </div>
      )}
    </div>
  );
}
