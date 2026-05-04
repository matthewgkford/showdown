import leaguesData from "@data/leagues.json";
import type { Card, BatterCard, PitcherCard } from "@/types/card";
import type { League } from "@/types/league";

const LEAGUES = leaguesData as League[];

export function getAllLeagues(): League[] {
  return LEAGUES;
}

export function getLeagueByTier(tier: number): League | null {
  return LEAGUES.find((l) => l.tier === tier) ?? null;
}

export function getCurrentLeague(currentTier: number): League | null {
  return getLeagueByTier(currentTier);
}

export function getNextLeague(currentTier: number): League | null {
  return LEAGUES.find((l) => l.tier === currentTier + 1) ?? null;
}

// Apply a tier's powerLevel multiplier to a card. The result is a new card —
// inputs are never mutated.
//
// Why this exists: opponent rosters are defined once and shared across all
// league tiers. Tier 1 (Single-A) uses raw stats. Tier 2 (Double-A) scales
// the same roster definitions up by 1.4× so the same hand-picked cards get
// tougher across the ladder. The player's own roster never goes through
// this — players gain power by collecting better cards from packs, not by
// auto-scaling.
//
// Scaling design choices:
// - For batters: scale `onBase`. A higher OB makes the pitcher's job harder.
// - For pitchers: scale `control`. Higher control → more pitcher-advantage
//   rolls → more outs.
// - Chart values do NOT scale: they're d20 ranges 1-20 by definition and
//   scaling them would corrupt the lookup. This means a Tier 2 card has the
//   same outcome distribution per advantage holder; only the advantage
//   probability shifts. Feels right — a tougher league has tougher pitchers
//   and harder-to-strike-out batters, not different result tables.
// - We round to the nearest integer to keep the d20 math clean. Capping is
//   intentional NOT applied — at very high tiers an OB can technically
//   exceed 20, which means the batter wins every advantage roll. That's a
//   feature for distant tiers, not a bug.
export function applyPowerLevel<T extends Card>(card: T, powerLevel: number): T {
  if (powerLevel === 1.0) return card;
  if (card.cardType === "batter") {
    const b = card as BatterCard;
    return {
      ...b,
      onBase: Math.round(b.onBase * powerLevel),
    } as T;
  }
  const p = card as PitcherCard;
  return {
    ...p,
    control: Math.round(p.control * powerLevel),
  } as T;
}
