import { describe, expect, it } from "vitest";
import type { Card } from "@/types/card";
import { compareRarity, getCardRarity, sortForReveal } from "./rarity";

function fakeBatter(id: string, points: number): Card {
  return {
    id,
    name: id,
    year: 2001,
    team: "TST",
    teamFullName: "Test",
    set: "2001",
    points,
    cardType: "batter",
    onBase: 9,
    speed: { letter: "C", value: 10 },
    bats: "R",
    positions: [{ position: "DH", fielding: 0 }],
    chart: {
      so: { min: 1, max: 1 },
      gb: null,
      fb: null,
      bb: null,
      single: { min: 2, max: 20 },
      singlePlus: null,
      double: null,
      triple: null,
      homer: null,
    },
  };
}

describe("getCardRarity", () => {
  it.each([
    [320, "common"],
    [399, "common"],
    [400, "uncommon"],
    [499, "uncommon"],
    [500, "rare"],
    [599, "rare"],
    [600, "legendary"],
    [700, "legendary"],
  ] as const)("%i → %s", (points, expected) => {
    expect(getCardRarity(fakeBatter("x", points))).toBe(expected);
  });
});

describe("compareRarity", () => {
  it("ascends common → legendary", () => {
    expect(compareRarity("common", "uncommon")).toBeLessThan(0);
    expect(compareRarity("uncommon", "rare")).toBeLessThan(0);
    expect(compareRarity("rare", "legendary")).toBeLessThan(0);
    expect(compareRarity("legendary", "legendary")).toBe(0);
  });
});

describe("sortForReveal", () => {
  it("commons first, legendary last; ties broken by points ascending", () => {
    const cards = [
      fakeBatter("pedro", 700), // legendary
      fakeBatter("clemens", 350), // common
      fakeBatter("schilling", 450), // uncommon
      fakeBatter("bonds", 650), // legendary
      fakeBatter("manny", 560), // rare
    ];
    const ids = sortForReveal(cards).map((c) => c.id);
    expect(ids).toEqual(["clemens", "schilling", "manny", "bonds", "pedro"]);
  });

  it("does not mutate the input array", () => {
    const cards = [fakeBatter("a", 700), fakeBatter("b", 350)];
    const original = [...cards];
    sortForReveal(cards);
    expect(cards).toEqual(original);
  });
});
