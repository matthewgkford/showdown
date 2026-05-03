import type {
  BatterCard,
  BatterChart,
  Card as CardType,
  PitcherCard,
  PitcherChart,
} from "@/types/card";

export function Card({ card }: { card: CardType }) {
  return card.cardType === "batter" ? (
    <BatterTile card={card} />
  ) : (
    <PitcherTile card={card} />
  );
}

function BatterTile({ card }: { card: BatterCard }) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <CardHeader name={card.name} year={card.year} team={card.team} points={card.points} />
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="OB" value={card.onBase} accent />
        <Stat label="Speed" value={`${card.speed.letter} (${card.speed.value})`} />
        <Stat label="Bats" value={card.bats} />
      </div>
      <div className="mt-2 text-xs text-zinc-400">
        {card.positions.map((p) => `${p.position} +${p.fielding}`).join(" · ")}
      </div>
      <ChartStrip chart={card.chart} type="batter" />
    </article>
  );
}

function PitcherTile({ card }: { card: PitcherCard }) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <CardHeader name={card.name} year={card.year} team={card.team} points={card.points} />
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <Stat label="Ctrl" value={card.control} accent />
        <Stat label="IP" value={card.ip} />
        <Stat label="Hand" value={card.throws} />
        <Stat label="Type" value={card.pitcherType.slice(0, 3).toUpperCase()} />
      </div>
      <ChartStrip chart={card.chart} type="pitcher" />
    </article>
  );
}

function CardHeader({
  name,
  year,
  team,
  points,
}: {
  name: string;
  year: number;
  team: string;
  points: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <div>
        <div className="font-semibold leading-tight">{name}</div>
        <div className="text-xs text-zinc-500">
          {year} · {team}
        </div>
      </div>
      <div className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-300">
        {points}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-zinc-950/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`text-sm font-mono ${accent ? "text-emerald-400" : "text-zinc-200"}`}>
        {value}
      </div>
    </div>
  );
}

const BATTER_RESULT_ORDER = [
  "so", "gb", "fb", "bb", "single", "singlePlus", "double", "triple", "homer",
] as const;
const PITCHER_RESULT_ORDER = [
  "pu", "so", "gb", "fb", "bb", "single", "double", "homer",
] as const;
const RESULT_LABELS: Record<string, string> = {
  pu: "PU", so: "SO", gb: "GB", fb: "FB", bb: "BB",
  single: "1B", singlePlus: "1B+", double: "2B", triple: "3B", homer: "HR",
};

function ChartStrip({
  chart,
  type,
}: {
  chart: BatterChart | PitcherChart;
  type: "batter" | "pitcher";
}) {
  const order = type === "batter" ? BATTER_RESULT_ORDER : PITCHER_RESULT_ORDER;
  return (
    <div className="mt-3 flex flex-wrap gap-1 text-[11px] font-mono">
      {order.map((key) => {
        const range = (chart as Record<string, { min: number; max: number } | null>)[key];
        if (!range) return null;
        const span = range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`;
        return (
          <span
            key={key}
            className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-zinc-300"
            title={`${RESULT_LABELS[key]}: ${span}`}
          >
            <span className="text-zinc-500">{RESULT_LABELS[key]}</span>{" "}
            <span>{span}</span>
          </span>
        );
      })}
    </div>
  );
}
