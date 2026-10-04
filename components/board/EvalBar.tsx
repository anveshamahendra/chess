"use client";

import { motion } from "framer-motion";

export function EvalBar({ evalCp, mateIn }: { evalCp: number | null; mateIn: number | null }) {
  const clamped = mateIn !== null ? (mateIn > 0 ? 1000 : -1000) : Math.max(-1000, Math.min(1000, evalCp ?? 0));
  const whitePercent = 50 + (clamped / 1000) * 50;

  return (
    <div className="relative w-6 h-full rounded-full overflow-hidden bg-card">
      <motion.div
        animate={{ height: `${whitePercent}%` }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="absolute bottom-0 left-0 right-0 bg-white"
      />
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-500 rotate-90">
        {mateIn ? `M${Math.abs(mateIn)}` : ((evalCp ?? 0) / 100).toFixed(1)}
      </div>
    </div>
  );
}
