import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-2xl bg-[#f2f2f0] border border-black/10 px-4 py-3 text-[15px] text-[#0a0a0a] placeholder:text-black/40 focus:border-[#5b8def] outline-none transition-colors",
        className
      )}
      {...props}
    />
  );
}
