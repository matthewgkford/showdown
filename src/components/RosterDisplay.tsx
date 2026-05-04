"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { RARITY_TEXT_CLASS, getCardRarity } from "@/lib/rarity";
import type {
  BatterCard,
  Card as CardType,
  PitcherCard,
} from "@/types/card";

// Roster grid + tap-to-expand lightbox. Owns a single open-card state for
// the whole roster so opening a card in one section auto-closes any other.
export function RosterDisplay({
  batters,
  sp,
  bullpen,
  accentColor,
}: {
  batters: BatterCard[];
  sp: PitcherCard | undefined;
  bullpen: PitcherCard[];
  accentColor: string;
}) {
  const [openCard, setOpenCard] = useState<CardType | null>(null);

  // Esc closes the lightbox.
  useEffect(() => {
    if (!openCard) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenCard(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openCard]);

  return (
    <>
      <section className="mb-10">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
          Batting order
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 sm:gap-3">
          {batters.map((card, idx) => (
            <RosterSlot
              key={card.id}
              card={card}
              slotLabel={String(idx + 1)}
              accentColor={accentColor}
              onTap={() => setOpenCard(card)}
            />
          ))}
        </div>
      </section>

      {sp && (
        <section className="mb-10">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Starting pitcher
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
            <RosterSlot
              card={sp}
              slotLabel="SP"
              accentColor={accentColor}
              onTap={() => setOpenCard(sp)}
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
          {bullpen.map((card, idx) => (
            <RosterSlot
              key={card.id}
              card={card}
              slotLabel={`RP${idx + 1}`}
              accentColor={accentColor}
              onTap={() => setOpenCard(card)}
            />
          ))}
        </div>
      </section>

      <CardLightbox card={openCard} onClose={() => setOpenCard(null)} />
    </>
  );
}

function RosterSlot({
  card,
  slotLabel,
  accentColor,
  onTap,
}: {
  card: CardType;
  slotLabel: string;
  accentColor: string;
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
      <button
        type="button"
        onClick={onTap}
        className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 transition-transform hover:scale-[1.03] active:scale-[0.98]"
        aria-label={`View ${card.name} card`}
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
