"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import cardsData from "@data/cards.json";
import type { BatterCard, Card as CardType, PitcherCard } from "@/types/card";
import {
  type Advantage,
  type Outcome,
  calculateAdvantage,
  getOutcome,
  isOut,
  outcomeLabel,
  rollD20,
} from "@/lib/game";
import { DICE_TUMBLE_MS, Dice } from "@/components/Dice";

const cards = cardsData as CardType[];
const batters = cards.filter((c): c is BatterCard => c.cardType === "batter");
const pitchers = cards.filter((c): c is PitcherCard => c.cardType === "pitcher");

type Stage =
  | { kind: "idle" }
  | { kind: "pitcher-rolling"; pitchRoll: number }
  | { kind: "pitcher-settled"; pitchRoll: number; advantage: Advantage }
  | {
      kind: "batter-rolling";
      pitchRoll: number;
      advantage: Advantage;
      swingRoll: number;
    }
  | {
      kind: "batter-settled";
      pitchRoll: number;
      advantage: Advantage;
      swingRoll: number;
      outcome: Outcome;
    };

export default function AtBatPage() {
  const [pitcherId, setPitcherId] = useState(pitchers[0].id);
  const [batterId, setBatterId] = useState(batters[0].id);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });

  const pitcher = useMemo(
    () => pitchers.find((p) => p.id === pitcherId)!,
    [pitcherId],
  );
  const batter = useMemo(
    () => batters.find((b) => b.id === batterId)!,
    [batterId],
  );

  function changePitcher(id: string) {
    setPitcherId(id);
    setStage({ kind: "idle" });
  }
  function changeBatter(id: string) {
    setBatterId(id);
    setStage({ kind: "idle" });
  }

  function tapPitcher() {
    if (stage.kind !== "idle") return;
    const pitchRoll = rollD20();
    setStage({ kind: "pitcher-rolling", pitchRoll });
    setTimeout(() => {
      const advantage = calculateAdvantage(pitcher, batter, pitchRoll);
      setStage({ kind: "pitcher-settled", pitchRoll, advantage });
    }, DICE_TUMBLE_MS);
  }

  function tapBatter() {
    if (stage.kind !== "pitcher-settled") return;
    const swingRoll = rollD20();
    const { pitchRoll, advantage } = stage;
    setStage({ kind: "batter-rolling", pitchRoll, advantage, swingRoll });
    setTimeout(() => {
      const outcome = getOutcome(pitcher, batter, advantage, swingRoll);
      setStage({
        kind: "batter-settled",
        pitchRoll,
        advantage,
        swingRoll,
        outcome,
      });
    }, DICE_TUMBLE_MS);
  }

  function nextAtBat() {
    setStage({ kind: "idle" });
  }

  // Derive display state from the staged stage object
  const pitchValue =
    stage.kind === "idle"
      ? null
      : "pitchRoll" in stage
        ? stage.pitchRoll
        : null;
  const pitchStatus =
    stage.kind === "idle"
      ? "idle"
      : stage.kind === "pitcher-rolling"
        ? "rolling"
        : "settled";

  const swingValue =
    stage.kind === "batter-rolling" || stage.kind === "batter-settled"
      ? stage.swingRoll
      : null;
  const swingStatus =
    stage.kind === "pitcher-settled"
      ? "idle"
      : stage.kind === "batter-rolling"
        ? "rolling"
        : stage.kind === "batter-settled"
          ? "settled"
          : "idle"; // hidden/disabled while pitcher hasn't rolled

  const advantage =
    "advantage" in stage ? stage.advantage : null;
  const advantageHolder =
    advantage === "pitcher" ? pitcher.name : advantage === "batter" ? batter.name : null;

  const isLocked = stage.kind === "pitcher-rolling" || stage.kind === "batter-rolling";

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
          onChange={changePitcher}
          disabled={isLocked}
          active={stage.kind === "idle" || stage.kind === "pitcher-rolling"}
          options={pitchers.map((p) => ({
            id: p.id,
            label: `${p.name} · Ctrl ${p.control}`,
          }))}
          card={pitcher}
        />
        <CardPicker
          label="Batter"
          value={batterId}
          onChange={changeBatter}
          disabled={isLocked}
          active={stage.kind === "pitcher-settled" || stage.kind === "batter-rolling"}
          options={batters.map((b) => ({
            id: b.id,
            label: `${b.name} · OB ${b.onBase}`,
          }))}
          card={batter}
        />
      </div>

      <div className="shrink-0 mt-3 flex items-center justify-around gap-3">
        <Dice
          tone="pitcher"
          status={pitchStatus}
          value={pitchValue}
          label={`+${pitcher.control}`}
          onTap={stage.kind === "idle" ? tapPitcher : undefined}
        />
        <CenterPanel
          stage={stage}
          pitcher={pitcher}
          batter={batter}
          advantageHolder={advantageHolder}
          onNext={nextAtBat}
        />
        <Dice
          tone="batter"
          status={swingStatus}
          value={swingValue}
          label={`OB ${batter.onBase}`}
          onTap={stage.kind === "pitcher-settled" ? tapBatter : undefined}
        />
      </div>
    </main>
  );
}

