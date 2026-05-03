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
    <main className="h-[100dvh] flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden px-3 py-3 sm:px-6 sm:py-4">
      <header className="shrink-0 mb-2 flex items-baseline justify-between gap-4">
        <h1 className="text-base sm:text-xl font-bold tracking-tight">At-bat</h1>
        <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200">
          ← library
        </Link>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-2 gap-3 sm:gap-6">
        <CardPicker
          label="Pitcher"
          value={pitcherId}
          onChange={(id) => {
            setPitcherId(id);
            setResult(null);
          }}
          options={pitchers.map((p) => ({
            id: p.id,
            label: `${p.name} · Ctrl ${p.control}`,
          }))}
          card={pitcher}
        />
        <CardPicker
          label="Batter"
          value={batterId}
          onChange={(id) => {
            setBatterId(id);
            setResult(null);
          }}
          options={batters.map((b) => ({
            id: b.id,
            label: `${b.name} · OB ${b.onBase}`,
          }))}
          card={batter}
        />
      </div>

      <div className="shrink-0 mt-3 flex flex-col items-center gap-2">
        <button
          onClick={roll}
          className="rounded-full bg-emerald-500 px-8 py-2.5 text-sm sm:text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 active:bg-emerald-600"
        >
          Roll
        </button>
        <ResultStrip result={result} pitcher={pitcher} batter={batter} />
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
    <div className="flex flex-col min-h-0">
      <label className="shrink-0 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="shrink-0 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs sm:text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="flex-1 min-h-0 mt-2 relative">
        <Image
          src={`/cards/${card.id}.png`}
          alt={card.name}
          fill
          className="object-contain"
          sizes="50vw"
          priority
        />
      </div>
    </div>
  );
}

function ResultStrip({
  result,
  pitcher,
  batter,
}: {
  result: AtBatResult | null;
  pitcher: PitcherCard;
  batter: BatterCard;
}) {
  if (!result) {
    return (
      <div className="h-10 sm:h-12 text-xs text-zinc-600">
        Tap Roll to play the at-bat
      </div>
    );
  }
  const advantageHolder = result.advantage === "pitcher" ? pitcher.name : batter.name;
  return (
    <div className="w-full text-center">
      <div className="text-[10px] sm:text-xs text-zinc-500">
        Pitch {result.pitchRoll}+{pitcher.control}={result.pitchTotal} vs OB {batter.onBase}
        {" · "}
        <span className="text-zinc-300">{advantageHolder}</span> advantage
        {" · "}
        Swing {result.swingRoll}
      </div>
      <div className="mt-0.5 text-2xl sm:text-3xl font-bold tracking-tight text-emerald-400">
        {outcomeLabel(result.outcome).toUpperCase()}
      </div>
    </div>
  );
}
