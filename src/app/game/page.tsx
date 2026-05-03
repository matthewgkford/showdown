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
  outcomeLabel,
  rollD20,
} from "@/lib/game";
import {
  type GameState,
  applyAtBatOutcome,
  currentBatter,
  currentPitcher,
  startGame,
} from "@/lib/gameState";
import { DICE_TUMBLE_MS, Dice } from "@/components/Dice";
import { BaseDiamond } from "@/components/BaseDiamond";
import { Scoreboard } from "@/components/Scoreboard";

const cards = cardsData as CardType[];
const allBatters = cards.filter((c): c is BatterCard => c.cardType === "batter");
const allPitchers = cards.filter((c): c is PitcherCard => c.cardType === "pitcher");

type Phase =
  | { kind: "setup" }
  | { kind: "playing"; game: GameState };

export default function GamePage() {
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });

  if (phase.kind === "setup") {
    return (
      <Setup
        onStart={(away, home) =>
          setPhase({ kind: "playing", game: startGame(away, home) })
        }
      />
    );
  }

  return (
    <Play
      initial={phase.game}
      onEnd={() => setPhase({ kind: "setup" })}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup phase: pick lineups + pitchers
// ─────────────────────────────────────────────────────────────────────────────

function Setup({
  onStart,
}: {
  onStart: (
    away: { lineup: BatterCard[]; pitcher: PitcherCard },
    home: { lineup: BatterCard[]; pitcher: PitcherCard },
  ) => void;
}) {
  // Default split: first 9 batters → away, next 9 → home.
  const [awayPitcher, setAwayPitcher] = useState<PitcherCard>(allPitchers[0]);
  const [homePitcher, setHomePitcher] = useState<PitcherCard>(
    allPitchers[1] ?? allPitchers[0],
  );
  const [awayLineup, setAwayLineup] = useState<BatterCard[]>(
    allBatters.slice(0, 9),
  );
  const [homeLineup, setHomeLineup] = useState<BatterCard[]>(
    allBatters.slice(9, 18),
  );

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100 px-4 py-6 sm:px-8">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">New game</h1>
        <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200">
          ← library
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        <TeamSetup
          label="Away"
          pitcher={awayPitcher}
          lineup={awayLineup}
          onPitcherChange={setAwayPitcher}
          onSlotChange={(idx, b) => {
            setAwayLineup((l) => l.map((slot, i) => (i === idx ? b : slot)));
          }}
        />
        <TeamSetup
          label="Home"
          pitcher={homePitcher}
          lineup={homeLineup}
          onPitcherChange={setHomePitcher}
          onSlotChange={(idx, b) => {
            setHomeLineup((l) => l.map((slot, i) => (i === idx ? b : slot)));
          }}
        />
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={() =>
            onStart(
              { lineup: awayLineup, pitcher: awayPitcher },
              { lineup: homeLineup, pitcher: homePitcher },
            )
          }
          className="rounded-full bg-emerald-500 px-8 py-3 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 active:bg-emerald-600"
        >
          Play ball
        </button>
      </div>
    </main>
  );
}

function TeamSetup({
  label,
  pitcher,
  lineup,
  onPitcherChange,
  onSlotChange,
}: {
  label: string;
  pitcher: PitcherCard;
  lineup: BatterCard[];
  onPitcherChange: (p: PitcherCard) => void;
  onSlotChange: (idx: number, b: BatterCard) => void;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </h2>
      <div className="space-y-2">
        <SetupRow
          slot="P"
          value={pitcher.id}
          onChange={(id) => {
            const p = allPitchers.find((x) => x.id === id);
            if (p) onPitcherChange(p);
          }}
          options={allPitchers.map((p) => ({
            id: p.id,
            label: `${p.name} · Ctrl ${p.control} · IP ${p.ip}`,
          }))}
        />
        {lineup.map((b, idx) => (
          <SetupRow
            key={idx}
            slot={String(idx + 1)}
            value={b.id}
            onChange={(id) => {
              const next = allBatters.find((x) => x.id === id);
              if (next) onSlotChange(idx, next);
            }}
            options={allBatters.map((bb) => ({
              id: bb.id,
              label: `${bb.name} · OB ${bb.onBase}`,
            }))}
          />
        ))}
      </div>
    </section>
  );
}

