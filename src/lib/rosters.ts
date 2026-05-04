import cardsData from "@data/cards.json";
import rostersData from "@data/rosters.json";
import { applyPowerLevel, getLeagueByTier } from "@/lib/leagues";
import type { BatterCard, Card, PitcherCard } from "@/types/card";
import type { EffectiveRoster, Roster } from "@/types/roster";

const ROSTERS = rostersData as Roster[];
const CARDS = cardsData as Card[];

const rosterBySlug = new Map(ROSTERS.map((r) => [r.teamSlug, r]));
const cardById = new Map(CARDS.map((c) => [c.id, c]));

export function getAllRosters(): Roster[] {
  return ROSTERS;
}

export function getRoster(teamSlug: string): Roster | null {
  return rosterBySlug.get(teamSlug) ?? null;
}

// Resolves a roster's card ids into actual cards, optionally scaled by the
// powerLevel of the given league tier. The player's own roster should be
// fetched with `tier = playerTier` (no scaling); opponent rosters in a
// season game are fetched with the player's current league tier so the
// powerLevel multiplier from leagues.json applies.
//
// Returns null if the roster doesn't exist or any card id fails to resolve.
export function getEffectiveRoster(
  teamSlug: string,
  leagueTier: number,
): EffectiveRoster | null {
  const roster = getRoster(teamSlug);
  if (!roster) return null;
  const league = getLeagueByTier(leagueTier);
  const power = league?.powerLevel ?? 1.0;

  const batters = roster.batters.map((id) => cardById.get(id));
  const sp = cardById.get(roster.startingPitcher);
  const bullpen = roster.relievers.map((id) => cardById.get(id));
  if (!sp || batters.some((c) => !c) || bullpen.some((c) => !c)) return null;

  return {
    teamSlug,
    batters: batters.map((c) =>
      applyPowerLevel(c as BatterCard, power),
    ) as BatterCard[],
    startingPitcher: applyPowerLevel(sp as PitcherCard, power),
    relievers: bullpen.map((c) =>
      applyPowerLevel(c as PitcherCard, power),
    ) as PitcherCard[],
  };
}

// Sum of card points across the entire roster. Used for power rankings on
// the /standings page. Note: powerLevel scaling does NOT change the card's
// `points` field, so this returns a tier-independent number — to get a
// "league-power-adjusted" score we multiply by the league's powerLevel.
export function getRosterPower(teamSlug: string, leagueTier: number): number {
  const roster = getRoster(teamSlug);
  if (!roster) return 0;
  const league = getLeagueByTier(leagueTier);
  const power = league?.powerLevel ?? 1.0;

  let total = 0;
  for (const id of roster.batters) total += cardById.get(id)?.points ?? 0;
  total += cardById.get(roster.startingPitcher)?.points ?? 0;
  for (const id of roster.relievers) total += cardById.get(id)?.points ?? 0;
  return Math.round(total * power);
}
