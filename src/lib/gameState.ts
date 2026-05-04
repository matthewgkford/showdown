import type { BatterCard, PitcherCard } from "@/types/card";
import type { Team } from "@/types/team";
import type { Outcome } from "./game";

export type Half = "top" | "bottom";

export type Bases = {
  first: BatterCard | null;
  second: BatterCard | null;
  third: BatterCard | null;
};

export type TeamState = {
  team: Team;
  lineup: BatterCard[]; // 9 batters in order
  bench: BatterCard[]; // available pinch hitters
  pitcher: PitcherCard;
  bullpen: PitcherCard[]; // available relievers
  pitcherStartedInning: number; // inning the current pitcher entered the game
  battingIndex: number; // 0..lineup.length-1, who's up next
  runs: number;
};

export type GameState = {
  inning: number; // 1-based
  half: Half; // "top" = away batting, "bottom" = home batting
  outs: number; // 0..2 (3 triggers half-inning end and resets to 0)
  bases: Bases;
  away: TeamState;
  home: TeamState;
};

export const EMPTY_BASES: Bases = { first: null, second: null, third: null };

export type TeamSetup = {
  team: Team;
  lineup: BatterCard[];
  bench: BatterCard[];
  pitcher: PitcherCard;
  bullpen: PitcherCard[];
};

export function startGame(away: TeamSetup, home: TeamSetup): GameState {
  return {
    inning: 1,
    half: "top",
    outs: 0,
    bases: EMPTY_BASES,
    away: { ...away, pitcherStartedInning: 1, battingIndex: 0, runs: 0 },
    home: { ...home, pitcherStartedInning: 1, battingIndex: 0, runs: 0 },
  };
}

export function currentBatter(state: GameState): BatterCard {
  const team = battingTeam(state);
  return team.lineup[team.battingIndex];
}

export function currentPitcher(state: GameState): PitcherCard {
  return state.half === "top" ? state.home.pitcher : state.away.pitcher;
}

export function battingTeam(state: GameState): TeamState {
  return state.half === "top" ? state.away : state.home;
}

export function fieldingTeam(state: GameState): TeamState {
  return state.half === "top" ? state.home : state.away;
}

const OUT_OUTCOMES: ReadonlySet<Outcome> = new Set(["so", "gb", "fb", "pu"]);

// Apply the outcome of one at-bat to the game state and return the next state.
// Pure function: does not mutate input.
//
// Baserunning per 2001 Showdown:
//   single     — runners +1 base, batter to 1st
//   singlePlus — runners +2 bases, batter to 1st
//   double     — runners +2 bases, batter to 2nd
//   triple     — runners all score, batter to 3rd
//   homer      — runners + batter all score
//   bb         — batter to 1st; runners advance only if forced
//   so/gb/fb/pu — out, no advance
export function applyAtBatOutcome(state: GameState, outcome: Outcome): GameState {
  const team = battingTeam(state);
  const batter = team.lineup[team.battingIndex];

  let { first, second, third } = state.bases;
  let runsScored = 0;

  switch (outcome) {
    case "homer":
      runsScored = 1 + onBaseCount(first, second, third);
      first = null;
      second = null;
      third = null;
      break;
    case "triple":
      runsScored = onBaseCount(first, second, third);
      first = null;
      second = null;
      third = batter;
      break;
    case "double":
      runsScored = (third ? 1 : 0) + (second ? 1 : 0);
      third = first;
      second = batter;
      first = null;
      break;
    case "singlePlus":
      runsScored = (third ? 1 : 0) + (second ? 1 : 0);
      third = first;
      second = null;
      first = batter;
      break;
    case "single":
      runsScored = third ? 1 : 0;
      third = second;
      second = first;
      first = batter;
      break;
    case "bb":
      // Walk: only forced runners advance.
      if (first && second && third) {
        runsScored = 1;
        third = second;
        second = first;
        first = batter;
      } else if (first && second) {
        third = second;
        second = first;
        first = batter;
      } else if (first) {
        second = first;
        first = batter;
      } else {
        first = batter;
      }
      break;
    // Outs: no base or run change.
    case "so":
    case "gb":
    case "fb":
    case "pu":
      break;
  }

  const isOut = OUT_OUTCOMES.has(outcome);
  let newOuts = state.outs + (isOut ? 1 : 0);
  let newHalf: Half = state.half;
  let newInning = state.inning;
  let newBases: Bases = { first, second, third };

  if (newOuts >= 3) {
    newOuts = 0;
    newBases = EMPTY_BASES;
    if (state.half === "top") {
      newHalf = "bottom";
    } else {
      newHalf = "top";
      newInning += 1;
    }
  }

  const updatedTeam: TeamState = {
    ...team,
    battingIndex: (team.battingIndex + 1) % team.lineup.length,
    runs: team.runs + runsScored,
  };

  return {
    inning: newInning,
    half: newHalf,
    outs: newOuts,
    bases: newBases,
    away: state.half === "top" ? updatedTeam : state.away,
    home: state.half === "bottom" ? updatedTeam : state.home,
  };
}

