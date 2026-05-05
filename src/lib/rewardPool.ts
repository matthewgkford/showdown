import cardsData from "@data/cards.json";
import { getAllRosters } from "@/lib/rosters";
import { getCardRarity } from "@/lib/rarity";
import type { Card } from "@/types/card";

const ALL_CARDS = cardsData as Card[];

let cachedNonRostered: Card[] | null = null;
let cachedCommon: Card[] | null = null;
let cachedUncommon: Card[] | null = null;
let cachedRare: Card[] | null = null;
let cachedLegendary: Card[] | null = null;

// Cards that aren't on any team's starting roster. Kept for backwards
// compatibility — no longer used by the win-pack roller (which now
// draws from the full pool by rarity).
export function getRewardPool(): Card[] {
  if (cachedNonRostered) return cachedNonRostered;
  const rosterIds = new Set<string>();
  for (const r of getAllRosters()) {
    for (const id of r.batters) rosterIds.add(id);
    rosterIds.add(r.startingPitcher);
    for (const id of r.relievers) rosterIds.add(id);
  }
  cachedNonRostered = ALL_CARDS.filter((c) => !rosterIds.has(c.id));
  return cachedNonRostered;
}

// All cards by rarity, drawn from the full cards.json. Win packs
// roll from these — duplicates with starter rosters are fine.
export function getCommonCards(): Card[] {
  if (cachedCommon) return cachedCommon;
  cachedCommon = ALL_CARDS.filter((c) => getCardRarity(c) === "common");
  return cachedCommon;
}

export function getUncommonCards(): Card[] {
  if (cachedUncommon) return cachedUncommon;
  cachedUncommon = ALL_CARDS.filter((c) => getCardRarity(c) === "uncommon");
  return cachedUncommon;
}

export function getRareCards(): Card[] {
  if (cachedRare) return cachedRare;
  cachedRare = ALL_CARDS.filter((c) => getCardRarity(c) === "rare");
  return cachedRare;
}

export function getLegendaryCards(): Card[] {
  if (cachedLegendary) return cachedLegendary;
  cachedLegendary = ALL_CARDS.filter((c) => getCardRarity(c) === "legendary");
  return cachedLegendary;
}
