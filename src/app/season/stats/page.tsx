"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import cardsData from "@data/cards.json";
import { getOverrideFor } from "@/lib/playerRoster";
import { getAllRosters } from "@/lib/rosters";
import {
  getSeasonServerSnapshot,
  getSeasonSnapshot,
  subscribe as subscribeSeason,
} from "@/lib/season";
import {
  getSeasonStatsServerSnapshot,
  getSeasonStatsSnapshot,
  subscribe as subscribeStats,
} from "@/lib/seasonStats";
import {
  type BatterStats,
  type PitcherStats,
  batterAvg,
  formatAvg,
  formatEra,
  formatIp,
  pitcherEra,
} from "@/lib/stats";
import { getTeamBySlug } from "@/lib/teams";
import type { BatterCard, Card, PitcherCard } from "@/types/card";

const ALL_CARDS = cardsData as Card[];
const cardById = new Map(ALL_CARDS.map((c) => [c.id, c]));

// Rate-stat thresholds — keeps cards with tiny samples (1 AB, 1 IP)
// from dominating leaderboards on small numbers.
const MIN_AB_FOR_AVG = 10;
const MIN_OUTS_FOR_ERA = 6; // 2 IP

const TOP_N = 15;

type Tab = "batters" | "pitchers";
type BatterMetric = "avg" | "hr" | "rbi";
type PitcherMetric = "era" | "k" | "ip";

type BatterEntry = { id: string; card: BatterCard; stats: BatterStats };
type PitcherEntry = { id: string; card: PitcherCard; stats: PitcherStats };

