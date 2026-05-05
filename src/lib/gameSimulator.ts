import { playAtBat } from "@/lib/game";
import {
  type GameState,
  type TeamSetup,
  applyAtBatOutcome,
  changePitcher,
  checkGameOver,
  currentBatter,
  currentPitcher,
  fieldingTeam,
  pitcherFatigue,
  startGame,
} from "@/lib/gameState";
import type { EffectiveRoster } from "@/types/roster";
import { pickReliever } from "@/lib/bullpen";
import type { Team } from "@/types/team";
import type { GameResult } from "@/types/schedule";

// Maximum at-bats before we bail out. A normal 9-inning game runs ~80 at-bats;
// extras can push higher, but this guards against any pathological state where
// nobody can record an out.
const SAFETY_AT_BATS = 600;

// Build the TeamSetup the engine expects from a roster + team metadata.
// Bench is empty — season rosters are 9 batters + 1 SP + 3 RP, no bench.
function setupFromRoster(team: Team, roster: EffectiveRoster): TeamSetup {
  return {
    team,
    lineup: roster.batters,
    bench: [],
    pitcher: roster.startingPitcher,
    bullpen: roster.relievers,
  };
}

// Run the whole game headless and return the final score + winner.
// Uses the same engine as the live UI so simulated games feel consistent
// with player-played ones. The auto-manager swaps in the next reliever
// the moment the current pitcher would take a fatigue penalty, mirroring
// what a sensible player would do.
export function simulateGame(
  awayTeam: Team,
  awayRoster: EffectiveRoster,
  homeTeam: Team,
  homeRoster: EffectiveRoster,
): GameResult {
  let state: GameState = startGame(
    setupFromRoster(awayTeam, awayRoster),
    setupFromRoster(homeTeam, homeRoster),
  );

  for (let i = 0; i < SAFETY_AT_BATS; i++) {
    if (checkGameOver(state)) break;

    state = autoManagePitcher(state);

    const pitcher = currentPitcher(state);
    const batter = currentBatter(state);
    const fatigue = pitcherFatigue(fieldingTeam(state), state.inning);
    const { outcome } = playAtBat(pitcher, batter, Math.random, fatigue);
    state = applyAtBatOutcome(state, outcome);
  }

  const winner = state.home.runs > state.away.runs ? "home" : "away";
  return {
    awayRuns: state.away.runs,
    homeRuns: state.home.runs,
    winner,
  };
}

// If the fielding pitcher is already fatigued and the bullpen has fresh
// arms, swap in the next reliever before the at-bat starts. This is the
// engine-level equivalent of the player tapping "Sub" — silent, automatic.
function autoManagePitcher(state: GameState): GameState {
  const fielding = fieldingTeam(state);
  const fatigue = pitcherFatigue(fielding, state.inning);
  if (fatigue > 0 && fielding.bullpen.length > 0) {
    const next = pickReliever(fielding.bullpen, state.inning);
    if (!next) return state;
    const fieldingSide: "home" | "away" = state.half === "top" ? "home" : "away";
    return changePitcher(state, fieldingSide, next.id);
  }
  return state;
}

