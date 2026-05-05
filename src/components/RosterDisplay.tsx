"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import cardsData from "@data/cards.json";
import { RARITY_TEXT_CLASS, getCardRarity } from "@/lib/rarity";
import {
  getCollectionServerSnapshot,
  getCollectionSnapshot,
  subscribe as subscribeCollection,
} from "@/lib/collection";
import {
  getPlayerRosterServerSnapshot,
  getPlayerRosterSnapshot,
  resetPlayerRoster,
  subscribe as subscribePlayerRoster,
  swapBatter,
  swapBatterSlots,
  swapReliever,
  swapStartingPitcher,
} from "@/lib/playerRoster";
import {
  getSeasonServerSnapshot,
  getSeasonSnapshot,
  subscribe as subscribeSeason,
} from "@/lib/season";
import type {
  BatterCard,
  Card as CardType,
  PitcherCard,
} from "@/types/card";

type SlotKind =
  | { kind: "batter"; index: number }
  | { kind: "sp" }
  | { kind: "rp"; index: number };

const ALL_CARDS = cardsData as CardType[];
const cardById = new Map(ALL_CARDS.map((c) => [c.id, c]));

// Roster grid + tap-to-expand lightbox + (for the player's team) edit
// mode with a swap modal. When a roster override exists for the player's
// team, the slot contents are pulled from the override instead of the
// defaults passed in by the team page.
export function RosterDisplay({
  teamSlug,
  batters,
  sp,
  bullpen,
  accentColor,
}: {
  teamSlug: string;
  batters: BatterCard[];
  sp: PitcherCard | undefined;
  bullpen: PitcherCard[];
  accentColor: string;
}) {
  const season = useSyncExternalStore(
    subscribeSeason,
    getSeasonSnapshot,
    getSeasonServerSnapshot,
  );
  const override = useSyncExternalStore(
    subscribePlayerRoster,
    getPlayerRosterSnapshot,
    getPlayerRosterServerSnapshot,
  );
  // We don't render the collection directly here, but subscribing keeps
  // the swap modal's eligible-cards list in sync when packs are opened.
  useSyncExternalStore(
    subscribeCollection,
    getCollectionSnapshot,
    getCollectionServerSnapshot,
  );

  const isPlayerTeam = !!season && season.playerTeamSlug === teamSlug;

  // Active roster: if the player team has an override, use it; otherwise
  // fall back to the defaults the page passed in.
  const activeBatters: BatterCard[] = useMemo(() => {
    if (isPlayerTeam && override && override.teamSlug === teamSlug) {
      return override.batters
        .map((id) => cardById.get(id))
        .filter(
          (c): c is BatterCard =>
            c !== undefined && c.cardType === "batter",
        );
    }
    return batters;
  }, [isPlayerTeam, override, teamSlug, batters]);

  const activeSp: PitcherCard | undefined = useMemo(() => {
    if (isPlayerTeam && override && override.teamSlug === teamSlug) {
      const c = cardById.get(override.startingPitcher);
      return c && c.cardType === "pitcher" ? c : undefined;
    }
    return sp;
  }, [isPlayerTeam, override, teamSlug, sp]);

  const activeBullpen: PitcherCard[] = useMemo(() => {
    if (isPlayerTeam && override && override.teamSlug === teamSlug) {
      return override.relievers
        .map((id) => cardById.get(id))
        .filter(
          (c): c is PitcherCard =>
            c !== undefined && c.cardType === "pitcher",
        );
    }
    return bullpen;
  }, [isPlayerTeam, override, teamSlug, bullpen]);

  const [editing, setEditing] = useState(false);
  const [openCard, setOpenCard] = useState<CardType | null>(null);
  const [swapping, setSwapping] = useState<SlotKind | null>(null);

  // Esc closes whichever modal is open.
  useEffect(() => {
    if (!openCard && !swapping) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenCard(null);
        setSwapping(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openCard, swapping]);

  function handleSlotTap(card: CardType, slot: SlotKind): void {
    if (editing && isPlayerTeam) {
      setSwapping(slot);
    } else {
      setOpenCard(card);
    }
  }

  function handleResetRoster(): void {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Reset to your team's default starting roster?")
    ) {
      return;
    }
    resetPlayerRoster();
  }

  return (
    <>
      {isPlayerTeam && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            {editing ? "Tap a slot to swap" : "Your roster"}
          </p>
          <div className="flex gap-2">
            {editing && override && override.teamSlug === teamSlug && (
              <button
                type="button"
                onClick={handleResetRoster}
                className="rounded-full border border-zinc-800 px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-400 hover:border-rose-500/60 hover:text-rose-300"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                editing
                  ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                  : "border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
              }`}
            >
              {editing ? "Done" : "Edit"}
            </button>
          </div>
        </div>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
          Batting order
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 sm:gap-3">
          {activeBatters.map((card, idx) => (
            <RosterSlot
              key={`batter-${idx}-${card.id}`}
              card={card}
              slotLabel={String(idx + 1)}
              accentColor={accentColor}
              editing={editing && isPlayerTeam}
              onTap={() => handleSlotTap(card, { kind: "batter", index: idx })}
            />
          ))}
        </div>
      </section>

      {activeSp && (
        <section className="mb-10">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Starting pitcher
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
            <RosterSlot
              key={`sp-${activeSp.id}`}
              card={activeSp}
              slotLabel="SP"
              accentColor={accentColor}
              editing={editing && isPlayerTeam}
              onTap={() => handleSlotTap(activeSp, { kind: "sp" })}
            />
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="mb-3 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
          Bullpen
          <span className="text-zinc-600 font-normal normal-case">
            · 3 relievers
          </span>
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
          {activeBullpen.map((card, idx) => (
            <RosterSlot
              key={`rp-${idx}-${card.id}`}
              card={card}
              slotLabel={`RP${idx + 1}`}
              accentColor={accentColor}
              editing={editing && isPlayerTeam}
              onTap={() => handleSlotTap(card, { kind: "rp", index: idx })}
            />
          ))}
        </div>
      </section>

      <CardLightbox card={openCard} onClose={() => setOpenCard(null)} />

      <SwapModal
        slot={swapping}
        playerSlug={season?.playerTeamSlug ?? null}
        activeBatters={activeBatters}
        activeSp={activeSp}
        activeBullpen={activeBullpen}
        accentColor={accentColor}
        onClose={() => setSwapping(null)}
      />
    </>
  );
}

function RosterSlot({
  card,
  slotLabel,
  accentColor,
  editing,
  onTap,
}: {
  card: CardType;
  slotLabel: string;
  accentColor: string;
  editing: boolean;
  onTap: () => void;
}) {
  const rarity = getCardRarity(card);
  return (
    <div className="relative flex flex-col gap-1.5">
      <div className="absolute -top-1 -left-1 z-10 pointer-events-none">
        <span
          className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-950"
          style={{ backgroundColor: accentColor }}
        >
          {slotLabel}
        </span>
      </div>
      {editing && (
        <div className="absolute -top-1 -right-1 z-10 pointer-events-none">
          <span className="rounded-full bg-emerald-500 text-zinc-950 text-[9px] font-bold w-4 h-4 flex items-center justify-center">
            ↻
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={onTap}
        className={`block rounded-lg outline-none transition-transform hover:scale-[1.03] active:scale-[0.98] ${
          editing
            ? "ring-2 ring-emerald-400/60 focus-visible:ring-emerald-400"
            : "focus-visible:ring-2 focus-visible:ring-emerald-400"
        }`}
        aria-label={editing ? `Swap ${card.name}` : `View ${card.name} card`}
      >
        <Image
          src={`/cards/${card.id}.png`}
          alt={card.name}
          width={1488}
          height={2079}
          className="block w-full h-auto rounded-lg shadow-md shadow-black/40 ring-1 ring-zinc-800"
          sizes="(min-width: 1024px) 11vw, (min-width: 640px) 20vw, 33vw"
        />
      </button>
      <div className="text-[10px] truncate text-zinc-300">{card.name}</div>
      <div
        className={`text-[9px] uppercase tracking-wider ${RARITY_TEXT_CLASS[rarity]}`}
      >
        {card.points} pts
      </div>
    </div>
  );
}

function CardLightbox({
  card,
  onClose,
}: {
  card: CardType | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {card && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4 py-6"
          onClick={onClose}
        >
          <motion.div
            key={card.id}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-full"
          >
            <Image
              src={`/cards/${card.id}.png`}
              alt={card.name}
              width={1488}
              height={2079}
              priority
              className="block max-h-[88vh] w-auto rounded-2xl shadow-2xl shadow-black/70 ring-1 ring-white/10"
              sizes="(min-width: 768px) 60vw, 90vw"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-zinc-200 ring-1 ring-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              ×
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Modal that lists eligible candidate cards from the player's collection
// for a given roster slot. Eligible = right card type + not currently
// occupying any other slot in the active roster.
function SwapModal({
  slot,
  playerSlug,
  activeBatters,
  activeSp,
  activeBullpen,
  accentColor,
  onClose,
}: {
  slot: SlotKind | null;
  playerSlug: string | null;
  activeBatters: BatterCard[];
  activeSp: PitcherCard | undefined;
  activeBullpen: PitcherCard[];
  accentColor: string;
  onClose: () => void;
}) {
  const collection = useSyncExternalStore(
    subscribeCollection,
    getCollectionSnapshot,
    getCollectionServerSnapshot,
  );

  const candidates = useMemo<CardType[]>(() => {
    if (!slot) return [];
    const wantType: "batter" | "pitcher" =
      slot.kind === "batter" ? "batter" : "pitcher";
    // Cards already in active roster slots — these aren't candidates,
    // because moving them between slots would empty their original.
    const inRoster = new Set<string>();
    for (const c of activeBatters) inRoster.add(c.id);
    if (activeSp) inRoster.add(activeSp.id);
    for (const c of activeBullpen) inRoster.add(c.id);

    const owned: CardType[] = [];
    for (const id of Object.keys(collection.cards)) {
      if (collection.cards[id] <= 0) continue;
      if (inRoster.has(id)) continue;
      const card = cardById.get(id);
      if (!card) continue;
      if (card.cardType !== wantType) continue;
      owned.push(card);
    }
    // Highest points first — most likely useful upgrades surface first.
    return owned.sort((a, b) => b.points - a.points);
  }, [slot, collection, activeBatters, activeSp, activeBullpen]);

  function handlePick(cardId: string): void {
    if (!slot || !playerSlug) return;
    if (slot.kind === "batter") {
      swapBatter(playerSlug, slot.index, cardId);
    } else if (slot.kind === "sp") {
      swapStartingPitcher(playerSlug, cardId);
    } else {
      swapReliever(playerSlug, slot.index, cardId);
    }
    onClose();
  }

  function handleMoveTo(targetIdx: number): void {
    if (!slot || !playerSlug || slot.kind !== "batter") return;
    swapBatterSlots(playerSlug, slot.index, targetIdx);
    onClose();
  }

  const slotTitle =
    slot?.kind === "batter"
      ? `Batting #${slot.index + 1}`
      : slot?.kind === "sp"
        ? "Starting pitcher"
        : slot?.kind === "rp"
          ? `Reliever ${slot.index + 1}`
          : "";

  return (
    <AnimatePresence>
      {slot && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm px-3 py-4 sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6 max-h-[85vh] overflow-y-auto"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.25em]"
                  style={{ color: accentColor }}
                >
                  Replace slot
                </div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                  {slotTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
              >
                Cancel
              </button>
            </div>

            {/* Move-to-slot row, batters only — tap a number to swap
                this player into that batting slot. The current slot is
                disabled. */}
            {slot?.kind === "batter" && (
              <div className="mb-5">
                <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-2">
                  Move to slot
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeBatters.map((_, i) => {
                    const isCurrent = i === slot.index;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={isCurrent}
                        onClick={() => handleMoveTo(i)}
                        className={`h-9 w-9 rounded-md text-sm font-bold tabular-nums transition-colors ${
                          isCurrent
                            ? "bg-zinc-900 text-zinc-600 cursor-default border border-zinc-800"
                            : "bg-zinc-900 text-zinc-200 border border-zinc-700 hover:border-emerald-500/60 hover:text-emerald-300"
                        }`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-2">
              Replace from collection
            </div>

            {candidates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
                <div className="text-sm font-semibold text-zinc-300">
                  No eligible cards
                </div>
                <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
                  Win season games to earn packs. Cards from packs that
                  aren&apos;t already on the active roster show up here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                {candidates.map((card) => (
                  <CandidateCard
                    key={card.id}
                    card={card}
                    onPick={() => handlePick(card.id)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CandidateCard({
  card,
  onPick,
}: {
  card: CardType;
  onPick: () => void;
}) {
  const rarity = getCardRarity(card);
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex flex-col gap-1.5 rounded-lg p-1.5 outline-none transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-400 hover:bg-zinc-900/60"
    >
      <Image
        src={`/cards/${card.id}.png`}
        alt={card.name}
        width={1488}
        height={2079}
        className="block w-full h-auto rounded-lg shadow-md shadow-black/40 ring-1 ring-zinc-800"
        sizes="20vw"
      />
      <div className="text-[10px] truncate text-zinc-300 text-left">
        {card.name}
      </div>
      <div
        className={`text-[9px] uppercase tracking-wider text-left ${RARITY_TEXT_CLASS[rarity]}`}
      >
        {card.points} pts
      </div>
    </button>
  );
}

