import { getCardRarity } from "@/lib/rarity";
import { getRewardPool } from "@/lib/rewardPool";

// 4 cards per win pack: 1 hero + 3 fillers. The hero slot is biased
// toward legendary — wins should feel meaningful, but legendaries
// shouldn't be guaranteed every game.
const HERO_LEGENDARY_CHANCE = 0.35;
const FILLER_COUNT = 3;

export type Rng = () => number;

// Draw a 4-card win pack from the reward pool. Returns card ids in
// rolled order; callers can sortForReveal() if they want canonical
// reveal ordering. Pure function — pass an RNG for deterministic tests.
export function rollWinPack(rng: Rng = Math.random): string[] {
  const pool = getRewardPool();
  if (pool.length < 1 + FILLER_COUNT) {
    throw new Error(
      `rollWinPack: pool too small (${pool.length} cards, need ${
        1 + FILLER_COUNT
      })`,
    );
  }

  // Bucket the pool by rarity for the hero slot. Pool is currently all
  // rare or legendary; the buckets handle whatever the pool actually
  // contains so this stays sane if the roster mix changes later.
  const legendaries = pool.filter((c) => getCardRarity(c) === "legendary");
  const rares = pool.filter((c) => getCardRarity(c) === "rare");

  // Pick the hero. Prefer legendary at HERO_LEGENDARY_CHANCE; fall
  // back to rare otherwise. If a bucket is empty, use whatever's left.
  const goLegendary = rng() < HERO_LEGENDARY_CHANCE;
  const heroBucket =
    (goLegendary && legendaries.length > 0
      ? legendaries
      : rares.length > 0
        ? rares
        : pool);
  const hero = heroBucket[Math.floor(rng() * heroBucket.length)];

  // 3 fillers from the rest of the pool, uniformly random, no dupes.
  // Use Fisher–Yates style partial shuffle: each iteration picks a slot
  // from the unsampled prefix, so we always make progress. Terminates
  // in exactly FILLER_COUNT iterations regardless of RNG quality.
  const remaining = pool.filter((c) => c.id !== hero.id);
  const indices = remaining.map((_, i) => i);
  const fillers: string[] = [];
  for (let i = 0; i < FILLER_COUNT; i++) {
    const j = i + Math.floor(rng() * (indices.length - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
    fillers.push(remaining[indices[i]].id);
  }

  return [hero.id, ...fillers];
}
