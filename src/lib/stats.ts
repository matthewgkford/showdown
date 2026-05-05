import type { Outcome } from "@/lib/game";

// Batter stats accumulated across at-bats. Rate stats (AVG/OBP/SLG)
// are derived on read — only the raw counts live here.
export type BatterStats = {
  pa: number; // plate appearances
  ab: number; // at-bats (PA minus walks)
  h: number; // hits (1B + 1B+ + 2B + 3B + HR)
  doubles: number;
  triples: number;
  hr: number;
  bb: number; // walks
  so: number;
  rbi: number; // runs batted in (we count any run that scored on the play)
};

export type PitcherStats = {
  outs: number; // total outs recorded — IP = outs / 3
  bf: number; // batters faced
  h: number; // hits allowed
  bb: number;
  k: number;
  hr: number; // home runs allowed
  r: number; // runs allowed (we don't track ER separately — no errors)
};

export const EMPTY_BATTER_STATS: BatterStats = {
  pa: 0,
  ab: 0,
  h: 0,
  doubles: 0,
  triples: 0,
  hr: 0,
  bb: 0,
  so: 0,
  rbi: 0,
};

export const EMPTY_PITCHER_STATS: PitcherStats = {
  outs: 0,
  bf: 0,
  h: 0,
  bb: 0,
  k: 0,
  hr: 0,
  r: 0,
};

const HIT_OUTCOMES: ReadonlySet<Outcome> = new Set([
  "single",
  "singlePlus",
  "double",
  "triple",
  "homer",
]);

const OUT_OUTCOMES: ReadonlySet<Outcome> = new Set(["so", "gb", "fb", "pu"]);

// Apply a single at-bat outcome to a batter's running stats. Pure —
// returns a new BatterStats. `runsScored` is the number of runs that
// scored on this play (counts toward RBI).
export function applyOutcomeToBatter(
  stats: BatterStats,
  outcome: Outcome,
  runsScored: number,
): BatterStats {
  const isWalk = outcome === "bb";
  return {
    pa: stats.pa + 1,
    ab: stats.ab + (isWalk ? 0 : 1),
    h: stats.h + (HIT_OUTCOMES.has(outcome) ? 1 : 0),
    doubles: stats.doubles + (outcome === "double" ? 1 : 0),
    triples: stats.triples + (outcome === "triple" ? 1 : 0),
    hr: stats.hr + (outcome === "homer" ? 1 : 0),
    bb: stats.bb + (isWalk ? 1 : 0),
    so: stats.so + (outcome === "so" ? 1 : 0),
    rbi: stats.rbi + runsScored,
  };
}

export function applyOutcomeToPitcher(
  stats: PitcherStats,
  outcome: Outcome,
  runsScored: number,
): PitcherStats {
  return {
    outs: stats.outs + (OUT_OUTCOMES.has(outcome) ? 1 : 0),
    bf: stats.bf + 1,
    h: stats.h + (HIT_OUTCOMES.has(outcome) ? 1 : 0),
    bb: stats.bb + (outcome === "bb" ? 1 : 0),
    k: stats.k + (outcome === "so" ? 1 : 0),
    hr: stats.hr + (outcome === "homer" ? 1 : 0),
    r: stats.r + runsScored,
  };
}

// Combine two stat blobs (e.g., merging a single-game blob into a
// running season blob).
export function addBatterStats(a: BatterStats, b: BatterStats): BatterStats {
  return {
    pa: a.pa + b.pa,
    ab: a.ab + b.ab,
    h: a.h + b.h,
    doubles: a.doubles + b.doubles,
    triples: a.triples + b.triples,
    hr: a.hr + b.hr,
    bb: a.bb + b.bb,
    so: a.so + b.so,
    rbi: a.rbi + b.rbi,
  };
}

export function addPitcherStats(
  a: PitcherStats,
  b: PitcherStats,
): PitcherStats {
  return {
    outs: a.outs + b.outs,
    bf: a.bf + b.bf,
    h: a.h + b.h,
    bb: a.bb + b.bb,
    k: a.k + b.k,
    hr: a.hr + b.hr,
    r: a.r + b.r,
  };
}

// ─── Derived stats ──────────────────────────────────────────────────

export function batterAvg(stats: BatterStats): number {
  return stats.ab > 0 ? stats.h / stats.ab : 0;
}

// On-base percentage: (H + BB) / (AB + BB). HBP and SF would normally
// be in here too, but we don't track them.
export function batterObp(stats: BatterStats): number {
  const denom = stats.ab + stats.bb;
  return denom > 0 ? (stats.h + stats.bb) / denom : 0;
}

// Slugging: total bases / AB. 1B = h - 2B - 3B - HR.
export function batterSlg(stats: BatterStats): number {
  if (stats.ab === 0) return 0;
  const singles = stats.h - stats.doubles - stats.triples - stats.hr;
  const tb = singles + 2 * stats.doubles + 3 * stats.triples + 4 * stats.hr;
  return tb / stats.ab;
}

export function batterOps(stats: BatterStats): number {
  return batterObp(stats) + batterSlg(stats);
}

// ERA: earned runs × 9 / IP. Since IP = outs/3, ERA = r × 27 / outs.
export function pitcherEra(stats: PitcherStats): number {
  return stats.outs > 0 ? (stats.r * 27) / stats.outs : 0;
}

// WHIP: (BB + H) / IP. = (bb + h) × 3 / outs.
export function pitcherWhip(stats: PitcherStats): number {
  return stats.outs > 0 ? ((stats.bb + stats.h) * 3) / stats.outs : 0;
}

// ─── Display helpers ────────────────────────────────────────────────

// "0.333" → ".333" (drop the leading zero, baseball convention).
export function formatAvg(stats: BatterStats): string {
  if (stats.ab === 0) return ".000";
  return batterAvg(stats).toFixed(3).replace(/^0/, "");
}

export function formatObp(stats: BatterStats): string {
  if (stats.ab + stats.bb === 0) return ".000";
  return batterObp(stats).toFixed(3).replace(/^0/, "");
}

export function formatSlg(stats: BatterStats): string {
  if (stats.ab === 0) return ".000";
  return batterSlg(stats).toFixed(3).replace(/^0/, "");
}

export function formatEra(stats: PitcherStats): string {
  if (stats.outs === 0) return "—";
  return pitcherEra(stats).toFixed(2);
}

export function formatWhip(stats: PitcherStats): string {
  if (stats.outs === 0) return "—";
  return pitcherWhip(stats).toFixed(2);
}

// "12.1" — full innings + remainder outs in baseball format (.0/.1/.2).
export function formatIp(stats: PitcherStats): string {
  const full = Math.floor(stats.outs / 3);
  const remainder = stats.outs % 3;
  return `${full}.${remainder}`;
}