// Cumulative fatigue penalty per the 2001 set rules: a pitcher pitches
// normally up to and including their IP-th inning of work; every inning
// beyond that subtracts 1 from their pitch rolls.
//
// inningsPitched = currentInning - team.pitcherStartedInning + 1
// fatigue        = max(0, inningsPitched - pitcher.ip)
//
// Example: starter, IP 7, currentInning 9 → 9 innings pitched, fatigue 2.
// Example: reliever entered in inning 6, currentInning 8, IP 4 → pitched
// 3 innings, fatigue 0.
export function pitcherFatigue(team: TeamState, currentInning: number): number {
  const inningsPitched = currentInning - team.pitcherStartedInning + 1;
  return Math.max(0, inningsPitched - team.pitcher.ip);
}

function onBaseCount(
  first: BatterCard | null,
  second: BatterCard | null,
  third: BatterCard | null,
): number {
  return (first ? 1 : 0) + (second ? 1 : 0) + (third ? 1 : 0);
}

// Substitutions are one-way per the 2001 rules — once a player is removed
// they don't come back. The new pitcher's clock starts at the current
// inning so fatigue resets.
export function changePitcher(
  state: GameState,
  side: "home" | "away",
  newPitcherId: string,
): GameState {
  const team = state[side];
  const next = team.bullpen.find((p) => p.id === newPitcherId);
  if (!next) return state;
  const updated: TeamState = {
    ...team,
    pitcher: next,
    pitcherStartedInning: state.inning,
    bullpen: team.bullpen.filter((p) => p.id !== newPitcherId),
  };
  return { ...state, [side]: updated };
}

// Pinch hitter takes the lineup slot of whoever's currently up; the
// player they replaced is finished for the game.
export function pinchHit(
  state: GameState,
  side: "home" | "away",
  newBatterId: string,
): GameState {
  const team = state[side];
  const next = team.bench.find((b) => b.id === newBatterId);
  if (!next) return state;
  const lineup = team.lineup.slice();
  lineup[team.battingIndex] = next;
  const updated: TeamState = {
    ...team,
    lineup,
    bench: team.bench.filter((b) => b.id !== newBatterId),
  };
  return { ...state, [side]: updated };
}

export type GameOverResult = { winner: "home" | "away" };

// Detect game-over per regulation rules (no extras yet — a tied state
// after 9 innings returns null and play continues until someone leads).
//
//   - If we're in the bottom of the 9th (or later) and home leads, the
//     game ends. Covers both walk-offs and "home was leading at the
//     start of the bottom of the 9th, so the bottom isn't played."
//   - Otherwise, if the bottom of the 9th has finished (state has moved
//     to the top of the 10th) and someone leads, that team wins.
export function checkGameOver(state: GameState): GameOverResult | null {
  const { half, inning, away, home } = state;

  if (half === "bottom" && inning >= 9 && home.runs > away.runs) {
    return { winner: "home" };
  }

  if (half === "top" && inning >= 10) {
    if (home.runs > away.runs) return { winner: "home" };
    if (away.runs > home.runs) return { winner: "away" };
  }

  return null;
}
