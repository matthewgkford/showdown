import { describe, expect, it } from "vitest";
import {
  getCommonCards,
  getLegendaryCards,
  getRareCards,
  getRewardPool,
  getUncommonCards,
} from "./rewardPool";
import { getAllRosters } from "./rosters";
import { getCardRarity } from "./rarity";

describe("rarity-split pools", () => {
  it("getCommonCards returns only common-rarity cards", () => {
    const cards = getCommonCards();
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) expect(getCardRarity(c)).toBe("common");
  });

  it("getUncommonCards returns only uncommon-rarity cards", () => {
    const cards = getUncommonCards();
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) expect(getCardRarity(c)).toBe("uncommon");
  });

  it("getRareCards returns only rare-rarity cards", () => {
    const cards = getRareCards();
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) expect(getCardRarity(c)).toBe("rare");
  });

  it("getLegendaryCards returns only legendary-rarity cards", () => {
    const cards = getLegendaryCards();
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) expect(getCardRarity(c)).toBe("legendary");
  });

  it("each pool returns the same reference on subsequent calls (cached)", () => {
    expect(getCommonCards()).toBe(getCommonCards());
    expect(getRareCards()).toBe(getRareCards());
    expect(getLegendaryCards()).toBe(getLegendaryCards());
  });
});

describe("getRewardPool (legacy non-rostered helper)", () => {
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

  it("returns the same reference on subsequent calls (cached)", () => {
    expect(getRewardPool()).toBe(getRewardPool());
  });
});
