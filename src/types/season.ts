import type { ScheduledGame } from "@/types/schedule";

// Season state — the player's career snapshot. Persisted in localStorage
// under "showdown:season".
//
// Stage 4 added the schedule + game results. The schedule contains all 90
// canonical games for the league (10 teams × double round-robin). The
// player only plays the 18 involving their team interactively; the other
// 72 are auto-simulated when the player advances rounds.
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
  // 90 canonical games — the full league schedule. Game results (interactive
  // for the player, simulated for everyone else) get filled in over time.
  // Generated once at startSeason() and then mutated in place via
  // recordPlayerGame() / advanceRound().
  schedule: ScheduledGame[];
};
