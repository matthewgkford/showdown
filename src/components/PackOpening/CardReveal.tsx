"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import type { Card } from "@/types/card";
import type { Pack, Rarity } from "@/types/collection";
import { FlipBurst, LegendaryHolo, RarityGlow } from "./effects";

const CARD_W = 1488;
const CARD_H = 2079;
const CARD_ASPECT = CARD_W / CARD_H;

// A single card with a 3D flip from face-down (pack art) to face-up (the
// real card image). The wrapper sets the size; the inner motion.div does
// the rotateY animation. backface-visibility hides whichever side is
// rotated past 90°.
//
// `size` is the card's pixel width; height is derived from the card aspect
// so the same component works at row scale (small) and centre scale (big).
//
// Optional polish:
// - `rarity` + `showGlow`: pulse a rarity-coloured halo behind the card
//   (Stage 3 — the "is that gold?" moment before the flip).
// - `rarity` + `triggerBurst`: fire a one-shot expanding burst when the
//   flip completes for rare/legendary pulls.
//
// Reduced-motion users get a plain front/back swap instead of the 3D
// rotation.
export function CardReveal({
  card,
  pack,
  faceup,
  size,
  rarity,
  showGlow = false,
}: {
  card: Card;
  pack: Pack;
  faceup: boolean;
  size: number;
  rarity?: Rarity;
  showGlow?: boolean;
}) {
  const reduced = useReducedMotion();
  const w = size;
  const h = size / CARD_ASPECT;
  const [burstKey, setBurstKey] = useState(0);

  return (
    <div
      style={{ width: w, height: h, perspective: 1200 }}
      className="relative select-none"
    >
      {showGlow && rarity && <RarityGlow rarity={rarity} />}
      {showGlow && rarity === "legendary" && <LegendaryHolo active />}

      {reduced ? (
        // Reduced motion: no 3D flip; just swap face-down ↔ face-up.
        <div className="relative w-full h-full">
          <div
            className="absolute inset-0 rounded-lg overflow-hidden shadow-md shadow-black/50 transition-opacity duration-300"
            style={{ opacity: faceup ? 0 : 1 }}
          >
            <CardBack pack={pack} size={size} />
          </div>
          <div
            className="absolute inset-0 rounded-lg overflow-hidden shadow-md shadow-black/50 transition-opacity duration-300"
            style={{ opacity: faceup ? 1 : 0 }}
          >
            <Image
              src={`/cards/${card.id}.png`}
              alt={card.name}
              width={CARD_W}
              height={CARD_H}
              className="block w-full h-full object-cover"
              sizes={`${Math.ceil(size * 2)}px`}
              priority
            />
          </div>
        </div>
      ) : (
        <motion.div
          className="relative w-full h-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: faceup ? 180 : 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          onAnimationComplete={() => {
            if (faceup && (rarity === "rare" || rarity === "legendary")) {
              setBurstKey((k) => k + 1);
            }
          }}
        >
          <div
            className="absolute inset-0 rounded-lg overflow-hidden shadow-md shadow-black/50"
            style={{ backfaceVisibility: "hidden" }}
          >
            <CardBack pack={pack} size={size} />
          </div>
          <div
            className="absolute inset-0 rounded-lg overflow-hidden shadow-md shadow-black/50"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <Image
              src={`/cards/${card.id}.png`}
              alt={card.name}
              width={CARD_W}
              height={CARD_H}
              className="block w-full h-full object-cover"
              sizes={`${Math.ceil(size * 2)}px`}
              priority
            />
          </div>
        </motion.div>
      )}

      {/* Burst plays on rarity-tier flip-complete; key remount replays it. */}
      {burstKey > 0 && rarity && <FlipBurst key={burstKey} rarity={rarity} />}
    </div>
  );
}

function CardBack({ pack, size }: { pack: Pack; size: number }) {
  // Scale text + letter-spacing to the card width, not the viewport. The
  // wordmark is decorative — at small sizes we drop the tracking so it
  // doesn't overflow the rounded edge.
  const fontSize = Math.max(6, Math.min(13, size * 0.045));
  const tracking = size > 100 ? "0.3em" : "0.16em";
  const dotSize = Math.max(8, Math.min(22, size * 0.075));

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center"
      style={{
        background: `linear-gradient(135deg, ${pack.accentColor} 0%, ${pack.accentColor}cc 50%, ${pack.accentColor}55 100%)`,
      }}
    >
      <div
        className="absolute inset-2 rounded-md border"
        style={{ borderColor: "rgba(255,255,255,0.18)" }}
      />
      <div
        className="font-bold uppercase text-white/80"
        style={{ fontSize, letterSpacing: tracking }}
      >
        Showdown
      </div>
      <div
        className="mt-1 text-white/40 font-bold"
        style={{ fontSize: dotSize }}
      >
        ●
      </div>
    </div>
  );
}
