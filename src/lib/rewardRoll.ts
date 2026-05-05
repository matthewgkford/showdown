import {
  getCommonCards,
  getLegendaryCards,
  getRareCards,
  getUncommonCards,
} from "@/lib/rewardPool";
import type { Card } from "@/types/card";

export type Rng = () => number;

// Pack tiers — driven by win count. Most wins drop a Bronze pack
// (mostly commons, lottery-ticket vibe). Every 3rd / 5th / 10th win
// upgrades the pack so milestones feel earned.
export type PackTier = "bronze" | "silver" | "gold" | "platinum";

const FILLER_COUNT = 3;
const PACK_SIZE = 1 + FILLER_COUNT;

// Map a player's running win total to the pack they get for THIS win.
// Higher tiers take priority — winning your 10th game is a Platinum,
// not a "Silver, Gold, AND Platinum" overlap.
export function packTierForWinCount(winCount: number): PackTier {
  if (winCount <= 0) return "bronze";
  if (winCount % 10 === 0) return "platinum";
  if (winCount % 5 === 0) return "gold";
  if (winCount % 3 === 0) return "silver";
  return "bronze";
}

// A pack composition: a hero slot (drawn from one of several weighted
// rarity buckets) and a filler pool. The hero is rolled first; fillers
// come from the filler pool, deduped against the hero.
type TierConfig = {
  heroBuckets: { pool: () => Card[]; weight: number }[];
  fillerPool: () => Card[];
};

const TIER_CONFIG: Record<PackTier, TierConfig> = {
  // Bronze: the everyday pack. Mostly commons. Occasional uncommon
  // hero gives the player a borderline-upgrade moment without
  // turning the pull into a guaranteed roster overhaul.
  bronze: {
    heroBuckets: [
      { pool: getCommonCards, weight: 0.7 },
      { pool: getUncommonCards, weight: 0.3 },
    ],
    fillerPool: getCommonCards,
  },
  // Silver: every 3rd win. A guaranteed step up — uncommon-or-rare hero
  // with commons + uncommons as fillers.
  silver: {
    heroBuckets: [
      { pool: getUncommonCards, weight: 0.6 },
      { pool: getRareCards, weight: 0.4 },
    ],
    fillerPool: () => [...getCommonCards(), ...getUncommonCards()],
  },
  // Gold: every 5th win. Now we're hunting rares. Uncommons + rares
  // as fillers; small chance of a legendary hero.
  gold: {
    heroBuckets: [
      { pool: getRareCards, weight: 0.75 },
      { pool: getLegendaryCards, weight: 0.25 },
    ],
    fillerPool: () => [...getUncommonCards(), ...getRareCards()],
  },
  // Platinum: every 10th win. Guaranteed legendary hero, rares +
  // legendaries as fillers. The big reward.
  platinum: {
    heroBuckets: [{ pool: getLegendaryCards, weight: 1 }],
    fillerPool: () => [...getRareCards(), ...getLegendaryCards()],
  },
};

// Draw a 4-card pack of the given tier. Returns card ids in rolled
// order (hero first, then 3 fillers). Pure function — pass an RNG for
// deterministic tests.
export function rollPack(
  tier: PackTier,
  rng: Rng = Math.random,
): string[] {
  const cfg = TIER_CONFIG[tier];

  // Pick hero bucket via weighted choice, then a card from it.
  const r = rng();
  let cum = 0;
  let heroPool: Card[] = cfg.heroBuckets[0].pool();
  for (const bucket of cfg.heroBuckets) {
    cum += bucket.weight;
    if (r < cum) {
      heroPool = bucket.pool();
      break;
    }
  }
  if (heroPool.length === 0) {
    // Shouldn't happen with current data — fall through to fillerPool
    // so we never return fewer than 4 cards.
    heroPool = cfg.fillerPool();
  }
  const hero = heroPool[Math.floor(rng() * heroPool.length)];

  // Fillers — Fisher–Yates partial shuffle for unique sampling. RNG
  // quality doesn't matter; we always make progress per iteration.
  const fillerSource = cfg.fillerPool().filter((c) => c.id !== hero.id);
  const indices = fillerSource.map((_, i) => i);
  const fillers: string[] = [];
  for (let i = 0; i < FILLER_COUNT && i < indices.length; i++) {
    const j = i + Math.floor(rng() * (indices.length - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
    fillers.push(fillerSource[indices[i]].id);
  }
  // Pad with hero re-pick if for some reason we ran out — keeps the
  // contract of "always returns PACK_SIZE ids".
  while (fillers.length < FILLER_COUNT) fillers.push(hero.id);

  return [hero.id, ...fillers];
}

// Convenience colour for the pack tile / open-screen header. Bronze
// stays close to the team accent; higher tiers get their own metallic
// palette so milestones read at a glance.
export function tierAccentColor(tier: PackTier): string {
  switch (tier) {
    case "bronze":
      return "#b45309"; // amber-700, warm copper
    case "silver":
      return "#cbd5e1"; // slate-300, cool silver
    case "gold":
      return "#f59e0b"; // amber-500, gold
    case "platinum":
      return "#a78bfa"; // violet-400, iridescent
  }
}

export function tierLabel(tier: PackTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export { PACK_SIZE };
