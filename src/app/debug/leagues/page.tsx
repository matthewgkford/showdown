import Link from "next/link";
import { getAllLeagues } from "@/lib/leagues";

export default function DebugLeaguesPage() {
  const leagues = getAllLeagues();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Debug · Leagues
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              League tiers and the powerLevel multiplier applied to opponent
              rosters at each tier.
            </p>
          </div>
          <Link
            href="/debug/teams"
            className="rounded-full border border-zinc-700 px-3 py-2 text-xs sm:text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
          >
            ← Teams
          </Link>
        </header>

        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-zinc-400">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Tier</th>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Display name</th>
                <th className="px-3 py-2 font-medium">Power level</th>
                <th className="px-3 py-2 font-medium">Promotion</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {leagues.map((league) => (
                <tr
                  key={league.id}
                  className="border-t border-zinc-800 odd:bg-zinc-950 even:bg-zinc-900/40"
                >
                  <td className="px-3 py-2 font-mono">{league.tier}</td>
                  <td className="px-3 py-2 font-mono text-zinc-400">
                    {league.id}
                  </td>
                  <td className="px-3 py-2 font-semibold">{league.name}</td>
                  <td className="px-3 py-2 text-zinc-300">
                    {league.displayName}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    × {league.powerLevel.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {league.promotionRequirement}
                  </td>
                  <td className="px-3 py-2">
                    {league.stub ? (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-400">
                        Stub
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-400">
                        Playable
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-400">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            How power level scales rosters
          </div>
          <p>
            For tier <span className="font-mono text-zinc-200">N</span>, opponent
            rosters are passed through{" "}
            <span className="font-mono text-zinc-200">applyPowerLevel(card, league.powerLevel)</span>:
          </p>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>
              <span className="text-zinc-200">Batter on-base</span> scales — at
              ×1.4 a batter with OB 9 effectively becomes OB{" "}
              <span className="font-mono">13</span> (rounded).
            </li>
            <li>
              <span className="text-zinc-200">Pitcher control</span> scales — at
              ×1.4 a Ctrl 4 becomes Ctrl{" "}
              <span className="font-mono">6</span>.
            </li>
            <li>
              Chart values do <span className="text-zinc-200">not</span> scale —
              they remain 1–20 d20 ranges. Only the advantage probability
              shifts.
            </li>
            <li>
              The player&apos;s own roster is{" "}
              <span className="text-zinc-200">never</span> scaled. Players gain
              power by collecting better cards from packs, not by tier
              promotion.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
