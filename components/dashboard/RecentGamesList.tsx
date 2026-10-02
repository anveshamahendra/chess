import Link from "next/link";

export interface RecentGame {
  id: string;
  opponentName: string;
  result: "win" | "loss" | "draw";
  ratingDelta: number;
  playedAt: string;
}

const RESULT_STYLES: Record<RecentGame["result"], string> = {
  win: "text-[#34c77b]",
  loss: "text-[#ef4444]",
  draw: "text-[#a3a3a3]",
};

export function RecentGamesList({ games }: { games: RecentGame[] }) {
  return (
    <div className="rounded-2xl bg-[#0a0a0a] p-5">
      <p className="text-[#a3a3a3] text-sm mb-4">Recent games</p>
      {games.length === 0 && <p className="text-[#a3a3a3]/60 text-sm">No games played yet.</p>}
      <div className="divide-y divide-white/5">
        {games.map((g) => (
          <Link
            key={g.id}
            href={`/analysis/${g.id}`}
            className="flex items-center justify-between py-3 hover:bg-white/[0.03] -mx-2 px-2 rounded-lg transition-colors"
          >
            <div>
              <p className="text-white text-[15px]">vs {g.opponentName}</p>
              <p className="text-[#a3a3a3] text-xs">{g.playedAt}</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold capitalize ${RESULT_STYLES[g.result]}`}>{g.result}</p>
              <p className="text-[#a3a3a3] text-xs">
                {g.ratingDelta >= 0 ? "+" : ""}
                {g.ratingDelta}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
