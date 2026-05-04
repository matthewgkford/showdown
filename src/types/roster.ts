import type { BatterCard, PitcherCard } from "@/types/card";

// A team's hand-picked roster as stored in data/rosters.json. Card slots
// reference card ids only — the card definitions live in cards.json.
//
// 9 batters in batting order, 1 starting pitcher, 3 relievers.
//
// v1 expedient: the bullpen (relievers[]) may include cards whose
// pitcherType is "starter". The card data is unchanged — we just slot
// a starter into a relief role for that team. The Phase 6 fatigue/inning
// engine reads from card stats, not roster slot, so behaviour is correct;
// it just means bullpens may be unusually durable until the card pool has
// more true relievers.
export type Roster = {
  teamSlug: string;
  batters: string[]; // exactly 9 card ids, batting order positions 1-9
  startingPitcher: string; // single card id
  relievers: string[]; // exactly 3 card ids
};

// Roster with cards resolved and (optionally) scaled by powerLevel.
// Returned by getEffectiveRoster — used by the season game flow when
// constructing both lineups for a matchup.
export type EffectiveRoster = {
  teamSlug: string;
  batters: BatterCard[];
  startingPitcher: PitcherCard;
  relievers: PitcherCard[];
};
