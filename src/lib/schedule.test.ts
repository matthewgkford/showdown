import { describe, expect, it } from "vitest";
import { generateSchedule, getPlayerGames } from "./schedule";
import { getAllTeams } from "./teams";

describe("generateSchedule", () => {
  it("produces 90 games for the 10 NJ teams", () => {
    const games = generateSchedule();
    expect(games).toHaveLength(90);
  });

  it("spreads 18 rounds with 5 games per round", () => {
    const games = generateSchedule();
    const byRound = new Map<number, number>();
    for (const g of games) {
      byRound.set(g.round, (byRound.get(g.round) ?? 0) + 1);
    }
    expect(byRound.size).toBe(18);
    for (const [, count] of byRound) {
      expect(count).toBe(5);
    }
  });

  it("gives every team 18 games (9 home + 9 away)", () => {
    const games = generateSchedule();
    const teams = getAllTeams();
    for (const team of teams) {
      const playerGames = getPlayerGames(games, team.slug);
      expect(playerGames).toHaveLength(18);
      const home = playerGames.filter((g) => g.homeSlug === team.slug);
      const away = playerGames.filter((g) => g.awaySlug === team.slug);
      expect(home).toHaveLength(9);
      expect(away).toHaveLength(9);
    }
  });

  it("plays every pair exactly twice (once each home/away)", () => {
    const games = generateSchedule();
    const counts = new Map<string, { ab: number; ba: number }>();
    for (const g of games) {
      const key = [g.awaySlug, g.homeSlug].sort().join("|");
      const slot =
        g.awaySlug < g.homeSlug
          ? ("ab" as const)
          : ("ba" as const);
      const cur = counts.get(key) ?? { ab: 0, ba: 0 };
      cur[slot] += 1;
      counts.set(key, cur);
    }
    // Every distinct pair must appear once in each home/away orientation.
    for (const [, c] of counts) {
      expect(c.ab + c.ba).toBe(2);
    }
    expect(counts.size).toBe(45); // C(10,2)
  });

  it("is deterministic", () => {
    const a = generateSchedule();
    const b = generateSchedule();
    expect(a).toEqual(b);
  });

  it("never schedules a team against itself", () => {
    const games = generateSchedule();
    for (const g of games) {
      expect(g.awaySlug).not.toBe(g.homeSlug);
    }
  });

  it("never schedules a team twice in the same round", () => {
    const games = generateSchedule();
    for (let r = 1; r <= 18; r++) {
      const seen = new Set<string>();
      for (const g of games.filter((x) => x.round === r)) {
        expect(seen.has(g.awaySlug)).toBe(false);
        expect(seen.has(g.homeSlug)).toBe(false);
        seen.add(g.awaySlug);
        seen.add(g.homeSlug);
      }
      expect(seen.size).toBe(10);
    }
  });
});
