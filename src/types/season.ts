// Season state — the player's career snapshot. Persisted in localStorage
// under "showdown:season". Stage 2 only persists the team choice and the
// current league tier; Stage 4 will extend this with schedule, completed
// games, division standings, and careerHistory once the schedule generator
// lands.
export type SeasonState = {
  // Slug of the team the player picked (foreign key to data/teams.json).
  playerTeamSlug: string;
  // Which league tier the player is currently competing in. v1 only ships
  // tier 1 (Single-A) but the field exists from day one so the multi-tier
  // ladder doesn't need a migration later.
  currentLeagueTier: number;
  // ISO timestamp of when this season was started. Used for "you have a
  // season in progress" framing on the choose-team screen.
  startedAt: string;
};
