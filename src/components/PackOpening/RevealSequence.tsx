"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Card } from "@/types/card";
import type { Pack } from "@/types/collection";
import { CardReveal } from "./CardReveal";

// Pixel widths. Heights are derived inside CardReveal from the card aspect.
const ROW_CARD_W = 60;
const CENTER_CARD_W = 240;

// Time the card takes to fly from row to centre before we auto-flip it.
// Should be ~= the framer-motion layout transition duration.
const ARRIVE_MS = 450;

// Orchestrates the per-card reveal: a row of face-down cards at the
// bottom, the "next" card pulsing. Tap → card flies to centre, auto-flips
// after arriving, waits for a dismiss tap → flies back to its row slot
// face-up. After all 5 are face-up the centre shows a Done button.
export function RevealSequence({
  pack,
  cards,
  onComplete,
}: {
  pack: Pack;
  cards: Card[];
  onComplete: () => void;
}) {
  const [revealed, setRevealed] = useState<boolean[]>(() => cards.map(() => false));
  const [centerIdx, setCenterIdx] = useState<number | null>(null);
  const [centerFaceup, setCenterFaceup] = useState(false);

  const allRevealed = revealed.every(Boolean);
  const nextIdx = revealed.indexOf(false); // -1 if all revealed

  // Auto-flip the centre card once it's arrived from the row.
  useEffect(() => {
    if (centerIdx === null || centerFaceup) return;
    const t = setTimeout(() => setCenterFaceup(true), ARRIVE_MS);
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
      {/* Row of cards at the bottom */}
      <div className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-3">
        {cards.map((card, idx) => {
          // Hold the slot open while a card is at centre stage so the row
          // doesn't reflow.
          if (idx === centerIdx) {
            return (
              <div
                key={idx}
                style={{ width: ROW_CARD_W, height: ROW_CARD_W / (1488 / 2079) }}
              />
            );
          }
          const isNext = idx === nextIdx;
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
                isNext && !revealed[idx]
                  ? { y: [0, -3, 0] }
                  : { y: 0 }
              }
              transition={
                isNext && !revealed[idx]
                  ? { y: { duration: 1.4, repeat: Infinity, ease: "easeInOut" } }
                  : { duration: 0.2 }
              }
              whileTap={isNext && !revealed[idx] ? { scale: 0.94 } : undefined}
            >
              <CardReveal
                card={card}
                pack={pack}
                faceup={revealed[idx]}
                size={ROW_CARD_W}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Centre stage card */}
      <AnimatePresence>
        {centerIdx !== null && (
          <motion.button
            key={centerIdx}
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
      </AnimatePresence>

      {/* Done button after all 5 cards have been revealed */}
      <AnimatePresence>
        {allRevealed && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
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
