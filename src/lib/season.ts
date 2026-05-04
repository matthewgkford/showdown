import { generateSchedule, getNextPlayerGame } from "@/lib/schedule";
import { simulateGame } from "@/lib/gameSimulator";
import { getEffectiveRoster } from "@/lib/rosters";
import { getTeamBySlug } from "@/lib/teams";
import type { SeasonState } from "@/types/season";
import type { GameResult, ScheduledGame } from "@/types/schedule";

// localStorage key. Same prefix convention as collection/packs so a future
// backend migration can find them by namespace.
const SEASON_KEY = "showdown:season";

// Module-level singleton, same useSyncExternalStore pattern as lib/collection.
// Mutation functions create new references; getSnapshot returns the same
// reference until something changes.
let seasonState: SeasonState | null = null;
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
    const raw = window.localStorage.getItem(SEASON_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<SeasonState>;
    if (
      typeof parsed.playerTeamSlug === "string" &&
      typeof parsed.currentLeagueTier === "number" &&
      typeof parsed.startedAt === "string"
    ) {
      // Pre-Stage-4 saves don't have a `schedule` field. Generate one
      // on first read so existing seasons keep working without a manual
      // reset, then re-persist.
      const needsMigration = !Array.isArray(parsed.schedule);
      seasonState = {
        playerTeamSlug: parsed.playerTeamSlug,
        currentLeagueTier: parsed.currentLeagueTier,
        startedAt: parsed.startedAt,
        schedule: parsed.schedule ?? generateSchedule(),
      };
      if (needsMigration) persist();
    }
  } catch {
    // Corrupted state — keep null.
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    if (seasonState === null) {
      window.localStorage.removeItem(SEASON_KEY);
    } else {
      window.localStorage.setItem(SEASON_KEY, JSON.stringify(seasonState));
    }
  } catch {
    // Quota / disabled — silently fail.
  }
}

// ─── Subscribe / snapshot API for useSyncExternalStore ──────────────────

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSeasonSnapshot(): SeasonState | null {
  loadInitial();
  return seasonState;
}

// SSR snapshot — must be a stable null. The first client render after
// hydration may swap to a real state if localStorage has one; that's
// expected and triggers a single re-render.
export function getSeasonServerSnapshot(): SeasonState | null {
  return null;
}

// ─── Mutation API ───────────────────────────────────────────────────────

export function startSeason(playerTeamSlug: string): SeasonState {
  loadInitial();
  seasonState = {
    playerTeamSlug,
    currentLeagueTier: 1,
    startedAt: new Date().toISOString(),
    schedule: generateSchedule(),
  };
  persist();
  notify();
  return seasonState;
}

export function resetSeason(): void {
  loadInitial();
  seasonState = null;
  persist();
  notify();
}

// Record the result of a player game (one the user actually played
// through the UI), then auto-simulate every other unplayed game in the
// same round so all 10 teams advance together. Returns the updated state.
//
// awaySlug/homeSlug + round are passed in so we can match the exact
// schedule entry (round-robin guarantees a unique pairing per round).
export function recordPlayerGame(
  awaySlug: string,
  homeSlug: string,
  round: number,
  result: GameResult,
): SeasonState | null {
  loadInitial();
  if (!seasonState) return null;

  const updated = seasonState.schedule.map((g) => {
    if (g.result !== null) return g;
    if (g.round === round) {
      // Player's game — use the result we were handed.
      if (g.awaySlug === awaySlug && g.homeSlug === homeSlug) {
        return { ...g, result };
      }
      // Same round, different matchup — auto-simulate.
      return { ...g, result: simulateRoundGame(g) };
    }
    return g;
  });

  seasonState = { ...seasonState, schedule: updated };
  persist();
  notify();
  return seasonState;
}

// Build effective rosters at the current league tier and run the game
// headlessly. Used for non-player matchups within a round.
//
// IMPORTANT: opponent rosters scale by powerLevel (this matters in tier 2+).
// For tier 1 the multiplier is 1.0, so this is a no-op compared to raw stats.
function simulateRoundGame(g: ScheduledGame): GameResult {
  const tier = seasonState?.currentLeagueTier ?? 1;
  const awayTeam = getTeamBySlug(g.awaySlug);
  const homeTeam = getTeamBySlug(g.homeSlug);
  const awayRoster = getEffectiveRoster(g.awaySlug, tier);
  const homeRoster = getEffectiveRoster(g.homeSlug, tier);

  if (!awayTeam || !homeTeam || !awayRoster || !homeRoster) {
    // Should never happen with current data, but fall back to a 0-0 home
    // win so the schedule stays consistent if something's misconfigured.
    return { awayRuns: 0, homeRuns: 0, winner: "home" };
  }

  return simulateGame(awayTeam, awayRoster, homeTeam, homeRoster);
}

// Convenience accessor — the next un-played game involving the player.
// Returns null when the season is complete.
export function getNextGame(): ScheduledGame | null {
  loadInitial();
  if (!seasonState) return null;
  return getNextPlayerGame(seasonState.schedule, seasonState.playerTeamSlug);
}
