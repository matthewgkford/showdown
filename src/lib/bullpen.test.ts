import { describe, expect, it } from "vitest";
import { pickReliever } from "./bullpen";
import type { PitcherCard, PitcherChart } from "@/types/card";

const EMPTY_CHART: PitcherChart = {
  pu: null,
  so: null,
  gb: null,
  fb: null,
  bb: null,
  single: null,
  double: null,
  homer: null,
};

function p(
  id: string,
  type: "starter" | "reliever" | "closer",
): PitcherCard {
  return {
    id,
    name: id,
    year: 2025,
    team: "TST",
    teamFullName: "Test",
    set: "2001",
    points: 200,
    cardType: "pitcher",
    control: 3,
    throws: "R",
    pitcherType: type,
    ip: 1,
    chart: EMPTY_CHART,
  };
}

describe("pickReliever", () => {
  it("returns null for empty bullpen", () => {
    expect(pickReliever([], 5)).toBeNull();
  });

  it("picks a regular reliever in early innings, saving the closer", () => {
    const bullpen = [p("clo", "closer"), p("rel", "reliever")];
    expect(pickReliever(bullpen, 6)?.id).toBe("rel");
  });

  it("picks the closer in the 9th when one is available", () => {
    const bullpen = [p("rel", "reliever"), p("clo", "closer")];
    expect(pickReliever(bullpen, 9)?.id).toBe("clo");
  });

  it("picks the closer in extras when one is available", () => {
    const bullpen = [p("rel", "reliever"), p("clo", "closer")];
    expect(pickReliever(bullpen, 11)?.id).toBe("clo");
  });

  it("falls back to whatever is left when the preferred bucket is empty", () => {
    // 9th inning but no closer available — use a reliever
    const justRelievers = [p("rel1", "reliever"), p("rel2", "reliever")];
    expect(pickReliever(justRelievers, 9)?.id).toBe("rel1");

    // Earlier inning but only a closer left — use them
    const justCloser = [p("clo", "closer")];
    expect(pickReliever(justCloser, 5)?.id).toBe("clo");
  });
});
