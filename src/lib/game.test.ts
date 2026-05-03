import { describe, expect, it } from "vitest";
import type { BatterCard, PitcherCard } from "@/types/card";
import {
  calculateAdvantage,
  getOutcome,
  playAtBat,
  rollD20,
  type Rng,
} from "./game";

const pedro: PitcherCard = {
  id: "pedro-bos",
  name: "Pedro Martinez",
  year: 2001,
  team: "BOS",
  teamFullName: "Boston Red Sox",
  set: "2001",
  points: 700,
  cardType: "pitcher",
  control: 5,
  throws: "R",
  pitcherType: "starter",
  ip: 7,
  chart: {
    pu: { min: 1, max: 2 },
    so: { min: 3, max: 10 },
    gb: { min: 11, max: 14 },
    fb: { min: 15, max: 17 },
    bb: { min: 18, max: 18 },
    single: { min: 19, max: 20 },
    double: null,
    homer: null,
  },
};

const lindor: BatterCard = {
  id: "lindor-2025-nym",
  name: "Francisco Lindor",
  year: 2025,
  team: "NYM",
  teamFullName: "New York Mets",
  set: "2001",
  points: 400,
  cardType: "batter",
  onBase: 10,
  speed: { letter: "A", value: 20 },
  bats: "S",
  positions: [{ position: "SS", fielding: 3 }],
  chart: {
    so: { min: 1, max: 2 },
    gb: { min: 3, max: 3 },
    fb: { min: 4, max: 6 },
    bb: { min: 7, max: 10 },
    single: { min: 11, max: 14 },
    singlePlus: { min: 15, max: 16 },
    double: { min: 17, max: 18 },
    triple: null,
    homer: { min: 19, max: 20 },
  },
};

const giambi: BatterCard = {
  id: "giambi-oak",
  name: "Jason Giambi",
  year: 2001,
  team: "OAK",
  teamFullName: "Oakland Athletics",
  set: "2001",
  points: 570,
  cardType: "batter",
  onBase: 11,
  speed: { letter: "C", value: 10 },
  bats: "L",
  positions: [{ position: "1B", fielding: 0 }],
  chart: {
    so: { min: 1, max: 1 },
    gb: null,
    fb: { min: 2, max: 2 },
    bb: { min: 3, max: 11 },
    single: { min: 12, max: 16 },
    singlePlus: null,
    double: { min: 17, max: 17 },
    triple: null,
    homer: { min: 18, max: 20 },
  },
};

// Returns a controlled RNG that yields each value in turn (each value is the
// d20 roll the test wants — the function converts it back to a 0..1 range).
function seededRng(d20Rolls: number[]): Rng {
  const queue = [...d20Rolls];
  return () => {
    const next = queue.shift();
    if (next === undefined) throw new Error("seededRng exhausted");
    // rollD20 does Math.floor(rng() * 20) + 1, so to produce roll N we need
    // rng() in [(N-1)/20, N/20). Pick the midpoint.
    return (next - 1) / 20 + 0.5 / 20;
  };
}

describe("rollD20", () => {
  it("returns 1..20 inclusive", () => {
    for (let i = 0; i < 1000; i++) {
      const r = rollD20();
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(20);
      expect(Number.isInteger(r)).toBe(true);
    }
  });

  it("respects the seeded RNG", () => {
    const rng = seededRng([1, 7, 20]);
    expect(rollD20(rng)).toBe(1);
    expect(rollD20(rng)).toBe(7);
    expect(rollD20(rng)).toBe(20);
  });
});

describe("calculateAdvantage", () => {
  it("Pedro (control 5) needs >5 to beat Lindor (OB 10): pitchRoll 6 → batter", () => {
    // pitchRoll 6 + control 5 = 11; batter OB 10 → 11 > 10 → pitcher
    expect(calculateAdvantage(pedro, lindor, 6)).toBe("pitcher");
  });

  it("Pedro vs Lindor: pitchRoll 5 (total 10) ties OB 10 → batter", () => {
    expect(calculateAdvantage(pedro, lindor, 5)).toBe("batter");
  });

  it("Pedro vs Lindor: pitchRoll 4 (total 9) → batter", () => {
    expect(calculateAdvantage(pedro, lindor, 4)).toBe("batter");
  });

  it("Pedro vs Giambi (OB 11): tie at pitchRoll 6 → batter", () => {
    expect(calculateAdvantage(pedro, giambi, 6)).toBe("batter");
    expect(calculateAdvantage(pedro, giambi, 7)).toBe("pitcher");
  });
});

describe("getOutcome — pitcher chart (Pedro)", () => {
  it.each([
    [1, "pu"],
    [2, "pu"],
    [3, "so"],
    [10, "so"],
    [11, "gb"],
    [14, "gb"],
    [15, "fb"],
    [17, "fb"],
    [18, "bb"],
    [19, "single"],
    [20, "single"],
  ] as const)("swingRoll %i → %s", (roll, expected) => {
    expect(getOutcome(pedro, lindor, "pitcher", roll)).toBe(expected);
  });
});

describe("getOutcome — batter chart (Lindor)", () => {
  it.each([
    [1, "so"],
    [2, "so"],
    [3, "gb"],
    [4, "fb"],
    [6, "fb"],
    [7, "bb"],
    [10, "bb"],
    [11, "single"],
    [14, "single"],
    [15, "singlePlus"],
    [16, "singlePlus"],
    [17, "double"],
    [18, "double"],
    [19, "homer"],
    [20, "homer"],
  ] as const)("swingRoll %i → %s", (roll, expected) => {
    expect(getOutcome(pedro, lindor, "batter", roll)).toBe(expected);
  });
});

describe("getOutcome — Giambi has no GB result", () => {
  it("rolls cover every value 1-20 with no gaps", () => {
    const seen = new Set<number>();
    for (let r = 1; r <= 20; r++) {
      const o = getOutcome(pedro, giambi, "batter", r);
      expect(o).toBeTruthy();
      seen.add(r);
    }
    expect(seen.size).toBe(20);
  });
});

describe("playAtBat", () => {
  it("Pedro vs Lindor — pitcher advantage path, swing 3 → SO", () => {
    // pitchRoll 20 + control 5 = 25 > 10 → pitcher; swing 3 hits Pedro.so
    const result = playAtBat(pedro, lindor, seededRng([20, 3]));
    expect(result).toEqual({
      pitchRoll: 20,
      pitchTotal: 25,
      advantage: "pitcher",
      swingRoll: 3,
      outcome: "so",
    });
  });

  it("Pedro vs Lindor — batter advantage path, swing 19 → HR", () => {
    // pitchRoll 1 + control 5 = 6 ≤ 10 → batter; swing 19 hits Lindor.homer
    const result = playAtBat(pedro, lindor, seededRng([1, 19]));
    expect(result).toEqual({
      pitchRoll: 1,
      pitchTotal: 6,
      advantage: "batter",
      swingRoll: 19,
      outcome: "homer",
    });
  });

  it("Pedro vs Giambi — tie on advantage goes to batter", () => {
    // pitchRoll 6 + control 5 = 11 = OB 11 → batter; swing 12 → Giambi single
    const result = playAtBat(pedro, giambi, seededRng([6, 12]));
    expect(result.advantage).toBe("batter");
    expect(result.outcome).toBe("single");
  });
});