export default function StatsPage() {
  const stats = useSyncExternalStore(
    subscribeStats,
    getSeasonStatsSnapshot,
    getSeasonStatsServerSnapshot,
  );
  const season = useSyncExternalStore(
    subscribeSeason,
    getSeasonSnapshot,
    getSeasonServerSnapshot,
  );

  const [tab, setTab] = useState<Tab>("batters");
  const [batterMetric, setBatterMetric] = useState<BatterMetric>("avg");
  const [pitcherMetric, setPitcherMetric] = useState<PitcherMetric>("era");

  const playerSlug = season?.playerTeamSlug ?? null;

  // Map cardId → league team slug. Honours the player's roster
  // override so a swapped-in card shows on the player's team.
  const cardToTeam = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of getAllRosters()) {
      const roster =
        playerSlug === r.teamSlug
          ? (getOverrideFor(r.teamSlug) ?? r)
          : r;
      for (const id of roster.batters) m.set(id, r.teamSlug);
      m.set(roster.startingPitcher, r.teamSlug);
      for (const id of roster.relievers) m.set(id, r.teamSlug);
    }
    return m;
  }, [playerSlug]);

  const batterEntries = useMemo<BatterEntry[]>(() => {
    const all: BatterEntry[] = [];
    for (const [id, s] of Object.entries(stats.batters)) {
      const card = cardById.get(id);
      if (!card || card.cardType !== "batter") continue;
      all.push({ id, card, stats: s });
    }
    if (batterMetric === "avg") {
      return all
        .filter((e) => e.stats.ab >= MIN_AB_FOR_AVG)
        .sort((a, b) => batterAvg(b.stats) - batterAvg(a.stats));
    }
    if (batterMetric === "hr") {
      return all
        .filter((e) => e.stats.hr > 0)
        .sort((a, b) => b.stats.hr - a.stats.hr);
    }
    return all
      .filter((e) => e.stats.rbi > 0)
      .sort((a, b) => b.stats.rbi - a.stats.rbi);
  }, [stats, batterMetric]);

  const pitcherEntries = useMemo<PitcherEntry[]>(() => {
    const all: PitcherEntry[] = [];
    for (const [id, s] of Object.entries(stats.pitchers)) {
      const card = cardById.get(id);
      if (!card || card.cardType !== "pitcher") continue;
      all.push({ id, card, stats: s });
    }
    if (pitcherMetric === "era") {
      return all
        .filter((e) => e.stats.outs >= MIN_OUTS_FOR_ERA)
        .sort((a, b) => pitcherEra(a.stats) - pitcherEra(b.stats));
    }
    if (pitcherMetric === "k") {
      return all
        .filter((e) => e.stats.k > 0)
        .sort((a, b) => b.stats.k - a.stats.k);
    }
    return all
      .filter((e) => e.stats.outs > 0)
      .sort((a, b) => b.stats.outs - a.stats.outs);
  }, [stats, pitcherMetric]);

  const isEmpty =
    Object.keys(stats.batters).length === 0 &&
    Object.keys(stats.pitchers).length === 0;

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-baseline justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            League stats
          </h1>
          <Link
            href="/season"
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            ← season
          </Link>
        </header>

        {/* Tab switcher */}
        <div className="mb-4 inline-flex rounded-full border border-zinc-800 p-0.5 bg-zinc-900/40">
          <TabButton active={tab === "batters"} onClick={() => setTab("batters")}>
            Batters
          </TabButton>
          <TabButton active={tab === "pitchers"} onClick={() => setTab("pitchers")}>
            Pitchers
          </TabButton>
        </div>

        {/* Sort chips for the active tab */}
        <div className="mb-5 flex flex-wrap items-baseline gap-1.5 text-xs">
          <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-600 mr-1">
            Sort
          </span>
          {tab === "batters" ? (
            <>
              <Chip
                active={batterMetric === "avg"}
                onClick={() => setBatterMetric("avg")}
              >
                AVG
              </Chip>
              <Chip
                active={batterMetric === "hr"}
                onClick={() => setBatterMetric("hr")}
              >
                HR
              </Chip>
              <Chip
                active={batterMetric === "rbi"}
                onClick={() => setBatterMetric("rbi")}
              >
                RBI
              </Chip>
            </>
          ) : (
            <>
              <Chip
                active={pitcherMetric === "era"}
                onClick={() => setPitcherMetric("era")}
              >
                ERA
              </Chip>
              <Chip
                active={pitcherMetric === "k"}
                onClick={() => setPitcherMetric("k")}
              >
                K
              </Chip>
              <Chip
                active={pitcherMetric === "ip"}
                onClick={() => setPitcherMetric("ip")}
              >
                IP
              </Chip>
            </>
          )}
        </div>

        {isEmpty ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
            <p className="text-sm text-zinc-400">No stats yet</p>
            <p className="mt-1 text-xs text-zinc-600">
              Play some season games to populate the leaderboard.
            </p>
          </div>
        ) : tab === "batters" ? (
          <BatterList
            entries={batterEntries.slice(0, TOP_N)}
            metric={batterMetric}
            cardToTeam={cardToTeam}
            playerSlug={playerSlug}
          />
        ) : (
          <PitcherList
            entries={pitcherEntries.slice(0, TOP_N)}
            metric={pitcherMetric}
            cardToTeam={cardToTeam}
            playerSlug={playerSlug}
          />
        )}

        {tab === "batters" && batterMetric === "avg" && (
          <p className="mt-4 text-[10px] text-zinc-600 text-center">
            Min {MIN_AB_FOR_AVG} AB to qualify for AVG
          </p>
        )}
        {tab === "pitchers" && pitcherMetric === "era" && (
          <p className="mt-4 text-[10px] text-zinc-600 text-center">
            Min {MIN_OUTS_FOR_ERA / 3} IP to qualify for ERA
          </p>
        )}
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
        active
          ? "bg-emerald-500 text-zinc-950"
          : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
        active
          ? "bg-zinc-100 text-zinc-950"
          : "border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function BatterList({
  entries,
  metric,
  cardToTeam,
  playerSlug,
}: {
  entries: BatterEntry[];
  metric: BatterMetric;
  cardToTeam: Map<string, string>;
  playerSlug: string | null;
}) {
  return (
    <ol className="space-y-1">
      {entries.map((e, idx) => (
        <BatterRow
          key={e.id}
          rank={idx + 1}
          entry={e}
          metric={metric}
          cardToTeam={cardToTeam}
          playerSlug={playerSlug}
        />
      ))}
    </ol>
  );
}

function PitcherList({
  entries,
  metric,
  cardToTeam,
  playerSlug,
}: {
  entries: PitcherEntry[];
  metric: PitcherMetric;
  cardToTeam: Map<string, string>;
  playerSlug: string | null;
}) {
  return (
    <ol className="space-y-1">
      {entries.map((e, idx) => (
        <PitcherRow
          key={e.id}
          rank={idx + 1}
          entry={e}
          metric={metric}
          cardToTeam={cardToTeam}
          playerSlug={playerSlug}
        />
      ))}
    </ol>
  );
}

