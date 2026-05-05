import cardsData from "@data/cards.json";
import { getAllRosters } from "@/lib/rosters";
import type { Card } from "@/types/card";

const ALL_CARDS = cardsData as Card[];

let cachedPool: Card[] | null = null;

// The reward pool is every card in cards.json that's NOT in any team's
// starting roster. With 181 cards in the pool and 130 in the 10 starting
// rosters, this is a fixed 51-card list — currently all rare/legendary
// (the starter rosters were intentionally tuned to leave the elite tier
// for the unlock pool).
//
// Cached at module level — the underlying data is static at build time,
// so the first call computes once and every subsequent call returns the
// same reference.
export function getRewardPool(): Card[] {
  if (cachedPool) return cachedPool;
  const rosterIds = new Set<string>();
  for (const r of getAllRosters()) {
    for (const id of r.batters) rosterIds.add(id);
    rosterIds.add(r.startingPitcher);
    for (const id of r.relievers) rosterIds.add(id);
  }
  cachedPool = ALL_CARDS.filter((c) => !rosterIds.has(c.id));
  return cachedPool;
}
