import { describe, expect, it } from "vitest";
import {
  packTierForWinCount,
  rollPack,
  tierAccentColor,
  tierLabel,
} from "./rewardRoll";
import {
  getCommonCards,
  getLegendaryCards,
  getRareCards,
  getUncommonCards,
} from "./rewardPool";
import { getCardRarity } from "./rarity";

// Deterministic RNG that walks a fixed sequence of [0, 1) values.
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("packTierForWinCount", () => {
  it("returns bronze for 0 / 1 / 2 wins", () => {
    expect(packTierForWinCount(0)).toBe("bronze");
    expect(packTierForWinCount(1)).toBe("bronze");
    expect(packTierForWinCount(2)).toBe("bronze");
  });

  it("returns silver every 3rd win", () => {
    expect(packTierForWinCount(3)).toBe("silver");
    expect(packTierForWinCount(6)).toBe("silver");
    expect(packTierForWinCount(9)).toBe("silver");
  });

  it("returns gold every 5th win", () => {
    expect(packTierForWinCount(5)).toBe("gold");
    expect(packTierForWinCount(15)).toBe("gold");
  });

  it("returns platinum every 10th win, even when 5/3 also divide", () => {
    expect(packTierForWinCount(10)).toBe("platinum");
    expect(packTierForWinCount(20)).toBe("platinum");
    expect(packTierForWinCount(30)).toBe("platinum");
  });
});

describe("rollPack", () => {
  it("returns 4 card ids", () => {
    expect(rollPack("bronze")).toHaveLength(4);
    expect(rollPack("silver")).toHaveLength(4);
    expect(rollPack("gold")).toHaveLength(4);
    expect(rollPack("platinum")).toHaveLength(4);
  });

  it("bronze hero is common when the bias roll lands in the common bucket", () => {
    // First rng() = 0.0 → falls into the 70% common bucket
    const ids = rollPack("bronze", seq([0.0, 0.0, 0.5, 0.5, 0.5, 0.5]));
    const hero = [...getCommonCards()].find((c) => c.id === ids[0]);
    expect(hero).toBeTruthy();
    expect(getCardRarity(hero!)).toBe("common");
  });

  it("bronze hero is uncommon when the bias roll lands in the uncommon bucket", () => {
    // First rng() = 0.99 → above 0.7 threshold, into uncommon bucket
    const ids = rollPack("bronze", seq([0.99, 0.0, 0.5, 0.5, 0.5, 0.5]));
    const hero = [...getUncommonCards()].find((c) => c.id === ids[0]);
    expect(hero).toBeTruthy();
    expect(getCardRarity(hero!)).toBe("uncommon");
  });

  it("platinum hero is always legendary", () => {
    for (let i = 0; i < 25; i++) {
      const ids = rollPack("platinum");
      const hero = getLegendaryCards().find((c) => c.id === ids[0]);
      expect(hero).toBeTruthy();
    }
  });

  it("gold fillers come from uncommons + rares", () => {
    const eligible = new Set([
      ...getUncommonCards().map((c) => c.id),
      ...getRareCards().map((c) => c.id),
    ]);
    for (let i = 0; i < 10; i++) {
      const ids = rollPack("gold");
      // Hero may be legendary, fillers must be from uncommon/rare
      for (let f = 1; f < ids.length; f++) {
        expect(eligible.has(ids[f])).toBe(true);
      }
    }
  });

  it("returns unique cards within a pack", () => {
    for (let i = 0; i < 25; i++) {
      const ids = rollPack("bronze");
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("tier metadata", () => {
  it("returns a colour for each tier", () => {
    expect(tierAccentColor("bronze")).toMatch(/^#/);
    expect(tierAccentColor("silver")).toMatch(/^#/);
    expect(tierAccentColor("gold")).toMatch(/^#/);
    expect(tierAccentColor("platinum")).toMatch(/^#/);
  });

  it("returns a capitalised label", () => {
    expect(tierLabel("bronze")).toBe("Bronze");
    expect(tierLabel("platinum")).toBe("Platinum");
  });
});
