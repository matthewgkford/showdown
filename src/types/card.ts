export type ChartRange = { min: number; max: number } | null;

export type BatterChart = {
  so: ChartRange;
  gb: ChartRange;
  fb: ChartRange;
  bb: ChartRange;
  single: ChartRange;
  singlePlus: ChartRange;
  double: ChartRange;
  triple: ChartRange;
  homer: ChartRange;
};

export type PitcherChart = {
  pu: ChartRange;
  so: ChartRange;
  gb: ChartRange;
  fb: ChartRange;
  bb: ChartRange;
  single: ChartRange;
  double: ChartRange;
  homer: ChartRange;
};

export type Speed = { letter: "A" | "B" | "C"; value: number };

export type PositionCode =
  | "CA" | "1B" | "2B" | "3B" | "SS"
  | "LF" | "CF" | "RF" | "OF" | "IF" | "DH";

export type Position = {
  position: PositionCode;
  fielding: number;
};

type BaseCard = {
  id: string;
  name: string;
  year: number;
  team: string;
  teamFullName: string;
  set: string;
  points: number;
  imageUrl?: string;
  icons?: string[];
};

export type BatterCard = BaseCard & {
  cardType: "batter";
  onBase: number;
  speed: Speed;
  bats: "L" | "R" | "S";
  positions: Position[];
  chart: BatterChart;
};

export type PitcherCard = BaseCard & {
  cardType: "pitcher";
  control: number;
  throws: "L" | "R";
  pitcherType: "starter" | "reliever" | "closer";
  ip: number;
  chart: PitcherChart;
};

export type Card = BatterCard | PitcherCard;
