import { describe, expect, it } from "vitest";
import {
  EMPTY_BATTER_STATS,
  EMPTY_PITCHER_STATS,
  addBatterStats,
  addPitcherStats,
  applyOutcomeToBatter,
  applyOutcomeToPitcher,
  batterAvg,
  batterObp,
  batterSlg,
  formatAvg,
  formatEra,
  formatIp,
  pitcherEra,
} from "./stats";

describe("applyOutcomeToBatter", () => {
  it("walks count as PA but not AB", () => {
    const s = applyOutcomeToBatter(EMPTY_BATTER_STATS, "bb", 0);
    expect(s.pa).toBe(1);
    expect(s.ab).toBe(0);
    expect(s.bb).toBe(1);
    expect(s.h).toBe(0);
  });

  it("singles increment H + AB + PA", () => {
    const s = applyOutcomeToBatter(EMPTY_BATTER_STATS, "single", 0);
    expect(s.pa).toBe(1);
    expect(s.ab).toBe(1);
    expect(s.h).toBe(1);
  });

  it("homers credit the HR slot AND H", () => {
    const s = applyOutcomeToBatter(EMPTY_BATTER_STATS, "homer", 1);
    expect(s.h).toBe(1);
    expect(s.hr).toBe(1);
    expect(s.rbi).toBe(1);
  });

  it("strikeouts increment SO + AB but not H", () => {
    const s = applyOutcomeToBatter(EMPTY_BATTER_STATS, "so", 0);
    expect(s.ab).toBe(1);
    expect(s.so).toBe(1);
    expect(s.h).toBe(0);
  });

  it("RBI tracks runs scored on the play, regardless of outcome", () => {
    // Bases-loaded walk drives in 1
    const s = applyOutcomeToBatter(EMPTY_BATTER_STATS, "bb", 1);
    expect(s.rbi).toBe(1);
  });
});

describe("applyOutcomeToPitcher", () => {
  it("counts outs only on out-outcomes", () => {
    let s = EMPTY_PITCHER_STATS;
    s = applyOutcomeToPitcher(s, "so", 0);
    s = applyOutcomeToPitcher(s, "gb", 0);
    s = applyOutcomeToPitcher(s, "single", 0);
    expect(s.outs).toBe(2);
    expect(s.bf).toBe(3);
  });

  it("counts hits, walks, K, HR allowed, runs", () => {
    let s = EMPTY_PITCHER_STATS;
    s = applyOutcomeToPitcher(s, "single", 0);
    s = applyOutcomeToPitcher(s, "homer", 2);
    s = applyOutcomeToPitcher(s, "bb", 0);
    s = applyOutcomeToPitcher(s, "so", 0);
    expect(s.h).toBe(2);
    expect(s.bb).toBe(1);
    expect(s.k).toBe(1);
    expect(s.hr).toBe(1);
    expect(s.r).toBe(2);
  });
});

describe("derived stats", () => {
  it("AVG = H / AB", () => {
    const s = { ...EMPTY_BATTER_STATS, ab: 10, h: 3 };
    expect(batterAvg(s)).toBeCloseTo(0.3);
    expect(formatAvg(s)).toBe(".300");
  });

  it("OBP includes walks", () => {
    const s = { ...EMPTY_BATTER_STATS, ab: 10, h: 3, bb: 2 };
    // (H + BB) / (AB + BB) = 5 / 12 = 0.4167
    expect(batterObp(s)).toBeCloseTo(5 / 12);
  });

  it("SLG weights total bases", () => {
    // 4 AB, 1 single, 1 double, 1 HR, 1 out → TB = 1 + 2 + 4 = 7
    const s = {
      ...EMPTY_BATTER_STATS,
      ab: 4,
      h: 3,
      doubles: 1,
      triples: 0,
      hr: 1,
    };
    expect(batterSlg(s)).toBeCloseTo(7 / 4);
  });

  it("ERA = R * 27 / outs", () => {
    // 9 IP (27 outs), 3 R → 3.00 ERA
    const s = { ...EMPTY_PITCHER_STATS, outs: 27, r: 3 };
    expect(pitcherEra(s)).toBeCloseTo(3.0);
    expect(formatEra(s)).toBe("3.00");
  });

  it("IP formats with .0/.1/.2", () => {
    expect(formatIp({ ...EMPTY_PITCHER_STATS, outs: 18 })).toBe("6.0");
    expect(formatIp({ ...EMPTY_PITCHER_STATS, outs: 19 })).toBe("6.1");
    expect(formatIp({ ...EMPTY_PITCHER_STATS, outs: 20 })).toBe("6.2");
  });

  it("0-AB / 0-IP edge cases stay safe", () => {
    expect(batterAvg(EMPTY_BATTER_STATS)).toBe(0);
    expect(formatAvg(EMPTY_BATTER_STATS)).toBe(".000");
    expect(pitcherEra(EMPTY_PITCHER_STATS)).toBe(0);
    expect(formatEra(EMPTY_PITCHER_STATS)).toBe("—");
  });
});

describe("add helpers", () => {
  it("addBatterStats sums every field", () => {
    const a = { ...EMPTY_BATTER_STATS, pa: 4, ab: 4, h: 1, hr: 1, rbi: 2 };
    const b = { ...EMPTY_BATTER_STATS, pa: 3, ab: 2, h: 1, bb: 1, so: 1 };
    const sum = addBatterStats(a, b);
    expect(sum.pa).toBe(7);
    expect(sum.ab).toBe(6);
    expect(sum.h).toBe(2);
    expect(sum.hr).toBe(1);
    expect(sum.rbi).toBe(2);
    expect(sum.bb).toBe(1);
    expect(sum.so).toBe(1);
  });

  it("addPitcherStats sums every field", () => {
    const a = { ...EMPTY_PITCHER_STATS, outs: 18, bf: 24, k: 6, r: 2 };
    const b = { ...EMPTY_PITCHER_STATS, outs: 9, bf: 12, h: 3, bb: 1, r: 1 };
    const sum = addPitcherStats(a, b);
    expect(sum.outs).toBe(27);
    expect(sum.bf).toBe(36);
    expect(sum.k).toBe(6);
    expect(sum.h).toBe(3);
    expect(sum.bb).toBe(1);
    expect(sum.r).toBe(3);
  });
});