function SetupRow({
  slot,
  value,
  onChange,
  options,
}: {
  slot: string;
  value: string;
  onChange: (id: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs sm:text-sm">
      <span className="w-5 shrink-0 text-right font-mono text-zinc-500">{slot}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100 focus:border-emerald-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Playing phase: live game view
// ─────────────────────────────────────────────────────────────────────────────

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

function Play({
  initial,
  onEnd,
}: {
  initial: GameState;
  onEnd: () => void;
}) {
  const [game, setGame] = useState<GameState>(initial);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });

  const pitcher = useMemo(() => currentPitcher(game), [game]);
  const batter = useMemo(() => currentBatter(game), [game]);

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
      // Apply outcome to the game state — diamond, scoreboard, batter
      // index, half-inning flip all happen here.
      setGame((g) => applyAtBatOutcome(g, outcome));
    }, DICE_TUMBLE_MS);
  }

  function nextBatter() {
    setStage({ kind: "idle" });
  }

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
          : "idle";

  const advantage = "advantage" in stage ? stage.advantage : null;
  const advantageHolder =
    advantage === "pitcher"
      ? pitcher.name
      : advantage === "batter"
        ? batter.name
        : null;

  const isLocked = stage.kind === "pitcher-rolling" || stage.kind === "batter-rolling";

  return (
    <main className="h-[100dvh] flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden px-3 py-3 sm:px-6 sm:py-4">
      {/* top bar: scoreboard + diamond */}
      <header className="shrink-0 mb-2 flex items-center gap-3">
        <button
          onClick={onEnd}
          className="text-xs text-zinc-500 hover:text-zinc-200"
        >
          End
        </button>
        <div className="flex-1 min-w-0">
          <Scoreboard state={game} />
        </div>
        <BaseDiamond bases={game.bases} />
      </header>

      {/* card row */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-3 sm:gap-6">
        <CardSlot label={`P · ${pitcher.name}`} card={pitcher} disabled={isLocked} />
        <CardSlot
          label={`#${currentBatterSlot(game) + 1} · ${batter.name}`}
          card={batter}
          disabled={isLocked}
        />
      </div>

      {/* dice + center status */}
      <div className="shrink-0 mt-3 flex items-center justify-around gap-3">
        <Dice
          tone="pitcher"
          status={pitchStatus}
          value={pitchValue}
          label={`+${pitcher.control}`}
          onTap={stage.kind === "idle" ? tapPitcher : undefined}
        />
        <Center
          stage={stage}
          pitcher={pitcher}
          batter={batter}
          advantageHolder={advantageHolder}
          onNext={nextBatter}
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

function currentBatterSlot(g: GameState): number {
  return g.half === "top" ? g.away.battingIndex : g.home.battingIndex;
}

function CardSlot({
  label,
  card,
  disabled,
}: {
  label: string;
  card: CardType;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div
        className={`shrink-0 truncate text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 ${
          disabled ? "text-zinc-600" : "text-zinc-500"
        }`}
      >
        {label}
      </div>
      <div className="flex-1 min-h-0 flex items-start justify-center">
        <Image
          src={`/cards/${card.id}.png`}
          alt={card.name}
          width={1488}
          height={2079}
          className="block max-h-full max-w-full w-auto h-auto rounded-xl shadow-md shadow-black/40"
          sizes="50vw"
          priority
        />
      </div>
    </div>
  );
}

function Center({
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
            className="space-y-0.5"
          >
            <div className="text-[10px] sm:text-xs text-zinc-500">
              {stage.pitchRoll}+{pitcher.control}={stage.pitchRoll + pitcher.control} vs OB {batter.onBase}
            </div>
            <div className="text-sm font-semibold">
              <span
                className={
                  stage.advantage === "pitcher" ? "text-rose-400" : "text-sky-400"
                }
              >
                {advantageHolder}
              </span>{" "}
              <span className="text-zinc-400">advantage</span>
            </div>
            <div className="text-[10px] text-zinc-500">Tap the blue die to swing</div>
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
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="space-y-1"
          >
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-400">
              {outcomeLabel(stage.outcome).toUpperCase()}
            </div>
            <button
              onClick={onNext}
              className="rounded-full bg-zinc-800 px-4 py-1.5 text-xs sm:text-sm text-zinc-200 hover:bg-zinc-700"
            >
              Next batter
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
