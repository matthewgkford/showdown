import { generateSchedule, getNextPlayerGame } from "@/lib/schedule";
import { simulateGame } from "@/lib/gameSimulator";
import { getEffectiveRoster } from "@/lib/rosters";
import {
  packTierForWinCount,
  rollPack,
  tierAccentColor,
} from "@/lib/rewardRoll";
import { grantReward, newInstanceId } from "@/lib/rewards";
import { resetPlayerRoster } from "@/lib/playerRoster";
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

// Slug renames over time. Apply on load so existing saves keep working.
// Currently just one entry from the 2026-05-04 typo fix (skylinders →
// skyliners); add more as needed.
const SLUG_RENAMES: Record<string, string> = {
  skylinders: "skyliners",
};

function rename(slug: string): string {
  return SLUG_RENAMES[slug] ?? slug;
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
      const renamedPlayerSlug = rename(parsed.playerTeamSlug);
      const renamedSchedule = Array.isArray(parsed.schedule)
        ? parsed.schedule.map((g) => ({
            ...g,
            awaySlug: rename(g.awaySlug),
            homeSlug: rename(g.homeSlug),
          }))
        : generateSchedule();
      const needsMigration =
        !Array.isArray(parsed.schedule) ||
        renamedPlayerSlug !== parsed.playerTeamSlug ||
        renamedSchedule.some((g, i) => {
          const orig = parsed.schedule![i];
          return g.awaySlug !== orig.awaySlug || g.homeSlug !== orig.homeSlug;
        });
      seasonState = {
        playerTeamSlug: renamedPlayerSlug,
        currentLeagueTier: parsed.currentLeagueTier,
        startedAt: parsed.startedAt,
        schedule: renamedSchedule,
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
  // Drop any roster override left over from a previous team — it's
  // tied to a specific slug and would be ignored anyway, but clearing
  // keeps localStorage tidy.
  resetPlayerRoster();
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

  // Win reward: if the player won this game, drop a pack into the
  // rewards inventory. The pack contents are rolled at award time and
  // baked in — opening it later just reveals what was already drawn.
  const playerWon =
    (seasonState.playerTeamSlug === awaySlug && result.winner === "away") ||
    (seasonState.playerTeamSlug === homeSlug && result.winner === "home");
  if (playerWon) {
    const opponentSlug =
      seasonState.playerTeamSlug === awaySlug ? homeSlug : awaySlug;
    const opponent = getTeamBySlug(opponentSlug);

    // Count the player's wins so far this season (including this one).
    // Drives which pack tier they get — most wins are Bronze; every
    // 3rd / 5th / 10th tick up to Silver / Gold / Platinum.
    const winCount = updated.filter(
      (g) =>
        g.result &&
        ((g.awaySlug === seasonState!.playerTeamSlug &&
          g.result.winner === "away") ||
          (g.homeSlug === seasonState!.playerTeamSlug &&
            g.result.winner === "home")),
    ).length;
    const tier = packTierForWinCount(winCount);
    grantReward({
      instanceId: newInstanceId(),
      earnedAt: new Date().toISOString(),
      cardIds: rollPack(tier),
      label: opponent
        ? `Round ${round} · vs ${opponent.name}`
        : `Round ${round} win`,
      accentColor: tierAccentColor(tier),
      tier,
    });
  }

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
