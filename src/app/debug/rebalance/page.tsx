"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { resetCollection, resetPacks } from "@/lib/collection";
import { resetPlayerRoster } from "@/lib/playerRoster";
import {
  grantReward,
  newInstanceId,
  resetRewards,
} from "@/lib/rewards";
import {
  packTierForWinCount,
  rollPack,
  tierAccentColor,
  tierLabel,
} from "@/lib/rewardRoll";
import {
  getSeasonServerSnapshot,
  getSeasonSnapshot,
  subscribe as subscribeSeason,
} from "@/lib/season";

// One-shot rebalance for seasons started before tiered packs landed.
// Wipes the OP cards out (collection + roster override + unopened
// rewards) and re-issues fresh packs of the right tier for each win
// the player has already racked up. Standings, W/L, schedule, and
// per-card season stats are preserved — only the pack-derived stuff
// rolls back.
export default function RebalancePage() {
  const season = useSyncExternalStore(
    subscribeSeason,
    getSeasonSnapshot,
    getSeasonServerSnapshot,
  );
  const [done, setDone] = useState(false);

  if (!season) {
    return (
      <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100 px-4 py-10 sm:px-8 flex flex-col items-center justify-center text-center gap-3">
        <h1 className="text-xl font-bold">No active season</h1>
        <p className="text-sm text-zinc-500">
          Nothing to rebalance — start a season first.
        </p>
        <Link
          href="/"
          className="text-xs text-emerald-400 hover:text-emerald-300"
        >
          ← home
        </Link>
      </main>
    );
  }

  const playerSlug = season.playerTeamSlug;
  const winCount = season.schedule.filter(
    (g) =>
      g.result !== null &&
      ((g.awaySlug === playerSlug && g.result.winner === "away") ||
        (g.homeSlug === playerSlug && g.result.winner === "home")),
  ).length;

  // Preview which tier each win would map to. Useful so the player
  // sees what they're getting before they hit the button.
  const replacements = Array.from({ length: winCount }, (_, i) => {
    const n = i + 1;
    return { winNumber: n, tier: packTierForWinCount(n) };
  });

  function handleRebalance(): void {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `This will reset your roster overrides, collection, and unopened packs — then re-issue ${winCount} fresh pack${
          winCount === 1 ? "" : "s"
        } based on your wins. Standings + W/L + season stats are kept. Continue?`,
      )
    ) {
      return;
    }
    resetPlayerRoster();
    resetCollection();
    resetPacks();
    resetRewards();
    for (let n = 1; n <= winCount; n++) {
      const tier = packTierForWinCount(n);
      grantReward({
        instanceId: newInstanceId(),
        earnedAt: new Date().toISOString(),
        cardIds: rollPack(tier),
        label: `Reissue · Win #${n}`,
        accentColor: tierAccentColor(tier),
        tier,
      });
    }
    setDone(true);
  }

  if (done) {
    return (
      <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100 px-4 py-10 sm:px-8 flex flex-col items-center justify-center text-center gap-4 max-w-md mx-auto">
        <div className="text-4xl">🎁</div>
        <h1 className="text-xl font-bold">Rebalance complete</h1>
        <p className="text-sm text-zinc-400">
          Roster reset to defaults. {winCount} fresh pack
          {winCount === 1 ? "" : "s"} waiting for you.
        </p>
        <div className="flex gap-2 mt-2">
          <Link
            href="/packs"
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
          >
            Open packs →
          </Link>
          <Link
            href="/season"
            className="rounded-full border border-zinc-700 px-5 py-2 text-sm text-zinc-300 hover:border-zinc-500"
          >
            Season
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-md">
        <header className="mb-6 flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">
            Rebalance season
          </h1>
          <Link
            href="/season"
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            ← season
          </Link>
        </header>

        <p className="text-sm text-zinc-300 leading-relaxed mb-4">
          Resets the gear you&apos;ve picked up from packs (collection,
          roster overrides, unopened rewards) and re-issues fresh packs
          for each game you&apos;ve already won. Useful if you opened
          packs before the tiered Bronze/Silver/Gold/Platinum schedule
          landed and your roster ended up too strong.
        </p>

        <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-2">
            Will keep
          </div>
          <ul className="text-xs text-zinc-300 space-y-0.5 mb-4">
            <li>· Season schedule + W/L record</li>
            <li>· Standings + run differential</li>
            <li>· Per-card season stats (AB / H / IP / etc.)</li>
          </ul>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-400 mb-2">
            Will reset
          </div>
          <ul className="text-xs text-zinc-300 space-y-0.5">
            <li>· Card collection</li>
            <li>· Player roster override</li>
            <li>· Unopened win packs</li>
            <li>· Curated starter packs</li>
          </ul>
        </div>

        <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-2">
            Re-issuing
          </div>
          {winCount === 0 ? (
            <p className="text-xs text-zinc-400">
              No wins yet — nothing to re-issue. The button will still
              clear collection + overrides if you tap it.
            </p>
          ) : (
            <ul className="text-xs text-zinc-200 space-y-1">
              {replacements.map((r) => (
                <li
                  key={r.winNumber}
                  className="flex items-center justify-between"
                >
                  <span className="text-zinc-400">Win #{r.winNumber}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${tierAccentColor(r.tier)}22`,
                      color: tierAccentColor(r.tier),
                    }}
                  >
                    {tierLabel(r.tier)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={handleRebalance}
          className="w-full rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 active:bg-emerald-600"
        >
          Rebalance now
        </button>

        <p className="mt-4 text-[10px] uppercase tracking-[0.25em] text-zinc-600 text-center">
          Debug · safe to re-run
        </p>
      </div>
    </main>
  );
}