function CenterPanel({
  stage,
  pitcher,
  batter,
  advantageHolder,
  onNext,
}: {
  stage: Stage;
  pitcher: PitcherCard;
  batter: BatterCard;
  advantageHolder: string | null;
  onNext: () => void;
}) {
  return (
    <div className="flex-1 min-w-0 text-center">
      <AnimatePresence mode="wait">
        {stage.kind === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs sm:text-sm text-zinc-500"
          >
            Tap the red die to pitch
          </motion.div>
        )}
        {stage.kind === "pitcher-rolling" && (
          <motion.div
            key="pitcher-rolling"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs sm:text-sm text-zinc-500"
          >
            …
          </motion.div>
        )}
        {stage.kind === "pitcher-settled" && (
          <motion.div
            key="pitcher-settled"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-1"
          >
            <div className="text-[10px] sm:text-xs text-zinc-500">
              {stage.pitchRoll}+{pitcher.control}={stage.pitchRoll + pitcher.control} vs OB {batter.onBase}
            </div>
            <div className="text-sm sm:text-base font-semibold">
              <span
                className={
                  stage.advantage === "pitcher" ? "text-rose-400" : "text-sky-400"
                }
              >
                {advantageHolder}
              </span>{" "}
              <span className="text-zinc-400">advantage</span>
            </div>
            <div className="text-[10px] sm:text-xs text-zinc-500">
              Tap the blue die to swing
            </div>
          </motion.div>
        )}
        {stage.kind === "batter-rolling" && (
          <motion.div
            key="batter-rolling"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs sm:text-sm text-zinc-500"
          >
            …
          </motion.div>
        )}
        {stage.kind === "batter-settled" && (
          <motion.div
            key="batter-settled"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-1"
          >
            <div className="text-[10px] sm:text-xs text-zinc-500">
              {stage.pitchRoll}+{pitcher.control} → {advantageHolder} adv · swing {stage.swingRoll}
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7, type: "spring", stiffness: 380, damping: 22 }}
              className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                isOut(stage.outcome) ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {outcomeLabel(stage.outcome).toUpperCase()}
            </motion.div>
            <motion.button
              onClick={onNext}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
              className="mt-1 rounded-full bg-zinc-800 px-4 py-1.5 text-xs sm:text-sm text-zinc-200 hover:bg-zinc-700"
            >
              Next at-bat
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CardPicker({
  label,
  value,
  onChange,
  disabled,
  active,
  options,
  card,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  active?: boolean;
  options: { id: string; label: string }[];
  card: CardType;
}) {
  return (
    <div className="flex flex-col min-h-0">
      <label
        className={`shrink-0 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 ${
          active ? "text-emerald-300" : "text-zinc-500"
        }`}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="shrink-0 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs sm:text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="flex-1 min-h-0 mt-2 flex items-start justify-center">
        <Image
          src={`/cards/${card.id}.webp`}
          alt={card.name}
          width={1488}
          height={2079}
          className={`block max-h-full max-w-full w-auto h-auto rounded-xl shadow-md shadow-black/40 transition-shadow ${
            active ? "ring-4 ring-emerald-400/60" : ""
          }`}
          sizes="50vw"
          priority
        />
      </div>
    </div>
  );
}
