"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import type { GameState, TeamState } from "@/lib/gameState";
import { getTeamDisplayColor } from "@/lib/teamColor";
import type { Team } from "@/types/team";

const REGULAR_INNINGS = 9;

// Half-inning scorecard. Full-screen overlay shown between halves.
// Visual direction: clean broadcast / box-score — charcoal panel,
// sharp typography, team colors as a vertical accent strip and on the
// big R total. No LED glow, no pinstripes; everything in service of
// the numbers.
export function Scorecard({
  state,
  onContinue,
}: {
  state: GameState;
  onContinue: () => void;
}) {
  // After the 3rd out lands, applyAtBatOutcome flips half + bumps the
  // inning. So at this moment:
  //   half === "bottom" → top of state.inning just ended (mid Nth)
  //   half === "top"    → bottom of (state.inning - 1) just ended
  //                        (end of (N-1)th)
  const headerLabel =
    state.half === "bottom"
      ? `Mid ${ordinal(state.inning)}`
      : `End ${ordinal(state.inning - 1)}`;

  const inningsToShow = Math.max(
    REGULAR_INNINGS,
    state.half === "bottom" ? state.inning : state.inning - 1,
  );

  const awayCompletedIdx =
    (state.half === "bottom" ? state.inning : state.inning - 1) - 1;
  const homeCompletedIdx = state.inning - 1 - 1;
  const justPlayedAway = state.half === "bottom" ? state.inning - 1 : null;
  const justPlayedHome = state.half === "top" ? state.inning - 2 : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-md px-4 py-6"
      onClick={onContinue}
    >
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md flex flex-col items-stretch gap-5"
      >
        {/* Slim header label, no ornament. */}
        <div className="text-center">
          <span className="text-[11px] font-bold uppercase tracking-[0.5em] text-zinc-400">
            {headerLabel}
          </span>
        </div>

        {/* Bunting + panel, packed tight so the pennants visually hang
            onto the top edge of the scoreboard. */}
        <div className="relative">
          <Bunting homeTeam={state.home.team} />

          {/* Panel */}
          <div
            className="overflow-hidden rounded-2xl border border-zinc-800/80 shadow-2xl shadow-black/60"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #0c0c10 0%, #07070a 100%)",
            }}
          >
          {/* Header strip */}
          <div className="flex items-stretch border-b border-zinc-800/80 text-zinc-500">
            <div className="w-10 sm:w-12" />
            <div className="flex-1 grid"
                 style={{ gridTemplateColumns: `repeat(${inningsToShow}, minmax(0, 1fr))` }}>
              {Array.from({ length: inningsToShow }, (_, i) => (
                <div
                  key={i}
                  className="px-1 py-2 text-center text-[10px] font-semibold tracking-wider tabular-nums"
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="w-10 sm:w-11 px-1 py-2 text-center text-[10px] font-bold tracking-[0.15em] text-zinc-300 border-l border-zinc-800/80">
              R
            </div>
            <div className="w-10 sm:w-11 px-1 py-2 text-center text-[10px] font-bold tracking-[0.15em] text-zinc-500 border-l border-zinc-800/60">
              H
            </div>
          </div>

          <TeamRow
            team={state.away}
            inningsToShow={inningsToShow}
            completedIdx={awayCompletedIdx}
            justPlayedIdx={justPlayedAway}
          />
          <div className="border-t border-zinc-800/80" />
          <TeamRow
            team={state.home}
            inningsToShow={inningsToShow}
            completedIdx={homeCompletedIdx}
            justPlayedIdx={justPlayedHome}
          />
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="w-full rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 active:bg-emerald-600 transition-colors"
        >
          Continue
        </button>
      </motion.div>
    </motion.div>
  );
}

function TeamRow({
  team,
  inningsToShow,
  completedIdx,
  justPlayedIdx,
}: {
  team: TeamState;
  inningsToShow: number;
  completedIdx: number;
  justPlayedIdx: number | null;
}) {
  const color = getTeamDisplayColor(team.team);

  return (
    <div className="relative flex items-stretch">
      {/* Team-color accent strip at the very left of the row. */}
      <div
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r"
        style={{ backgroundColor: color }}
        aria-hidden
      />

      {/* Logo cell */}
      <div className="w-10 sm:w-12 flex items-center justify-center px-1 py-3">
        <Image
          src={team.team.logos.primary}
          alt={team.team.name}
          width={48}
          height={48}
          className="h-7 w-7 sm:h-8 sm:w-8 rounded-md object-contain"
        />
      </div>

      {/* Inning cells */}
      <div
        className="flex-1 grid"
        style={{
          gridTemplateColumns: `repeat(${inningsToShow}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: inningsToShow }, (_, i) => {
          const played = i <= completedIdx;
          const runs = team.inningRuns[i] ?? 0;
          const justPlayed = i === justPlayedIdx;
          return (
            <InningCell
              key={i}
              played={played}
              runs={runs}
              justPlayed={justPlayed}
              accentColor={color}
            />
          );
        })}
      </div>

      {/* R total — big, in team color */}
      <div
        className="w-10 sm:w-11 flex items-center justify-center px-1 py-3 text-2xl sm:text-3xl font-black tabular-nums border-l border-zinc-800/80"
        style={{ color }}
      >
        {team.runs}
      </div>

      {/* H total — bold, neutral */}
      <div className="w-10 sm:w-11 flex items-center justify-center px-1 py-3 text-lg sm:text-xl font-bold tabular-nums text-zinc-300 border-l border-zinc-800/60">
        {team.hits ?? 0}
      </div>
    </div>
  );
}

function InningCell({
  played,
  runs,
  justPlayed,
  accentColor,
}: {
  played: boolean;
  runs: number;
  justPlayed: boolean;
  accentColor: string;
}) {
  if (!played) {
    return (
      <div className="flex items-center justify-center text-zinc-700 text-base sm:text-lg font-medium tabular-nums">
        ·
      </div>
    );
  }

  // Just-played cell: tinted background pill with team color, slightly
  // larger digit. Provides emphasis without leaning on glow effects.
  if (justPlayed) {
    return (
      <div className="flex items-center justify-center">
        <motion.span
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 22,
            delay: 0.15,
          }}
          className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-md text-base sm:text-lg font-black tabular-nums text-zinc-50"
          style={{
            backgroundColor: `${accentColor}26`,
            boxShadow: `inset 0 0 0 1px ${accentColor}80`,
          }}
        >
          {runs}
        </motion.span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center text-base sm:text-lg font-bold tabular-nums ${
        runs > 0 ? "text-zinc-100" : "text-zinc-500"
      }`}
    >
      {runs}
    </div>
  );
}

// Row of small flags on poles strung across the top of the panel.
// Each flag hangs from a thin vertical pole and ripples sideways
// with a staggered, asymmetric flutter — meant to read as wind
// rather than the metronome wave of bunting. Colors alternate
// between the home team's primary + accent.
function Bunting({ homeTeam }: { homeTeam: Team }) {
  const FLAG_COUNT = 7;
  const colorA = homeTeam.colors.primary;
  const colorB = homeTeam.colors.accent;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-4 left-3 right-3 flex items-start justify-between"
    >
      {Array.from({ length: FLAG_COUNT }, (_, i) => (
        <div key={i} className="relative flex items-start">
          {/* Pole — thin vertical line the flag hangs off of. */}
          <div className="w-px h-5 bg-zinc-500/70" />
          {/* Flag — rectangle with a swallowtail V-cut on the right.
              skewX keyframes give an irregular flutter; rotating
              durations + delays keep neighbours out of sync. */}
          <motion.div
            initial={{ skewX: 0 }}
            animate={{ skewX: [-4, 5, -2, 4, -4] }}
            transition={{
              duration: 2.4 + (i % 3) * 0.35,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.18,
            }}
            style={{
              backgroundColor: i % 2 === 0 ? colorA : colorB,
              width: 22,
              height: 12,
              marginTop: 1,
              transformOrigin: "left center",
              clipPath:
                "polygon(0 0, 100% 0, 88% 50%, 100% 100%, 0 100%)",
              opacity: 0.9,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function ordinal(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}