function BatterRow({
  rank,
  entry,
  metric,
  cardToTeam,
  playerSlug,
}: {
  rank: number;
  entry: BatterEntry;
  metric: BatterMetric;
  cardToTeam: Map<string, string>;
  playerSlug: string | null;
}) {
  const { card, stats: s } = entry;
  const teamSlug = cardToTeam.get(card.id) ?? null;
  const team = teamSlug ? getTeamBySlug(teamSlug) : null;
  const isPlayer = team !== null && team.slug === playerSlug;

  const support = (() => {
    if (metric === "avg") return `${s.ab} AB · ${s.h} H`;
    if (metric === "hr") return `${s.hr} HR · ${s.rbi} RBI`;
    return `${s.rbi} RBI · ${s.h} H`;
  })();
  const big =
    metric === "avg"
      ? formatAvg(s)
      : metric === "hr"
        ? String(s.hr)
        : String(s.rbi);

  return (
    <li
      className={`flex items-center gap-2 sm:gap-3 rounded-lg px-2 py-1.5 ${
        isPlayer
          ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
          : "hover:bg-zinc-900/40"
      }`}
    >
      <span className="w-6 text-right text-xs text-zinc-500 font-mono tabular-nums shrink-0">
        {rank}
      </span>
      <Image
        src={`/cards/${card.id}.png`}
        alt={card.name}
        width={48}
        height={67}
        className="h-10 w-7 rounded shadow shadow-black/40 ring-1 ring-zinc-800 object-cover shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{card.name}</div>
        <div className="text-[10px] text-zinc-500 truncate">{support}</div>
      </div>
      {team && (
        <Image
          src={team.logos.primary}
          alt={team.name}
          width={32}
          height={32}
          className="h-7 w-7 rounded-md object-contain shrink-0"
        />
      )}
      <span className="font-mono tabular-nums font-black text-zinc-100 w-14 text-right text-base sm:text-lg shrink-0">
        {big}
      </span>
    </li>
  );
}

function PitcherRow({
  rank,
  entry,
  metric,
  cardToTeam,
  playerSlug,
}: {
  rank: number;
  entry: PitcherEntry;
  metric: PitcherMetric;
  cardToTeam: Map<string, string>;
  playerSlug: string | null;
}) {
  const { card, stats: s } = entry;
  const teamSlug = cardToTeam.get(card.id) ?? null;
  const team = teamSlug ? getTeamBySlug(teamSlug) : null;
  const isPlayer = team !== null && team.slug === playerSlug;

  const support = (() => {
    if (metric === "era") return `${formatIp(s)} IP · ${s.k} K · ${s.bb} BB`;
    if (metric === "k") return `${formatIp(s)} IP · ${formatEra(s)} ERA`;
    return `${s.k} K · ${formatEra(s)} ERA`;
  })();
  const big =
    metric === "era"
      ? formatEra(s)
      : metric === "k"
        ? String(s.k)
        : formatIp(s);

  return (
    <li
      className={`flex items-center gap-2 sm:gap-3 rounded-lg px-2 py-1.5 ${
        isPlayer
          ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
          : "hover:bg-zinc-900/40"
      }`}
    >
      <span className="w-6 text-right text-xs text-zinc-500 font-mono tabular-nums shrink-0">
        {rank}
      </span>
      <Image
        src={`/cards/${card.id}.png`}
        alt={card.name}
        width={48}
        height={67}
        className="h-10 w-7 rounded shadow shadow-black/40 ring-1 ring-zinc-800 object-cover shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{card.name}</div>
        <div className="text-[10px] text-zinc-500 truncate">{support}</div>
      </div>
      {team && (
        <Image
          src={team.logos.primary}
          alt={team.name}
          width={32}
          height={32}
          className="h-7 w-7 rounded-md object-contain shrink-0"
        />
      )}
      <span className="font-mono tabular-nums font-black text-zinc-100 w-14 text-right text-base sm:text-lg shrink-0">
        {big}
      </span>
    </li>
  );
}
