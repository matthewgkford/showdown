import { getAllTeams, getDivisionForTeam } from "@/lib/teams";
import type { ScheduledGame } from "@/types/schedule";

export type TeamRecord = {
  teamSlug: string;
  divisionSlug: string;
  wins: number;
  losses: number;
  // Run differential — total runs scored minus total runs allowed across
  // all completed games. Used as the standings tiebreaker.
  runDifferential: number;
};

// Walk every completed game and tally wins, losses, run differential
// per team. Teams that haven't played yet still appear at 0-0.
export function computeStandings(games: ScheduledGame[]): TeamRecord[] {
  const records = new Map<string, TeamRecord>();
  for (const team of getAllTeams()) {
    records.set(team.slug, {
      teamSlug: team.slug,
      divisionSlug: team.divisionSlug,
      wins: 0,
      losses: 0,
      runDifferential: 0,
    });
  }

  for (const g of games) {
    if (!g.result) continue;
    const away = records.get(g.awaySlug);
    const home = records.get(g.homeSlug);
    if (!away || !home) continue;

    const awayDiff = g.result.awayRuns - g.result.homeRuns;
    away.runDifferential += awayDiff;
    home.runDifferential -= awayDiff;

    if (g.result.winner === "home") {
      home.wins += 1;
      away.losses += 1;
    } else {
      away.wins += 1;
      home.losses += 1;
    }
  }

  return Array.from(records.values());
}

// Sort by wins desc, then run differential desc. Stable enough for v1.
export function rankRecords(records: TeamRecord[]): TeamRecord[] {
  return [...records].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.runDifferential - a.runDifferential;
  });
}

// Group ranked records by division. Each division entry contains the
// division metadata plus its teams, already sorted within division.
export function standingsByDivision(records: TeamRecord[]): {
  divisionSlug: string;
  teams: TeamRecord[];
}[] {
  const ranked = rankRecords(records);
  const byDivision = new Map<string, TeamRecord[]>();
  for (const r of ranked) {
    const division = getDivisionForTeam(r.teamSlug);
    const slug = division?.slug ?? r.divisionSlug;
    if (!byDivision.has(slug)) byDivision.set(slug, []);
    byDivision.get(slug)!.push(r);
  }
  return Array.from(byDivision.entries()).map(([divisionSlug, teams]) => ({
    divisionSlug,
    teams,
  }));
}
