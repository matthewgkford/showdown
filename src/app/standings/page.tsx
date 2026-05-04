"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  getSeasonServerSnapshot,
  getSeasonSnapshot,
  subscribe,
} from "@/lib/season";
import { getCurrentLeague } from "@/lib/leagues";
import { getRosterPower } from "@/lib/rosters";
import {
  getAllDivisions,
  getAllTeams,
  getDivisionForTeam,
} from "@/lib/teams";

const DEFAULT_TIER = 1;

export default function StandingsPage() {
  const season = useSyncExternalStore(
    subscribe,
    getSeasonSnapshot,
    getSeasonServerSnapshot,
  );

  const tier = season?.currentLeagueTier ?? DEFAULT_TIER;
  const league = getCurrentLeague(tier);
  const playerSlug = season?.playerTeamSlug ?? null;

  const teams = getAllTeams();
  const divisions = getAllDivisions();

  const ranked = teams
    .map((team) => ({
      team,
      division: getDivisionForTeam(team.slug),
      power: getRosterPower(team.slug, tier),
    }))
    .sort((a, b) => b.power - a.power);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Standings</h1>
            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-zinc-500">
              {league?.name ?? `Tier ${tier}`}
              {league && (
                <span className="text-zinc-600">
                  {" "}
                  · {league.displayName} · ×{league.powerLevel.toFixed(2)}
                </span>
              )}
            </p>
          </div>
          <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200">
            ← home
          </Link>
        </header>

        <p className="mb-4 text-xs text-zinc-500">
          Power = total roster points scaled to the current league tier. Once
          season games start (Stage 4) this view will switch to W-L records.
        </p>

        <div className="mb-8 overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-zinc-500">
              <tr className="text-left">
                <th className="px-3 py-2 w-12 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Team</th>
                <th className="px-3 py-2 font-medium">Division</th>
                <th className="px-3 py-2 text-right font-medium">Power</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ team, division, power }, idx) => {
                const isPlayer = team.slug === playerSlug;
                return (
                  <tr
                    key={team.slug}
                    className={`border-t border-zinc-800 ${
                      isPlayer ? "bg-emerald-500/10" : "hover:bg-zinc-900/40"
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-zinc-500">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/team/${team.slug}`}
                        className="flex items-center gap-3 hover:text-emerald-300"
                      >
                        <Image
                          src={team.logos.primary}
                          alt={team.name}
                          width={48}
                          height={48}
                          className="h-7 w-7 rounded-md object-contain"
                        />
                        <span className="font-semibold">{team.name}</span>
                        {isPlayer && (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300">
                            you
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {division?.name.replace(" Division", "") ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {power.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Per-division breakdown — useful for season seeding context */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {divisions.map((division) => {
            const inDivision = ranked.filter(
              (r) => r.division?.slug === division.slug,
            );
            return (
              <section
                key={division.slug}
                className="rounded-xl border border-zinc-800 p-4"
              >
                <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  {division.name}
                </h2>
                <ol className="space-y-1.5">
                  {inDivision.map(({ team, power }, idx) => (
                    <li
                      key={team.slug}
                      className={`flex items-center gap-2 text-xs ${
                        team.slug === playerSlug
                          ? "text-emerald-300 font-semibold"
                          : "text-zinc-300"
                      }`}
                    >
                      <span className="w-4 text-zinc-500 font-mono">
                        {idx + 1}
                      </span>
                      <Link
                        href={`/team/${team.slug}`}
                        className="flex flex-1 items-center gap-2 hover:text-emerald-300"
                      >
                        <Image
                          src={team.logos.primary}
                          alt={team.name}
                          width={32}
                          height={32}
                          className="h-5 w-5 rounded-sm object-contain"
                        />
                        <span>{team.name}</span>
                      </Link>
                      <span className="font-mono text-zinc-500">
                        {power.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
