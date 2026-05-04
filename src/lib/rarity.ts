import type { Card } from "@/types/card";
import type { Rarity } from "@/types/collection";

// Rarity tiers are derived purely from the card's points value. Bands chosen
// so the seeded card pool (29 cards, 320–700 points) lands at roughly
// 17/45/24/14% common/uncommon/rare/legendary — the four legendaries are
// exactly the four cards over 600 (Delgado 610, A-Rod 640, Bonds 650, Pedro
// 700) which feels right for the "money pull" tier.
//
// To tune later: edit POINTS_BANDS. The rest of the app derives everything
// (sort order, badge styling, reveal pacing) from getCardRarity.
export const POINTS_BANDS = {
  uncommon: 400,
  rare: 500,
  legendary: 600,
} as const;

export function getCardRarity(card: Card): Rarity {
  if (card.points < POINTS_BANDS.uncommon) return "common";
  if (card.points < POINTS_BANDS.rare) return "uncommon";
  if (card.points < POINTS_BANDS.legendary) return "rare";
  return "legendary";
}

// Ascending order — used to sort cards for the pack-reveal sequence so the
// rarest pull is always last.
export const RARITY_ASCENDING: readonly Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "legendary",
];

const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  legendary: 3,
};

export function compareRarity(a: Rarity, b: Rarity): number {
  return RARITY_RANK[a] - RARITY_RANK[b];
}

// Sort ascending by rarity, ties broken by points ascending. This is the
// canonical reveal order: commons first, the highest-points legendary last.
export function sortForReveal(cards: Card[]): Card[] {
  return cards.slice().sort((a, b) => {
    const ra = getCardRarity(a);
    const rb = getCardRarity(b);
    const byRarity = compareRarity(ra, rb);
    if (byRarity !== 0) return byRarity;
    return a.points - b.points;
  });
}

// Display labels (capitalized) and a Tailwind-flavoured class hint that
// pages can use when they want to colour-code rarity badges.
export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
};

export const RARITY_TEXT_CLASS: Record<Rarity, string> = {
  common: "text-zinc-400",
  uncommon: "text-sky-300",
  rare: "text-amber-300",
  legendary: "text-fuchsia-300",
};

export const RARITY_RING_CLASS: Record<Rarity, string> = {
  common: "ring-zinc-700",
  uncommon: "ring-sky-400/60",
  rare: "ring-amber-300/70",
  legendary: "ring-fuchsia-400/70",
};
