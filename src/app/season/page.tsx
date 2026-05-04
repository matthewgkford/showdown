"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { getCurrentLeague } from "@/lib/leagues";
import {
  getSeasonServerSnapshot,
  getSeasonSnapshot,
  subscribe,
} from "@/lib/season";
import { getTeamBySlug } from "@/lib/teams";

// Stage 2 stub. Stage 4 replaces this with the full season dashboard
// (schedule, standings, next game, etc.). For now it confirms a season
// has been started and offers a link back to choose-team.
export default function SeasonPage() {
  const router = useRouter();
  const season = useSyncExternalStore(
    subscribe,
    getSeasonSnapshot,
    getSeasonServerSnapshot,
  );

  // No season → redirect to picker.
  useEffect(() => {
    if (season === null) {
      router.replace("/choose-team");
    }
  }, [season, router]);

  if (!season) {
    return (
      <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100 px-4 py-10 sm:px-8 flex flex-col items-center justify-center">
        <p className="text-sm text-zinc-500">No season — redirecting…</p>
      </main>
    );
  }

  const team = getTeamBySlug(season.playerTeamSlug);
  const league = getCurrentLeague(season.currentLeagueTier);

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Season
            </h1>
            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-zinc-500">
              {league?.name ?? `Tier ${season.currentLeagueTier}`}
              {league && (
                <span className="text-zinc-600">
                  {" "}
                  · {league.displayName}
                </span>
              )}
            </p>
          </div>
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            ← home
          </Link>
        </header>

        {team && (
          <div
            className="rounded-2xl p-6 sm:p-8 flex flex-col items-center gap-4"
            style={{
              background: `radial-gradient(ellipse at top, ${team.colors.primary}66 0%, transparent 70%)`,
            }}
          >
            <Image
              src={team.logos.primary}
              alt={team.name}
              width={320}
              height={320}
              className="h-32 w-32 sm:h-40 sm:w-40 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
              priority
            />
            <div className="text-center">
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.3em]"
                style={{ color: team.colors.accent }}
              >
                Now playing as
              </div>
              <div className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">
                {team.name}
              </div>
            </div>
            <p className="max-w-sm text-center text-sm text-zinc-400 leading-relaxed">
              {team.flavor}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {team && (
            <Link
              href={`/team/${team.slug}`}
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              View my roster →
            </Link>
          )}
          <Link
            href="/standings"
            className="rounded-full border border-zinc-700 px-5 py-2 text-sm text-zinc-300 hover:border-zinc-500"
          >
            Standings
          </Link>
          <Link
            href="/game"
            className="rounded-full border border-zinc-700 px-5 py-2 text-sm text-zinc-300 hover:border-zinc-500"
          >
            Exhibition
          </Link>
        </div>

        <section className="mt-8 rounded-xl border border-dashed border-zinc-800 p-6 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-600">
            Coming in stage 4
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Schedule, division standings, next-game CTA, and pack rewards
            land in Stage 4.
          </p>
        </section>

        <section className="mt-6 flex justify-center">
          <Link
            href="/choose-team"
            className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
          >
            Manage / change team
          </Link>
        </section>
      </div>
    </main>
  );
}
