"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { Card } from "@/types/card";
import type { Pack } from "@/types/collection";

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
export function CardReveal({
  card,
  pack,
  faceup,
  size,
}: {
  card: Card;
  pack: Pack;
  faceup: boolean;
  size: number;
}) {
  const w = size;
  const h = size / CARD_ASPECT;

  return (
    <div
      style={{ width: w, height: h, perspective: 1200 }}
      className="select-none"
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: faceup ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      >
        <div
          className="absolute inset-0 rounded-lg overflow-hidden shadow-md shadow-black/50"
          style={{ backfaceVisibility: "hidden" }}
        >
          <CardBack pack={pack} />
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
    </div>
  );
}

function CardBack({ pack }: { pack: Pack }) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center"
      style={{
        background: `linear-gradient(135deg, ${pack.accentColor} 0%, ${pack.accentColor}cc 50%, ${pack.accentColor}55 100%)`,
      }}
    >
      <div
        className="absolute inset-2 rounded-md border"
        style={{ borderColor: "rgba(255,255,255,0.18)" }}
      />
      <div className="text-[7px] sm:text-[9px] font-bold uppercase tracking-[0.3em] text-white/80">
        Showdown
      </div>
      <div className="mt-1 text-white/40 text-base sm:text-lg font-bold">●</div>
    </div>
  );
}
