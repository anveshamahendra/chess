"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface PillButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "secondary" | "danger";
}

export function PillButton({
  variant = "primary",
  className,
  children,
  ...props
}: PillButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "rounded-full px-6 py-3 font-medium text-[15px] transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variant === "primary" &&
          "bg-white text-[#0a0a0a] hover:brightness-95",
        variant === "secondary" &&
          "bg-[#0a0a0a] text-white hover:brightness-125",
        variant === "danger" &&
          "bg-[#ef4444] text-white hover:brightness-110",
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
