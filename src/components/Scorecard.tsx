"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import type { GameState, TeamState } from "@/lib/gameState";
import { getTeamDisplayColor } from "@/lib/teamColor";

const REGULAR_INNINGS = 9;

// Half-inning scorecard. Full-screen overlay shown between halves —
// classic linescore (R + H per team, runs broken out per inning) styled
// like a stadium scoreboard: deep navy panel with amber LED-style
// digits, subtle pinstripes, a thicker double-frame border, and a
// glowing amber header for "Mid Nth" / "End Nth". The cell that just
// scored gets a stronger amber glow.
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
        {/* Glowing header label, like the inning indicator on a stadium
            board. */}
        <div className="text-center">
          <div
            className="text-[11px] sm:text-xs font-black uppercase tracking-[0.55em] text-amber-300 inline-block"
            style={{
              textShadow:
                "0 0 12px rgba(251,191,36,0.6), 0 0 4px rgba(251,191,36,0.8)",
            }}
          >
            ◆ {headerLabel} ◆
          </div>
        </div>

        {/* Outer frame: amber-tinted border on a near-black panel with
            subtle vertical pinstripes for "scoreboard" texture. */}
        <div
          className="relative rounded-2xl p-[2px] shadow-2xl shadow-black/70"
          style={{
            background:
              "linear-gradient(180deg, rgba(251,191,36,0.4), rgba(251,191,36,0.1) 50%, rgba(251,191,36,0.4))",
          }}
        >
          <div
            className="rounded-[14px] p-3 sm:p-4"
            style={{
              backgroundColor: "#070b14",
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0, transparent 22px, rgba(251,191,36,0.04) 22px, rgba(251,191,36,0.04) 23px)",
            }}
          >
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-8 sm:w-9" />
                  {Array.from({ length: inningsToShow }, (_, i) => (
                    <th
                      key={i}
                      className="px-0 py-1 text-[9px] sm:text-[10px] font-bold tabular-nums tracking-wider"
                      style={{ color: "rgba(251,191,36,0.6)" }}
                    >
                      {i + 1}
                    </th>
                  ))}
                  <th
                    className="w-7 sm:w-9 px-0.5 py-1 text-[10px] sm:text-xs font-black tracking-[0.15em]"
                    style={{
                      color: "#fbbf24",
                      borderLeft: "2px solid rgba(251,191,36,0.35)",
                    }}
                  >
                    R
                  </th>
                  <th
                    className="w-7 sm:w-9 px-0.5 py-1 text-[10px] sm:text-xs font-black tracking-[0.15em]"
                    style={{
                      color: "#fbbf24",
                      borderLeft: "1px solid rgba(251,191,36,0.18)",
                    }}
                  >
                    H
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
  completedIdx: number;
  justPlayedIdx: number | null;
  isLast?: boolean;
}) {
  const displayColor = getTeamDisplayColor(team.team);
  // Slightly amber-tinted off-white for the digits — feels more "LED"
  // than pure white.
  const digitColor = "#f5e3b3";
  const dimColor = "rgba(251,191,36,0.18)";

  return (
    <tr
      className={isLast ? "" : ""}
      style={{
        borderBottom: isLast ? "none" : "1px solid rgba(251,191,36,0.18)",
      }}
    >
      <td
        className="px-1 py-2"
        style={{ borderRight: "1px solid rgba(251,191,36,0.12)" }}
      >
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
        const showDim = !played;
        return (
          <td
            key={i}
            className="px-0 py-2 text-center text-base sm:text-lg font-bold tabular-nums"
            style={{
              color: showDim
                ? dimColor
                : justPlayed
                  ? "#fbbf24"
                  : runs > 0
                    ? digitColor
                    : "rgba(245,227,179,0.5)",
              textShadow: justPlayed
                ? "0 0 14px rgba(251,191,36,0.8), 0 0 4px rgba(251,191,36,1)"
                : !showDim && runs > 0
                  ? "0 0 6px rgba(245,227,179,0.35)"
                  : undefined,
              borderRight:
                i === inningsToShow - 1
                  ? undefined
                  : "1px solid rgba(251,191,36,0.08)",
            }}
          >
            {played ? runs : "·"}
          </td>
        );
      })}
      <td
        className="px-0.5 py-2 text-center text-xl sm:text-2xl font-black tabular-nums"
        style={{
          color: displayColor,
          textShadow: `0 0 10px ${displayColor}66, 0 0 3px ${displayColor}cc`,
          borderLeft: "2px solid rgba(251,191,36,0.35)",
        }}
      >
        {team.runs}
      </td>
      <td
        className="px-0.5 py-2 text-center text-xl sm:text-2xl font-black tabular-nums"
        style={{
          color: digitColor,
          textShadow: "0 0 8px rgba(245,227,179,0.4), 0 0 2px rgba(245,227,179,0.7)",
          borderLeft: "1px solid rgba(251,191,36,0.18)",
        }}
      >
        {team.hits ?? 0}
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
