"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { Pack } from "@/types/collection";

// The pack sitting centre-screen with a gentle ambient bob, waiting to be
// tapped. On tap it scales up + fades out (the placeholder "tear"); after
// ~600ms it fires onComplete so the parent can swap to the reveal sequence.
//
// Stage 2 keeps this minimal — opacity/scale only. Stage 3 will replace
// this with a proper rip animation, dust particles, and a tear sound.
export function SealedPack({
  pack,
  onComplete,
}: {
  pack: Pack;
  onComplete: () => void;
}) {
  const [tearing, setTearing] = useState(false);

  function handleTap() {
    if (tearing) return;
    setTearing(true);
    setTimeout(onComplete, 550);
  }

  return (
    <motion.button
      type="button"
      onClick={handleTap}
      disabled={tearing}
      className="relative outline-none"
      animate={
        tearing
          ? { scale: 1.18, opacity: 0, rotate: -2 }
          : { scale: 1, opacity: 1, y: [0, -4, 0] }
      }
      transition={
        tearing
          ? { duration: 0.55, ease: "easeOut" }
          : { y: { duration: 2.6, repeat: Infinity, ease: "easeInOut" } }
      }
      whileHover={!tearing ? { scale: 1.04 } : undefined}
      whileTap={!tearing ? { scale: 0.97 } : undefined}
    >
      <div
        className="relative overflow-hidden rounded-2xl shadow-2xl shadow-black/70"
        style={{
          width: 220,
          height: 320,
          background: `linear-gradient(135deg, ${pack.accentColor} 0%, ${pack.accentColor}dd 45%, ${pack.accentColor}77 100%)`,
        }}
      >
        {/* Foil seam */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, transparent 0%, transparent 35%, rgba(255,255,255,0.18) 50%, transparent 65%, transparent 100%)",
          }}
        />
        {/* Inner border for "wrapper" feel */}
        <div className="pointer-events-none absolute inset-2 rounded-xl border border-white/15" />

        <div className="relative h-full flex flex-col items-center justify-center px-5 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/80">
            Showdown
          </div>
          <div className="mt-12 text-2xl font-bold text-white tracking-tight">
            {pack.name}
          </div>
          <div className="mt-1 text-[11px] text-white/60">
            {pack.cardIds.length} cards
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[10px] uppercase tracking-[0.2em] text-white/70">
          Tap to open
        </div>
      </div>
    </motion.button>
  );
}
