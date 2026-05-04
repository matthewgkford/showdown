"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { Card } from "@/types/card";
import type { Pack, Rarity } from "@/types/collection";
import { getCardRarity } from "@/lib/rarity";
import { CardReveal } from "./CardReveal";

const ROW_CARD_W = 60;
const CENTER_CARD_W = 240;
const HERO_CARD_W = 240;
const SUPPORTING_CARD_W = 56;

// Time the card takes to fly from row to centre before we auto-flip it.
// Should be ~= the framer-motion layout transition duration.
const ARRIVE_MS = 450;

// Extra dwell on the face-down card at centre stage so the rarity glow
// has time to register before the flip starts. Without this the "is that
// gold?" moment is too short.
const PRE_FLIP_DWELL_MS = 350;

// Orchestrates the per-card reveal: a row of face-down cards at the
// bottom, the "next" card pulsing. Tap → card flies to centre, the rarity
// halo pulses for ~PRE_FLIP_DWELL_MS, the card auto-flips, waits for a
// dismiss tap → flies back to its row slot face-up. After all five are
// face-up the rarest card scales up into a hero arrangement and the
// "Add to collection" CTA appears.
export function RevealSequence({
  pack,
  cards,
  onComplete,
}: {
  pack: Pack;
  cards: Card[];
  onComplete: () => void;
}) {
  const reduced = useReducedMotion();
  const [revealed, setRevealed] = useState<boolean[]>(() => cards.map(() => false));
  const [centerIdx, setCenterIdx] = useState<number | null>(null);
  const [centerFaceup, setCenterFaceup] = useState(false);

  const rarities = useMemo<Rarity[]>(() => cards.map(getCardRarity), [cards]);
  const allRevealed = revealed.every(Boolean);
  const nextIdx = revealed.indexOf(false);
  // Cards are passed in pre-sorted (sortForReveal) so the last index is
  // the rarest card — the hero of the pack.
  const heroIdx = cards.length - 1;

  // Auto-flip the centre card once it's arrived from the row, with an
  // extra pre-flip dwell so the rarity glow registers.
  useEffect(() => {
    if (centerIdx === null || centerFaceup) return;
    const t = setTimeout(
      () => setCenterFaceup(true),
      ARRIVE_MS + PRE_FLIP_DWELL_MS,
    );
    return () => clearTimeout(t);
  }, [centerIdx, centerFaceup]);

  function tapRow(idx: number) {
    if (centerIdx !== null) return;
    if (idx !== nextIdx) return;
    setCenterIdx(idx);
    setCenterFaceup(false);
  }

  function tapCenter() {
    if (centerIdx === null || !centerFaceup) return;
    const idx = centerIdx;
    setRevealed((r) => r.map((v, i) => (i === idx ? true : v)));
    setCenterIdx(null);
    setCenterFaceup(false);
  }

  return (
    <div className="relative h-full w-full">
      {/* Row of cards at the bottom. When the hero shot is active we hide
          the hero card from the row (it's rendered at centre instead). */}
      <div className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-3">
        {cards.map((card, idx) => {
          const isCentered = idx === centerIdx;
          const isHeroAtCentre = allRevealed && idx === heroIdx;
          if (isCentered || isHeroAtCentre) {
            return (
              <div
                key={idx}
                style={{
                  width: ROW_CARD_W,
                  height: ROW_CARD_W / (1488 / 2079),
                }}
              />
            );
          }
          const isNext = idx === nextIdx;
          // Slightly smaller in the hero shot so the hero feels bigger.
          const w = allRevealed ? SUPPORTING_CARD_W : ROW_CARD_W;
          return (
            <motion.button
              key={idx}
              layoutId={`card-${idx}`}
              onClick={() => tapRow(idx)}
              disabled={!isNext || revealed[idx]}
              className={`relative rounded-lg ${
                isNext && !revealed[idx]
                  ? "ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-zinc-950"
                  : ""
              }`}
              animate={
                !reduced && isNext && !revealed[idx]
                  ? { y: [0, -3, 0] }
                  : { y: 0 }
              }
              transition={
                !reduced && isNext && !revealed[idx]
                  ? { y: { duration: 1.4, repeat: Infinity, ease: "easeInOut" } }
                  : { duration: 0.2 }
              }
              whileTap={
                !reduced && isNext && !revealed[idx] ? { scale: 0.94 } : undefined
              }
            >
              <CardReveal
                card={card}
                pack={pack}
                faceup={revealed[idx]}
                size={w}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Centre stage: face-down card during the reveal, hero card when
          all are revealed. */}
      <AnimatePresence>
        {centerIdx !== null && !allRevealed && (
          <motion.button
            key={`center-${centerIdx}`}
            layoutId={`card-${centerIdx}`}
            onClick={tapCenter}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            transition={{ duration: ARRIVE_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
          >
            <CardReveal
              card={cards[centerIdx]}
              pack={pack}
              faceup={centerFaceup}
              size={CENTER_CARD_W}
              rarity={rarities[centerIdx]}
              showGlow
            />
            {centerFaceup && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-zinc-500"
              >
                Tap to continue
              </motion.div>
            )}
          </motion.button>
        )}
        {allRevealed && (
          <motion.div
            key="hero"
            layoutId={`card-${heroIdx}`}
            className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2"
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            <CardReveal
              card={cards[heroIdx]}
              pack={pack}
              faceup
              size={HERO_CARD_W}
              rarity={rarities[heroIdx]}
              showGlow
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add-to-collection CTA after all cards revealed. */}
      <AnimatePresence>
        {allRevealed && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 24,
              delay: 0.3,
            }}
            className="absolute bottom-[28%] sm:bottom-[26%] left-1/2 -translate-x-1/2 z-10"
          >
            <button
              onClick={onComplete}
              className="rounded-full bg-emerald-500 px-8 py-3 text-base font-bold text-zinc-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 active:bg-emerald-600"
            >
              Add to collection →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
