export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-page">
      <div className="px-4 md:px-8 py-10">
        <div className="h-9 w-48 rounded-xl bg-black/5 dark:bg-white/10 animate-pulse mb-2" />
        <div className="h-4 w-72 rounded-lg bg-black/5 dark:bg-white/10 animate-pulse mb-8" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-black/5 dark:bg-white/10 animate-pulse"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-64 rounded-2xl bg-black/5 dark:bg-white/10 animate-pulse" />
          <div className="h-64 rounded-2xl bg-black/5 dark:bg-white/10 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
