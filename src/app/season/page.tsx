"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { getCurrentLeague } from "@/lib/leagues";
import {
  getSeasonServerSnapshot,
  getSeasonSnapshot,
  subscribe,
} from "@/lib/season";
import { computeStandings, standingsByDivision } from "@/lib/standings";
import {
  getAllDivisions,
  getDivisionForTeam,
  getTeamBySlug,
} from "@/lib/teams";
import type { ScheduledGame } from "@/types/schedule";

const UPCOMING_COUNT = 5;
const RECENT_COUNT = 5;

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

  const data = useMemo(() => {
    if (!season) return null;
    const playerSlug = season.playerTeamSlug;
    const records = computeStandings(season.schedule);
    const playerRecord = records.find((r) => r.teamSlug === playerSlug);
    const playerGames = season.schedule
      .filter(
        (g) => g.awaySlug === playerSlug || g.homeSlug === playerSlug,
      )
      .sort((a, b) => a.round - b.round);
    const upcoming = playerGames
      .filter((g) => g.result === null)
      .slice(0, UPCOMING_COUNT);
    const recent = playerGames
      .filter((g) => g.result !== null)
      .slice(-RECENT_COUNT)
      .reverse();
    const nextGame = upcoming[0] ?? null;
    const divisions = standingsByDivision(records);
    return {
      playerRecord,
      upcoming,
      recent,
      nextGame,
      divisions,
      gamesPlayed: playerGames.filter((g) => g.result !== null).length,
      totalGames: playerGames.length,
    };
  }, [season]);

  if (!season || !data) {
    return (
      <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100 px-4 py-10 sm:px-8 flex flex-col items-center justify-center">
        <p className="text-sm text-zinc-500">Loading season…</p>
      </main>
    );
  }

  const team = getTeamBySlug(season.playerTeamSlug);
  const division = getDivisionForTeam(season.playerTeamSlug);
  const league = getCurrentLeague(season.currentLeagueTier);
  const seasonOver = data.upcoming.length === 0;

  return (
    <main
      className="min-h-[100dvh] bg-zinc-950 text-zinc-100"
      style={
        team
          ? {
              backgroundImage: `radial-gradient(ellipse 90% 40% at top, ${team.colors.primary}55 0%, transparent 60%)`,
            }
          : undefined
      }
    >
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
        <header className="mb-6 flex items-baseline justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
              {league?.name ?? `Tier ${season.currentLeagueTier}`}
              {league && (
                <span className="text-zinc-600">
                  {" "}
                  · {league.displayName}
                </span>
              )}
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">
              Season
            </h1>
          </div>
          <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200">
            ← home
          </Link>
        </header>

        {/* Hero: team + record */}
        {team && (
          <section className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:gap-8 sm:items-center">
            <Image
              src={team.logos.primary}
              alt={team.name}
              width={320}
              height={320}
              className="h-28 w-28 sm:h-32 sm:w-32 rounded-lg object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
              priority
            />
            <div className="flex-1 text-center sm:text-left">
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.3em]"
                style={{ color: team.colors.accent }}
              >
                {division?.name ?? "—"}
              </div>
              <h2 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight">
                {team.name}
              </h2>
              <div className="mt-2 flex items-baseline justify-center sm:justify-start gap-3">
                <span className="font-mono text-2xl sm:text-3xl font-bold tabular-nums">
                  {data.playerRecord?.wins ?? 0}-
                  {data.playerRecord?.losses ?? 0}
                </span>
                <span className="text-xs text-zinc-500">
                  {data.gamesPlayed} of {data.totalGames} played
                </span>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2">
              {seasonOver ? (
                <div className="rounded-full bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-zinc-400 text-center">
                  Season complete
                </div>
              ) : (
                <Link
                  href={
                    data.nextGame
                      ? `/game?season=1&round=${data.nextGame.round}&away=${data.nextGame.awaySlug}&home=${data.nextGame.homeSlug}`
                      : "#"
                  }
                  className="rounded-full bg-emerald-500 px-6 py-2.5 text-center text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
                >
                  Play next game →
                </Link>
              )}
              <Link
                href={`/team/${team.slug}`}
                className="rounded-full border border-zinc-700 px-5 py-2 text-center text-xs text-zinc-300 hover:border-zinc-500"
              >
                Roster
              </Link>
            </div>
          </section>
        )}

        {/* Upcoming + recent side by side on wide */}
        <section className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Panel title="Upcoming">
            {data.upcoming.length === 0 ? (
              <Empty>No more games this season.</Empty>
            ) : (
              <ul className="space-y-1.5">
                {data.upcoming.map((g) => (
                  <li key={`${g.round}-${g.awaySlug}-${g.homeSlug}`}>
                    <UpcomingRow game={g} playerSlug={season.playerTeamSlug} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent results">
            {data.recent.length === 0 ? (
              <Empty>No games played yet — tap “Play next game” to start.</Empty>
            ) : (
              <ul className="space-y-1.5">
                {data.recent.map((g) => (
                  <li key={`${g.round}-${g.awaySlug}-${g.homeSlug}`}>
                    <ResultRow game={g} playerSlug={season.playerTeamSlug} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>

        {/* Division standings */}
        <section>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Standings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.divisions.map((d) => {
              const divisionMeta = getAllDivisions().find(
                (x) => x.slug === d.divisionSlug,
              );
              const isPlayerDivision = d.divisionSlug === division?.slug;
              return (
                <div
                  key={d.divisionSlug}
                  className={`rounded-xl border p-3 ${
                    isPlayerDivision
                      ? "border-emerald-700/60 bg-emerald-500/5"
                      : "border-zinc-800"
                  }`}
                >
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                    {divisionMeta?.name ?? d.divisionSlug}
                  </div>
                  <ol className="space-y-1">
                    {d.teams.map((rec, idx) => (
                      <StandingsRow
                        key={rec.teamSlug}
                        rank={idx + 1}
                        teamSlug={rec.teamSlug}
                        wins={rec.wins}
                        losses={rec.losses}
                        runDifferential={rec.runDifferential}
                        isPlayer={rec.teamSlug === season.playerTeamSlug}
                      />
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-8 text-center">
          <Link
            href="/choose-team"
            className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
          >
            Manage / change team
          </Link>
        </div>
      </div>
    </main>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-zinc-600 italic">{children}</p>;
}

function UpcomingRow({
  game,
  playerSlug,
}: {
  game: ScheduledGame;
  playerSlug: string;
}) {
  const playerHome = game.homeSlug === playerSlug;
  const opponentSlug = playerHome ? game.awaySlug : game.homeSlug;
  const opponent = getTeamBySlug(opponentSlug);
  if (!opponent) return null;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-7 shrink-0 font-mono text-zinc-600 tabular-nums">
        R{game.round}
      </span>
      <span
        className={`w-6 shrink-0 text-center text-[10px] font-bold uppercase tracking-wider ${
          playerHome ? "text-emerald-400" : "text-zinc-500"
        }`}
      >
        {playerHome ? "vs" : "@"}
      </span>
      <Image
        src={opponent.logos.primary}
        alt={opponent.name}
        width={48}
        height={48}
        className="h-5 w-5 rounded-sm object-contain"
      />
      <span className="flex-1 truncate text-zinc-200">{opponent.name}</span>
    </div>
  );
}

function ResultRow({
  game,
  playerSlug,
}: {
  game: ScheduledGame;
  playerSlug: string;
}) {
  if (!game.result) return null;
  const playerHome = game.homeSlug === playerSlug;
  const opponentSlug = playerHome ? game.awaySlug : game.homeSlug;
  const opponent = getTeamBySlug(opponentSlug);
  if (!opponent) return null;
  const playerWon =
    (playerHome && game.result.winner === "home") ||
    (!playerHome && game.result.winner === "away");
  const playerRuns = playerHome ? game.result.homeRuns : game.result.awayRuns;
  const oppRuns = playerHome ? game.result.awayRuns : game.result.homeRuns;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`w-5 shrink-0 text-center font-bold ${
          playerWon ? "text-emerald-400" : "text-rose-400"
        }`}
      >
        {playerWon ? "W" : "L"}
      </span>
      <Image
        src={opponent.logos.primary}
        alt={opponent.name}
        width={48}
        height={48}
        className="h-5 w-5 rounded-sm object-contain"
      />
      <span className="flex-1 truncate text-zinc-300">{opponent.name}</span>
      <span className="font-mono text-zinc-200 tabular-nums">
        {playerRuns}-{oppRuns}
      </span>
    </div>
  );
}

function StandingsRow({
  rank,
  teamSlug,
  wins,
  losses,
  runDifferential,
  isPlayer,
}: {
  rank: number;
  teamSlug: string;
  wins: number;
  losses: number;
  runDifferential: number;
  isPlayer: boolean;
}) {
  const team = getTeamBySlug(teamSlug);
  if (!team) return null;
  const diffStr =
    runDifferential > 0
      ? `+${runDifferential}`
      : runDifferential.toString();
  return (
    <li
      className={`flex items-center gap-2 text-xs ${
        isPlayer ? "text-emerald-300 font-semibold" : "text-zinc-300"
      }`}
    >
      <span className="w-4 text-zinc-600 font-mono tabular-nums">{rank}</span>
      <Image
        src={team.logos.primary}
        alt={team.name}
        width={48}
        height={48}
        className="h-5 w-5 rounded-sm object-contain"
      />
      <Link
        href={`/team/${team.slug}`}
        className="flex-1 truncate hover:text-emerald-300"
      >
        {team.shortName}
      </Link>
      <span className="font-mono tabular-nums w-12 text-right">
        {wins}-{losses}
      </span>
      <span
        className={`font-mono tabular-nums w-10 text-right ${
          runDifferential > 0
            ? "text-emerald-400/80"
            : runDifferential < 0
              ? "text-rose-400/70"
              : "text-zinc-600"
        }`}
      >
        {diffStr}
      </span>
    </li>
  );
}
