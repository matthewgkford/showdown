import type { BatterCard, ChartRange, PitcherCard } from "@/types/card";

export type Outcome =
  | "so"
  | "gb"
  | "fb"
  | "pu"
  | "bb"
  | "single"
  | "singlePlus"
  | "double"
  | "triple"
  | "homer";

export type Advantage = "pitcher" | "batter";

export type Rng = () => number;

export type AtBatResult = {
  pitchRoll: number;
  pitchTotal: number;
  advantage: Advantage;
  swingRoll: number;
  outcome: Outcome;
};

export function rollD20(rng: Rng = Math.random): number {
  return Math.floor(rng() * 20) + 1;
}

// 2001 set rule: pitcher must beat the batter's on-base value strictly.
// A tie goes to the batter.
export function calculateAdvantage(
  pitcher: PitcherCard,
  batter: BatterCard,
  pitchRoll: number,
): Advantage {
  return pitchRoll + pitcher.control > batter.onBase ? "pitcher" : "batter";
}

export function getOutcome(
  pitcher: PitcherCard,
  batter: BatterCard,
  advantage: Advantage,
  swingRoll: number,
): Outcome {
  const chart = advantage === "pitcher" ? pitcher.chart : batter.chart;
  for (const [key, range] of Object.entries(chart) as [Outcome, ChartRange][]) {
    if (range && swingRoll >= range.min && swingRoll <= range.max) {
      return key;
    }
  }
  throw new Error(
    `No outcome on ${advantage} chart for swingRoll ${swingRoll} ` +
      `(${advantage === "pitcher" ? pitcher.id : batter.id})`,
  );
}

export function playAtBat(
  pitcher: PitcherCard,
  batter: BatterCard,
  rng: Rng = Math.random,
): AtBatResult {
  const pitchRoll = rollD20(rng);
  const pitchTotal = pitchRoll + pitcher.control;
  const advantage = calculateAdvantage(pitcher, batter, pitchRoll);
  const swingRoll = rollD20(rng);
  const outcome = getOutcome(pitcher, batter, advantage, swingRoll);
  return { pitchRoll, pitchTotal, advantage, swingRoll, outcome };
}

const OUTCOME_LABELS: Record<Outcome, string> = {
  so: "Strikeout",
  gb: "Ground out",
  fb: "Fly out",
  pu: "Pop out",
  bb: "Walk",
  single: "Single",
  singlePlus: "Single+",
  double: "Double",
  triple: "Triple",
  homer: "Home run",
};

export function outcomeLabel(o: Outcome): string {
  return OUTCOME_LABELS[o];
}
