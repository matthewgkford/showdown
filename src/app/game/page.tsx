"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
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
import {
  type Bases,
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
      kind: "field";
      outcome: Outcome;
      justBatted: BatterCard;
      preBases: Bases;
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
      // Capture the batter who just hit and the bases as they were
      // before the play resolves. The field view uses preBases to
      // animate runners step-by-step around the diamond.
      const justBatted = batter;
      const preBases = game.bases;
      setStage({ kind: "field", outcome, justBatted, preBases });
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
    stage.kind === "batter-rolling" ? stage.swingRoll : null;
  const swingStatus =
    stage.kind === "pitcher-settled"
      ? "idle"
      : stage.kind === "batter-rolling"
        ? "rolling"
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
      <header className="shrink-0 mb-2 flex items-center gap-3">
        <button onClick={onEnd} className="text-xs text-zinc-500 hover:text-zinc-200">
          End
        </button>
        <div className="flex-1 min-w-0">
          <Scoreboard state={game} />
        </div>
        {stage.kind !== "field" && <BaseDiamond bases={game.bases} />}
      </header>

      {stage.kind === "field" ? (
        <FieldView
          game={game}
          preBases={stage.preBases}
          outcome={stage.outcome}
          justBatted={stage.justBatted}
          onNext={nextBatter}
        />
      ) : (
        <>
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-3 sm:gap-6">
            <CardSlot
              label={`P · ${pitcher.name}`}
              card={pitcher}
              disabled={isLocked}
              active={stage.kind === "idle" || stage.kind === "pitcher-rolling"}
            />
            <CardSlot
              label={`#${currentBatterSlot(game) + 1} · ${batter.name}`}
              card={batter}
              disabled={isLocked}
              active={stage.kind === "pitcher-settled" || stage.kind === "batter-rolling"}
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
            <Center
              stage={stage}
              pitcher={pitcher}
              batter={batter}
              advantageHolder={advantageHolder}
            />
            <Dice
              tone="batter"
              status={swingStatus}
              value={swingValue}
              label={`OB ${batter.onBase}`}
              onTap={stage.kind === "pitcher-settled" ? tapBatter : undefined}
            />
          </div>
        </>
      )}
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
  active,
}: {
  label: string;
  card: CardType;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div
        className={`shrink-0 truncate text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 ${
          disabled ? "text-zinc-600" : active ? "text-emerald-300" : "text-zinc-500"
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

function Center({
  stage,
  pitcher,
  batter,
  advantageHolder,
}: {
  stage: Stage;
  pitcher: PitcherCard;
  batter: BatterCard;
  advantageHolder: string | null;
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
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Field view: between at-bats. Big diamond with each runner's card on
// their base, animated step-by-step around the basepath.
// ─────────────────────────────────────────────────────────────────────────────

type BasePos = "home" | "first" | "second" | "third" | "scored";
const BASE_ORDER: BasePos[] = ["home", "first", "second", "third", "scored"];

type RunnerSnapshot = { card: BatterCard; pos: BasePos };

const STEP_MS = 380;

// Build a sequence of intermediate snapshots that walk every runner one
// base at a time from the pre-play state to the post-play state. Each
// element of the returned array is a frame the field view will render in
// turn; layoutId animates the cards between consecutive frames.
function computeSteps(
  prev: Bases,
  current: Bases,
  justBatted: BatterCard,
  outcome: Outcome,
): RunnerSnapshot[][] {
  const initial: RunnerSnapshot[] = [];
  if (prev.first) initial.push({ card: prev.first, pos: "first" });
  if (prev.second) initial.push({ card: prev.second, pos: "second" });
  if (prev.third) initial.push({ card: prev.third, pos: "third" });
  if (!isOut(outcome)) initial.push({ card: justBatted, pos: "home" });

  const dest: Record<string, BasePos> = {};
  for (const r of initial) {
    if (current.first?.id === r.card.id) dest[r.card.id] = "first";
    else if (current.second?.id === r.card.id) dest[r.card.id] = "second";
    else if (current.third?.id === r.card.id) dest[r.card.id] = "third";
    else dest[r.card.id] = "scored";
  }

  const frames: RunnerSnapshot[][] = [initial];
  let cur = initial;
  for (let safety = 0; safety < 6; safety++) {
    let moved = false;
    const next: RunnerSnapshot[] = cur.map((r) => {
      const dIdx = BASE_ORDER.indexOf(dest[r.card.id]);
      const cIdx = BASE_ORDER.indexOf(r.pos);
      if (cIdx < dIdx) {
        moved = true;
        return { card: r.card, pos: BASE_ORDER[cIdx + 1] };
      }
      return r;
    });
    if (!moved) break;
    frames.push(next);
    cur = next;
  }
  return frames;
}

function FieldView({
  game,
  preBases,
  outcome,
  justBatted,
  onNext,
}: {
  game: GameState;
  preBases: Bases;
  outcome: Outcome;
  justBatted: BatterCard;
  onNext: () => void;
}) {
  const frames = useMemo(
    () => computeSteps(preBases, game.bases, justBatted, outcome),
    [preBases, game.bases, justBatted, outcome],
  );

  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    if (frameIdx >= frames.length - 1) return;
    const t = setTimeout(() => setFrameIdx((i) => i + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [frameIdx, frames.length]);

  const isAnimating = frameIdx < frames.length - 1;
  const visible = frames[frameIdx].filter((r) => r.pos !== "scored");

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-between py-2">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className="text-center shrink-0"
      >
        <div
          className={`text-2xl sm:text-3xl font-bold tracking-tight ${
            isOut(outcome) ? "text-rose-400" : "text-emerald-400"
          }`}
        >
          {outcomeLabel(outcome).toUpperCase()}
        </div>
        <div className="text-xs sm:text-sm text-zinc-400">{justBatted.name}</div>
      </motion.div>

      <Field runners={visible} />

      {isAnimating ? (
        <div className="h-10" aria-hidden />
      ) : (
        <button
          onClick={onNext}
          className="shrink-0 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 active:bg-emerald-600"
        >
          Next batter →
        </button>
      )}
    </div>
  );
}

function Field({ runners }: { runners: RunnerSnapshot[] }) {
  return (
    <div className="relative aspect-square w-full max-w-[min(70vh,420px)]">
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        <polygon
          points="50,12 88,50 50,88 12,50"
          fill="rgba(34,197,94,0.05)"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="0.4"
          strokeDasharray="2 2"
        />
        <BaseSquare cx={88} cy={50} occupied={runners.some((r) => r.pos === "first")} />
        <BaseSquare cx={50} cy={12} occupied={runners.some((r) => r.pos === "second")} />
        <BaseSquare cx={12} cy={50} occupied={runners.some((r) => r.pos === "third")} />
        <rect
          x={45}
          y={84}
          width={10}
          height={10}
          transform="rotate(45 50 89)"
          fill="rgba(255,255,255,0.35)"
        />
      </svg>

      <AnimatePresence>
        {runners.map((r) => (
          <RunnerCard key={r.card.id} card={r.card} pos={r.pos} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function BaseSquare({
  cx,
  cy,
  occupied,
}: {
  cx: number;
  cy: number;
  occupied: boolean;
}) {
  return (
    <rect
      x={cx - 3}
      y={cy - 3}
      width={6}
      height={6}
      transform={`rotate(45 ${cx} ${cy})`}
      fill={occupied ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.05)"}
      stroke={occupied ? "#10b981" : "rgba(255,255,255,0.3)"}
      strokeWidth={0.6}
    />
  );
}

const POSITION_CLASS: Record<Exclude<BasePos, "scored">, string> = {
  home: "left-1/2 -translate-x-1/2 bottom-0",
  first: "right-0 top-1/2 -translate-y-1/2",
  second: "left-1/2 -translate-x-1/2 top-0",
  third: "left-0 top-1/2 -translate-y-1/2",
};

function RunnerCard({ card, pos }: { card: BatterCard; pos: BasePos }) {
  if (pos === "scored") return null;
  return (
    <motion.div
      layoutId={`runner-${card.id}`}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7 }}
      transition={{
        layout: { duration: STEP_MS / 1000, ease: "easeInOut" },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
      }}
      className={`absolute ${POSITION_CLASS[pos]} flex flex-col items-center w-[22%]`}
    >
      <Image
        src={`/cards/${card.id}.png`}
        alt={card.name}
        width={1488}
        height={2079}
        className="block w-full h-auto rounded-md shadow-lg shadow-black/60 ring-1 ring-emerald-400/40"
        sizes="120px"
      />
      <div className="mt-1 max-w-full truncate text-[10px] font-semibold text-zinc-200">
        {card.name.split(" ").slice(-1)[0]}
      </div>
    </motion.div>
  );
}
