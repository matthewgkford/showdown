"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import cardsData from "@data/cards.json";
import type { BatterCard, Card as CardType, PitcherCard } from "@/types/card";
import { type AtBatResult, outcomeLabel, playAtBat } from "@/lib/game";

const cards = cardsData as CardType[];
const batters = cards.filter((c): c is BatterCard => c.cardType === "batter");
const pitchers = cards.filter((c): c is PitcherCard => c.cardType === "pitcher");

export default function AtBatPage() {
  const [pitcherId, setPitcherId] = useState(pitchers[0].id);
  const [batterId, setBatterId] = useState(batters[0].id);
  const [result, setResult] = useState<AtBatResult | null>(null);

  const pitcher = useMemo(
    () => pitchers.find((p) => p.id === pitcherId)!,
    [pitcherId],
  );
  const batter = useMemo(
    () => batters.find((b) => b.id === batterId)!,
    [batterId],
  );

  function roll() {
    setResult(playAtBat(pitcher, batter));
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">At-bat (debug)</h1>
          <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200">
            ← back to library
          </Link>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <CardPicker
            label="Pitcher"
            value={pitcherId}
            onChange={setPitcherId}
            options={pitchers.map((p) => ({
              id: p.id,
              label: `${p.name} · Ctrl ${p.control} · IP ${p.ip}`,
            }))}
            card={pitcher}
          />
          <CardPicker
            label="Batter"
            value={batterId}
            onChange={setBatterId}
            options={batters.map((b) => ({
              id: b.id,
              label: `${b.name} · OB ${b.onBase}`,
            }))}
            card={batter}
          />
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={roll}
            className="rounded-full bg-emerald-500 px-8 py-3 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 active:bg-emerald-600"
          >
            Roll
          </button>
        </div>

        {result && (
          <ResultPanel
            result={result}
            pitcher={pitcher}
            batter={batter}
          />
        )}
      </div>
    </main>
  );
}

function CardPicker({
  label,
  value,
  onChange,
  options,
  card,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: { id: string; label: string }[];
  card: CardType;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="mt-3">
        <Image
          src={`/cards/${card.id}.png`}
          alt={card.name}
          width={1488}
          height={2079}
          className="w-full h-auto rounded-xl shadow-md shadow-black/40"
          sizes="(min-width: 640px) 50vw, 100vw"
        />
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  pitcher,
  batter,
}: {
  result: AtBatResult;
  pitcher: PitcherCard;
  batter: BatterCard;
}) {
  const advantageHolder = result.advantage === "pitcher" ? pitcher.name : batter.name;
  return (
    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
        <Stat
          label="Pitch roll"
          value={`${result.pitchRoll} + ${pitcher.control} = ${result.pitchTotal}`}
          sub={`vs OB ${batter.onBase}`}
        />
        <Stat
          label="Advantage"
          value={advantageHolder}
          sub={result.advantage === "pitcher" ? "uses pitcher chart" : "uses batter chart"}
          accent
        />
        <Stat label="Swing roll" value={result.swingRoll} />
      </div>
      <div className="mt-6 text-center">
        <div className="text-xs uppercase tracking-wider text-zinc-500">Result</div>
        <div className="mt-1 text-4xl font-bold tracking-tight text-emerald-400">
          {outcomeLabel(result.outcome).toUpperCase()}
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold ${accent ? "text-emerald-400" : "text-zinc-100"}`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}
