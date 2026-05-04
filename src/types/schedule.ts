// One scheduled matchup between two teams.
//
// 10 teams × double round-robin (each pair plays once at home + once away)
// = 90 games across 18 rounds (5 games per round). The player participates
// in 18 of those (9 home + 9 away); the other 72 are background games that
// get auto-simulated to keep division standings honest.
export type ScheduledGame = {
  // 1..18. One round = one "week" of the season; each team plays once
  // per round.
  round: number;
  // Slugs from data/teams.json.
  awaySlug: string;
  homeSlug: string;
  // Filled in once the game has been played (interactively for the
  // player's matchups, or via the headless simulator for the others).
  result: GameResult | null;
};

export type GameResult = {
  awayRuns: number;
  homeRuns: number;
  // Convenience — derivable from the runs but cheap to denormalise.
  winner: "home" | "away";
};
