import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-[#1a1a1a] px-2.5 py-1 text-xs font-medium text-white",
        className
      )}
    >
      {children}
    </span>
  );
}

export function NotificationDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "absolute top-0 right-0 h-2 w-2 rounded-full bg-pink-500",
        className
      )}
    />
  );
}
