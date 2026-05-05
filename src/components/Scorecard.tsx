"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import type { GameState, TeamState } from "@/lib/gameState";
import { getTeamDisplayColor } from "@/lib/teamColor";

const REGULAR_INNINGS = 9;

// Half-inning scorecard. Full-screen overlay shown between halves —
// classic 9-column linescore with team logos and a running R total,
// styled to feel like a high-school / college board: bold tabular
// numerals, thin grid, dark with amber accent on the just-completed
// half. Tap anywhere or hit Continue to advance to the next half.
export function Scorecard({
  state,
  onContinue,
}: {
  state: GameState;
  onContinue: () => void;
}) {
  // After the 3rd out lands, applyAtBatOutcome flips half + bumps the
  // inning counter. So at this moment:
  //   state.half === "bottom" → top of state.inning just ended (mid Nth)
  //   state.half === "top"    → bottom of (state.inning - 1) just ended
  //                              (end of (N-1)th)
  const headerLabel =
    state.half === "bottom"
      ? `Mid ${ordinal(state.inning)}`
      : `End ${ordinal(state.inning - 1)}`;

  // How many inning columns to draw. Always at least 9; expand if we're
  // in extras so the trailing innings are visible.
  const inningsToShow = Math.max(
    REGULAR_INNINGS,
    state.half === "bottom" ? state.inning : state.inning - 1,
  );

  // For each team, the last inning index they've completed.
  // Away bats top-half, so they're "ahead" of home by 1 when state.half
  // is "bottom" (they just finished, home hasn't batted yet).
  const awayCompletedIdx =
    (state.half === "bottom" ? state.inning : state.inning - 1) - 1;
  const homeCompletedIdx = state.inning - 1 - 1;

  // The cell that just received runs — tinted amber for emphasis.
  const justPlayedAway = state.half === "bottom" ? state.inning - 1 : null;
  const justPlayedHome = state.half === "top" ? state.inning - 2 : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/92 backdrop-blur-md px-4 py-6"
      onClick={onContinue}
    >
      <motion.div
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md flex flex-col items-stretch gap-5"
      >
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.5em] text-amber-400">
            {headerLabel}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 p-3 sm:p-4 shadow-2xl shadow-black/60">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-9 sm:w-10" />
                {Array.from({ length: inningsToShow }, (_, i) => (
                  <th
                    key={i}
                    className="px-0.5 py-1 text-[9px] sm:text-[10px] font-bold text-zinc-500 tabular-nums"
                  >
                    {i + 1}
                  </th>
                ))}
                <th className="px-1 sm:px-2 py-1 text-[10px] sm:text-xs font-bold text-amber-400 tracking-wider border-l border-zinc-800">
                  R
                </th>
              </tr>
            </thead>
            <tbody>
              <TeamRow
                team={state.away}
                inningsToShow={inningsToShow}
                completedIdx={awayCompletedIdx}
                justPlayedIdx={justPlayedAway}
              />
              <TeamRow
                team={state.home}
                inningsToShow={inningsToShow}
                completedIdx={homeCompletedIdx}
                justPlayedIdx={justPlayedHome}
                isLast
              />
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="w-full rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 active:bg-emerald-600"
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
  isLast,
}: {
  team: TeamState;
  inningsToShow: number;
  completedIdx: number; // inning index (0-based) of last completed inning
  justPlayedIdx: number | null;
  isLast?: boolean;
}) {
  const displayColor = getTeamDisplayColor(team.team);
  return (
    <tr className={isLast ? "" : "border-b border-zinc-800/60"}>
      <td className="px-1 py-1.5">
        <div className="flex items-center justify-center">
          <Image
            src={team.team.logos.primary}
            alt={team.team.name}
            width={48}
            height={48}
            className="h-7 w-7 sm:h-8 sm:w-8 rounded-md object-contain"
          />
        </div>
      </td>
      {Array.from({ length: inningsToShow }, (_, i) => {
        const played = i <= completedIdx;
        const runs = team.inningRuns[i] ?? 0;
        const justPlayed = i === justPlayedIdx;
        return (
          <td
            key={i}
            className={`px-0.5 py-1.5 text-center text-base sm:text-lg font-bold tabular-nums ${
              !played
                ? "text-zinc-700"
                : justPlayed
                  ? "text-amber-400"
                  : runs > 0
                    ? "text-zinc-100"
                    : "text-zinc-500"
            }`}
            style={
              justPlayed
                ? {
                    textShadow: "0 0 10px rgba(251,191,36,0.5)",
                  }
                : undefined
            }
          >
            {played ? runs : "·"}
          </td>
        );
      })}
      <td
        className="px-1 sm:px-2 py-1.5 text-center text-xl sm:text-2xl font-black tabular-nums border-l border-zinc-800"
        style={{ color: displayColor }}
      >
        {team.runs}
      </td>
    </tr>
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
