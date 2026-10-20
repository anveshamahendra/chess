export default function LeaderboardLoading() {
  return (
    <div className="min-h-screen bg-page">
      <div className="px-4 md:px-8 py-10">
        <div className="h-9 w-52 rounded-xl bg-black/5 dark:bg-white/10 animate-pulse mb-2" />
        <div className="h-4 w-40 rounded-lg bg-black/5 dark:bg-white/10 animate-pulse mb-8" />

        <div className="rounded-[26px] bg-card overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-6 py-4 border-b border-black/5 dark:border-white/5 last:border-0"
            >
              <div className="h-4 w-6 rounded bg-black/5 dark:bg-white/10 animate-pulse" />
              <div className="h-4 flex-1 rounded bg-black/5 dark:bg-white/10 animate-pulse" />
              <div className="h-4 w-12 rounded bg-black/5 dark:bg-white/10 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
