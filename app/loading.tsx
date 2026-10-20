export default function Loading() {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent dark:border-white/20 dark:border-t-white" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    </div>
  );
}
