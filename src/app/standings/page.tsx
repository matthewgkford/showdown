"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import {
  getSeasonServerSnapshot,
  getSeasonSnapshot,
  subscribe,
} from "@/lib/season";
import { getCurrentLeague } from "@/lib/leagues";
import { getRosterPower } from "@/lib/rosters";
import {
  computeStandings,
  rankRecords,
  type TeamRecord,
} from "@/lib/standings";
import {
  getAllDivisions,
  getAllTeams,
  getDivisionForTeam,
  getTeamBySlug,
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
  const divisions = getAllDivisions();
  const allTeams = getAllTeams();

  // Records come from the live season schedule. With no season started
  // yet, every team is 0-0; the table still renders so the page works
  // as a "league overview" before the player picks a team.
  const records: TeamRecord[] = useMemo(() => {
    if (season) return computeStandings(season.schedule);
    return allTeams.map((t) => ({
      teamSlug: t.slug,
      divisionSlug: t.divisionSlug,
      wins: 0,
      losses: 0,
      runDifferential: 0,
    }));
  }, [season, allTeams]);

  const ranked = useMemo(() => rankRecords(records), [records]);
  const totalGames = ranked.reduce((a, r) => a + r.wins + r.losses, 0);
  const seasonStarted = totalGames > 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Standings</h1>
            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-zinc-500">
              {league?.name ?? `Tier ${tier}`}
              {league && (
                <span className="text-zinc-600">
                  {" "}
                  · {league.displayName}
                </span>
              )}
            </p>
          </div>
          <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200">
            ← home
          </Link>
        </header>

        <p className="mb-4 text-xs text-zinc-500">
          {seasonStarted
            ? "Sorted by wins, then run differential. Power is total roster points — a forward indicator before games separate the field."
            : "No season games played yet. Showing teams ranked by roster power until the schedule starts moving."}
        </p>

        <div className="mb-8 overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-zinc-500">
              <tr className="text-left">
                <th className="px-2 sm:px-3 py-2 w-8 font-medium">#</th>
                <th className="px-2 sm:px-3 py-2 font-medium">Team</th>
                <th className="px-2 sm:px-3 py-2 text-right font-medium">
                  W-L
                </th>
                <th className="px-2 sm:px-3 py-2 text-right font-medium">
                  RD
                </th>
                <th className="hidden sm:table-cell px-3 py-2 text-right font-medium">
                  Power
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((rec, idx) => {
                const team = getTeamBySlug(rec.teamSlug);
                if (!team) return null;
                const isPlayer = team.slug === playerSlug;
                const power = getRosterPower(team.slug, tier);
                const rd =
                  rec.runDifferential > 0
                    ? `+${rec.runDifferential}`
                    : rec.runDifferential.toString();
                return (
                  <tr
                    key={team.slug}
                    className={`border-t border-zinc-800 ${
                      isPlayer ? "bg-emerald-500/10" : "hover:bg-zinc-900/40"
                    }`}
                  >
                    <td className="px-2 sm:px-3 py-2 font-mono text-zinc-500">
                      {idx + 1}
                    </td>
                    <td className="px-2 sm:px-3 py-2">
                      <Link
                        href={`/team/${team.slug}`}
                        className="flex items-center gap-2 sm:gap-3 hover:text-emerald-300"
                      >
                        <Image
                          src={team.logos.primary}
                          alt={team.name}
                          width={64}
                          height={64}
                          className="h-9 w-9 sm:h-10 sm:w-10 rounded-md object-contain shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {team.name}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500 sm:hidden">
                            {team.divisionSlug.replace("-", " ")}
                          </div>
                        </div>
                        {isPlayer && (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300">
                            you
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-right font-mono tabular-nums">
                      {rec.wins}-{rec.losses}
                    </td>
                    <td
                      className={`px-2 sm:px-3 py-2 text-right font-mono tabular-nums ${
                        rec.runDifferential > 0
                          ? "text-emerald-400/80"
                          : rec.runDifferential < 0
                            ? "text-rose-400/70"
                            : "text-zinc-600"
                      }`}
                    >
                      {rd}
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2 text-right font-mono text-zinc-500 tabular-nums">
                      {power.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Per-division breakdown — context for the promotion picture. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {divisions.map((division) => {
            const divRecords = ranked.filter(
              (r) => getDivisionForTeam(r.teamSlug)?.slug === division.slug,
            );
            const isPlayerDivision = divRecords.some(
              (r) => r.teamSlug === playerSlug,
            );
            return (
              <section
                key={division.slug}
                className={`rounded-xl border p-4 ${
                  isPlayerDivision
                    ? "border-emerald-700/50 bg-emerald-500/5"
                    : "border-zinc-800"
                }`}
              >
                <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
                  {division.name}
                </h2>
                <ol className="space-y-2">
                  {divRecords.map((rec, idx) => {
                    const team = getTeamBySlug(rec.teamSlug);
                    if (!team) return null;
                    const isPlayer = team.slug === playerSlug;
                    return (
                      <li
                        key={team.slug}
                        className={`flex items-center gap-2 text-xs ${
                          isPlayer
                            ? "text-emerald-300 font-semibold"
                            : "text-zinc-300"
                        }`}
                      >
                        <span className="w-4 text-zinc-500 font-mono">
                          {idx + 1}
                        </span>
                        <Link
                          href={`/team/${team.slug}`}
                          className="flex flex-1 items-center gap-2 hover:text-emerald-300 min-w-0"
                        >
                          <Image
                            src={team.logos.primary}
                            alt={team.name}
                            width={48}
                            height={48}
                            className="h-7 w-7 rounded-md object-contain shrink-0"
                          />
                          <span className="truncate">{team.name}</span>
                        </Link>
                        <span className="font-mono tabular-nums">
                          {rec.wins}-{rec.losses}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
