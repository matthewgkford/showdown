import {
  EMPTY_BATTER_STATS,
  EMPTY_PITCHER_STATS,
  addBatterStats,
  addPitcherStats,
  type BatterStats,
  type PitcherStats,
} from "@/lib/stats";

// Per-card running totals for the current season — both the player's
// real games and the auto-simulated background games contribute. Stored
// in localStorage so leaderboards survive page reloads.
const KEY = "showdown:season-stats";

export type SeasonStats = {
  // Map cardId → accumulated batter stats. Pitchers may also appear
  // here if they've taken an at-bat (rare but possible if a position
  // player pitches; for v1 they won't, but the schema permits it).
  batters: Record<string, BatterStats>;
  pitchers: Record<string, PitcherStats>;
};

// One-shot snapshot of stats from a single completed game — what the
// live game / simulator hands back to be merged in.
export type GameStatsDelta = {
  batters: Record<string, BatterStats>;
  pitchers: Record<string, PitcherStats>;
};

const EMPTY_SEASON_STATS: SeasonStats = { batters: {}, pitchers: {} };

let state: SeasonStats = EMPTY_SEASON_STATS;
let initialized = false;

const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function loadInitial(): void {
  if (initialized) return;
  initialized = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as SeasonStats;
  } catch {
    // Corrupted state — keep empty default.
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota / disabled — silently fail.
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSeasonStatsSnapshot(): SeasonStats {
  loadInitial();
  return state;
}

export function getSeasonStatsServerSnapshot(): SeasonStats {
  return EMPTY_SEASON_STATS;
}

// Add the deltas from a single game to the running season totals,
// then persist + notify. Both the live game and the simulator funnel
// their per-card accumulators here when a game finishes.
export function mergeGameStats(delta: GameStatsDelta): void {
  loadInitial();
  const batters = { ...state.batters };
  for (const [id, d] of Object.entries(delta.batters)) {
    batters[id] = addBatterStats(batters[id] ?? EMPTY_BATTER_STATS, d);
  }
  const pitchers = { ...state.pitchers };
  for (const [id, d] of Object.entries(delta.pitchers)) {
    pitchers[id] = addPitcherStats(pitchers[id] ?? EMPTY_PITCHER_STATS, d);
  }
  state = { batters, pitchers };
  persist();
  notify();
}

export function getBatterStats(cardId: string): BatterStats | null {
  loadInitial();
  return state.batters[cardId] ?? null;
}

export function getPitcherStats(cardId: string): PitcherStats | null {
  loadInitial();
  return state.pitchers[cardId] ?? null;
}

// Wipe everything — called when a new season starts so old totals
// don't leak across.
export function resetSeasonStats(): void {
  state = EMPTY_SEASON_STATS;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }
  notify();
}
