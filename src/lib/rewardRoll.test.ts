import { describe, expect, it } from "vitest";
import { rollWinPack } from "./rewardRoll";
import { getRewardPool } from "./rewardPool";
import { getCardRarity } from "./rarity";

// Build a deterministic RNG that walks a fixed sequence of 0..1 values.
// Lets us exercise the hero-bucket branching without flakiness.
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("rollWinPack", () => {
  it("returns 4 unique card ids", () => {
    const ids = rollWinPack();
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });

  it("every card is from the reward pool", () => {
    const poolIds = new Set(getRewardPool().map((c) => c.id));
    for (let i = 0; i < 50; i++) {
      const ids = rollWinPack();
      for (const id of ids) {
        expect(poolIds.has(id)).toBe(true);
      }
    }
  });

  it("hero is legendary when the bias roll lands under the threshold", () => {
    // 0.0 < 0.35 → take from legendary bucket.
    const ids = rollWinPack(seq([0.0, 0.0, 0.0, 0.5, 0.5, 0.5]));
    const cards = getRewardPool().filter((c) => c.id === ids[0]);
    expect(cards).toHaveLength(1);
    expect(getCardRarity(cards[0])).toBe("legendary");
  });

  it("hero is rare when the bias roll lands above the threshold", () => {
    // 0.99 > 0.35 → take from rare bucket.
    const ids = rollWinPack(seq([0.99, 0.0, 0.0, 0.5, 0.5, 0.5]));
    const cards = getRewardPool().filter((c) => c.id === ids[0]);
    expect(cards).toHaveLength(1);
    expect(getCardRarity(cards[0])).toBe("rare");
  });
});
