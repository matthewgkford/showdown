import { getAllTeams } from "@/lib/teams";
import type { ScheduledGame } from "@/types/schedule";

// Generate a deterministic 90-game double round-robin for the 10 NJ teams.
//
// Algorithm: classic "circle method". We fix team 0 in place and rotate
// the remaining 9 around it. Each round produces 5 pairings; with 10
// teams this gives 9 unique-pairing rounds where every team plays every
// other team exactly once. We then run a second cycle of 9 rounds with
// the same pairings but home/away flipped — giving each team 9 home + 9
// away games for an 18-game season.
//
// Determinism: same input team list = same schedule. The schedule does
// NOT depend on which team the player picked; the player's view (their
// own 18 games) is just a filter over the canonical 90.
export function generateSchedule(): ScheduledGame[] {
  const teams = getAllTeams().map((t) => t.slug);
  const N = teams.length;
  if (N % 2 !== 0) {
    throw new Error(`generateSchedule expects an even team count, got ${N}`);
  }

  const games: ScheduledGame[] = [];
  const ROUNDS_PER_CYCLE = N - 1; // 9 for 10 teams

  for (let cycle = 0; cycle < 2; cycle++) {
    for (let round = 0; round < ROUNDS_PER_CYCLE; round++) {
      const roundNum = cycle * ROUNDS_PER_CYCLE + round + 1; // 1..18

      // Build pairings for this round using the circle method.
      // Team 0 is fixed; teams 1..N-1 occupy rotating slots.
      // Slot mapping for round r: position 0 holds team 0; position
      // i (i=1..N-1) holds team ((round + i - 1) mod (N-1)) + 1.
      // Pairings are positions (0,N-1), (1,N-2), (2,N-3), ...
      const slotToTeam: number[] = [0];
      for (let i = 1; i < N; i++) {
        slotToTeam.push(((round + i - 1) % (N - 1)) + 1);
      }

      for (let i = 0; i < N / 2; i++) {
        const a = slotToTeam[i];
        const b = slotToTeam[N - 1 - i];

        // Home/away assignment. In cycle 0, the lower slot is home;
        // in cycle 1, flip so the same pairing happens reversed.
        // Additionally for slot-0 (team 0) games, alternate by round
        // parity so team 0 doesn't always end up home/away in the
        // same role across the cycle.
        let home: number;
        let away: number;
        if (i === 0) {
          // Match involving the fixed team. Alternate by round parity
          // for fairness within a cycle, then flip for the second cycle.
          const team0IsHome = (round % 2 === 0) !== (cycle === 1);
          home = team0IsHome ? a : b;
          away = team0IsHome ? b : a;
        } else {
          home = cycle === 0 ? a : b;
          away = cycle === 0 ? b : a;
        }

        games.push({
          round: roundNum,
          awaySlug: teams[away],
          homeSlug: teams[home],
          result: null,
        });
      }
    }
  }

  return games;
}

// Player's 18-game schedule view, sorted by round.
export function getPlayerGames(
  games: ScheduledGame[],
  playerSlug: string,
): ScheduledGame[] {
  return games
    .filter((g) => g.awaySlug === playerSlug || g.homeSlug === playerSlug)
    .sort((a, b) => a.round - b.round);
}

// All games scheduled for a particular round. Used when advancing the
// season — after the player plays their round-N game we sim all the
// other round-N games before advancing to round N+1.
export function getGamesInRound(
  games: ScheduledGame[],
  round: number,
): ScheduledGame[] {
  return games.filter((g) => g.round === round);
}

// Find the next unplayed game for the player (smallest round with
// result === null involving the player). Null when the season is over.
export function getNextPlayerGame(
  games: ScheduledGame[],
  playerSlug: string,
): ScheduledGame | null {
  return (
    getPlayerGames(games, playerSlug).find((g) => g.result === null) ?? null
  );
}
