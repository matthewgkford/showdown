import { describe, expect, it } from "vitest";
import { getRewardPool } from "./rewardPool";
import { getAllRosters } from "./rosters";
import { getCardRarity } from "./rarity";

describe("getRewardPool", () => {
  it("contains exactly the cards not in any starting roster", () => {
    const pool = getRewardPool();
    const rosterIds = new Set<string>();
    for (const r of getAllRosters()) {
      for (const id of r.batters) rosterIds.add(id);
      rosterIds.add(r.startingPitcher);
      for (const id of r.relievers) rosterIds.add(id);
    }
    for (const c of pool) {
      expect(rosterIds.has(c.id)).toBe(false);
    }
  });

  it("has 51 cards", () => {
    expect(getRewardPool()).toHaveLength(51);
  });

  it("returns the same reference on subsequent calls (cached)", () => {
    const a = getRewardPool();
    const b = getRewardPool();
    expect(a).toBe(b);
  });

  it("contains rare and legendary tiers (the elite unlock pile)", () => {
    const pool = getRewardPool();
    const rarities = new Set(pool.map((c) => getCardRarity(c)));
    expect(rarities.has("rare")).toBe(true);
    expect(rarities.has("legendary")).toBe(true);
  });
});
