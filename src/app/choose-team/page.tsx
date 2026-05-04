"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  getAllDivisions,
  getTeamBySlug,
  getTeamsByDivision,
} from "@/lib/teams";
import {
  getSeasonServerSnapshot,
  getSeasonSnapshot,
  resetSeason,
  startSeason,
  subscribe,
} from "@/lib/season";
import type { Team } from "@/types/team";

export default function ChooseTeamPage() {
  const router = useRouter();
  const season = useSyncExternalStore(
    subscribe,
    getSeasonSnapshot,
    getSeasonServerSnapshot,
  );

  const divisions = getAllDivisions();
  const [tappedTeam, setTappedTeam] = useState<Team | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // If a season already exists, gate the picker behind a continue/reset
  // overlay before letting the user pick a new team.
  const currentTeam = season ? getTeamBySlug(season.playerTeamSlug) : null;

  function handlePickTeam(team: Team) {
    setTappedTeam(team);
  }

  function handleConfirm() {
    if (!tappedTeam) return;
    startSeason(tappedTeam.slug);
    router.push("/season");
  }

  function handleContinueExisting() {
    router.push("/season");
  }

  function handleReset() {
    resetSeason();
    setShowResetConfirm(false);
  }

  // Existing-season gate
  if (season && currentTeam && !showResetConfirm) {
    return (
      <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100 px-4 py-10 sm:px-8 flex flex-col">
        <header className="mb-6 flex items-baseline justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Season in progress
          </h1>
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            ← home
          </Link>
        </header>

        <div
          className="flex-1 flex flex-col items-center justify-center gap-6 rounded-2xl p-8 sm:p-12"
          style={{
            background: `radial-gradient(ellipse at center, ${currentTeam.colors.primary}55 0%, transparent 70%)`,
          }}
        >
          <Image
            src={currentTeam.logos.primary}
            alt={currentTeam.name}
            width={320}
            height={320}
            className="h-32 w-32 sm:h-40 sm:w-40 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
            priority
          />
          <div className="text-center">
            <div
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ color: currentTeam.colors.accent }}
            >
              {currentTeam.name}
            </div>
            <div className="text-xs text-zinc-500 uppercase tracking-[0.2em] mt-1">
              {new Date(season.startedAt).toLocaleDateString()} · Tier{" "}
              {season.currentLeagueTier}
            </div>
          </div>
          <p className="max-w-sm text-center text-sm text-zinc-400">
            You already have a season going. Continue where you left off, or
            reset and pick a different team.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={handleContinueExisting}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Continue season
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="rounded-full border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:border-rose-700 hover:text-rose-300"
            >
              Reset & pick new team
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showResetConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
              onClick={() => setShowResetConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center"
              >
                <h2 className="text-lg font-bold">Reset season?</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  This wipes your current schedule and standings. Your card
                  collection and unopened packs are kept.
                </p>
                <div className="mt-5 flex justify-center gap-2">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReset}
                    className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-rose-400"
                  >
                    Reset
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    );
  }

  // Picker
  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Pick your team
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Ten teams across two divisions. Win your division and you&apos;re
              promoted to the next league.
            </p>
          </div>
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            ← home
          </Link>
        </header>

        {divisions.map((division, dIdx) => (
          <section key={division.slug} className="mb-8">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
              {division.name}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {getTeamsByDivision(division.slug).map((team, idx) => (
                <TeamTile
                  key={team.slug}
                  team={team}
                  delayIndex={dIdx * 5 + idx}
                  onTap={() => handlePickTeam(team)}
                />
              ))}
            </div>
          </section>
        ))}

        <AnimatePresence>
          {tappedTeam && (
            <ConfirmModal
              team={tappedTeam}
              onConfirm={handleConfirm}
              onClose={() => setTappedTeam(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function TeamTile({
  team,
  delayIndex,
  onTap,
}: {
  team: Team;
  delayIndex: number;
  onTap: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onTap}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: delayIndex * 0.05,
        type: "spring",
        stiffness: 280,
        damping: 22,
      }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className="relative rounded-2xl p-4 flex flex-col items-center gap-3 ring-1 ring-zinc-800 hover:ring-2 transition-shadow"
      style={{
        background: `linear-gradient(160deg, ${team.colors.primary} 0%, ${team.colors.primary}dd 60%, ${team.colors.primary}99 100%)`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ["--tw-ring-color" as any]: team.colors.accent,
      }}
    >
      <div className="h-20 w-20 sm:h-24 sm:w-24 flex items-center justify-center">
        <Image
          src={team.logos.primary}
          alt={team.name}
          width={224}
          height={224}
          className="h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
          priority
        />
      </div>
      <div className="text-center">
        <div className="text-sm sm:text-base font-bold text-white leading-tight">
          {team.name}
        </div>
        <div
          className="text-[9px] uppercase tracking-[0.25em] mt-0.5"
          style={{ color: team.colors.accent }}
        >
          {team.shortName}
        </div>
      </div>
    </motion.button>
  );
}

function ConfirmModal({
  team,
  onConfirm,
  onClose,
}: {
  team: Team;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 px-3"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-zinc-800 overflow-hidden"
        style={{
          background: `linear-gradient(165deg, ${team.colors.primary} 0%, ${team.colors.primary}dd 50%, #18181b 100%)`,
        }}
      >
        <div className="px-6 pt-7 pb-5 sm:pt-8">
          <div className="flex flex-col items-center gap-4">
            <div className="h-32 w-32 flex items-center justify-center">
              <Image
                src={team.logos.primary}
                alt={team.name}
                width={320}
                height={320}
                className="h-full w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)]"
                priority
              />
            </div>
            <div className="text-center">
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.3em]"
                style={{ color: team.colors.accent }}
              >
                {team.shortName}
              </div>
              <div className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {team.name}
              </div>
            </div>
            <p className="max-w-xs text-center text-sm text-white/75 leading-relaxed">
              {team.flavor}
            </p>
            <div className="flex gap-1.5 mt-1">
              <Swatch color={team.colors.primary} />
              <Swatch color={team.colors.accent} />
              <Swatch color={team.colors.light} />
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-2 justify-center">
          <button
            onClick={onClose}
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/80 hover:border-white/40 hover:text-white"
          >
            Back
          </button>
          <button
            onClick={onConfirm}
            className="rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: team.colors.accent,
              color: team.colors.primary,
            }}
          >
            Play as {team.name} →
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="h-4 w-4 rounded-full ring-1 ring-white/20"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}
