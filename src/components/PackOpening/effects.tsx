"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Rarity } from "@/types/collection";

// ─────────────────────────────────────────────────────────────────────────────
// Pre-flip rarity glow — the "ooh wait, is that gold?" moment.
//
// Renders as a pulsing box-shadow halo behind the card. Common cards get no
// glow; uncommon a soft white pulse; rare a gold halo; legendary a fuchsia
// halo with a hue rotation overlay so the colour drifts subtly.
// ─────────────────────────────────────────────────────────────────────────────

const GLOW_CONFIG: Record<Exclude<Rarity, "common">, {
  color: string;
  base: number;
  peak: number;
}> = {
  uncommon: { color: "rgba(255,255,255,0.42)", base: 18, peak: 32 },
  rare: { color: "rgba(251,191,36,0.55)", base: 28, peak: 56 },
  legendary: { color: "rgba(232,121,249,0.7)", base: 38, peak: 78 },
};

export function RarityGlow({ rarity }: { rarity: Rarity }) {
  const reduced = useReducedMotion();
  if (rarity === "common") return null;
  const cfg = GLOW_CONFIG[rarity];

  if (reduced) {
    return (
      <div
        aria-hidden
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{ boxShadow: `0 0 ${cfg.peak}px ${cfg.color}` }}
      />
    );
  }

  return (
    <motion.div
      aria-hidden
      className="absolute inset-0 rounded-lg pointer-events-none"
      animate={{
        boxShadow: [
          `0 0 ${cfg.base}px ${cfg.color}`,
          `0 0 ${cfg.peak}px ${cfg.color}`,
          `0 0 ${cfg.base}px ${cfg.color}`,
        ],
      }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// Legendary cards get an additional holographic "rainbow" wash on top so the
// glow looks alive. Hue-rotation on a fuchsia gradient overlay.
export function LegendaryHolo({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  if (!active) return null;
  if (reduced) {
    return (
      <div
        aria-hidden
        className="absolute inset-0 rounded-lg pointer-events-none mix-blend-overlay"
        style={{
          background:
            "linear-gradient(120deg, rgba(232,121,249,0.18), rgba(56,189,248,0.18), rgba(251,191,36,0.18))",
        }}
      />
    );
  }
  return (
    <motion.div
      aria-hidden
      className="absolute inset-0 rounded-lg pointer-events-none mix-blend-overlay"
      style={{
        background:
          "linear-gradient(120deg, rgba(232,121,249,0.22), rgba(56,189,248,0.22), rgba(251,191,36,0.22))",
      }}
      animate={{ filter: ["hue-rotate(0deg)", "hue-rotate(360deg)"] }}
      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Light burst — fires once when a rare/legendary card lands face-up.
//
// The parent component bumps `triggerKey` after rotateY completes; key={triggerKey}
// remounts the burst so it re-animates from scratch on every flip.
// ─────────────────────────────────────────────────────────────────────────────

export function FlipBurst({ rarity }: { rarity: Rarity }) {
  const reduced = useReducedMotion();
  if (reduced || rarity === "common" || rarity === "uncommon") return null;
  const colour =
    rarity === "legendary"
      ? "rgba(232,121,249,0.65)"
      : "rgba(251,191,36,0.55)";
  return (
    <motion.div
      aria-hidden
      className="absolute inset-0 rounded-lg pointer-events-none"
      initial={{ opacity: 0.85, scale: 1 }}
      animate={{ opacity: 0, scale: 1.9 }}
      transition={{ duration: 0.75, ease: "easeOut" }}
      style={{
        background: `radial-gradient(circle, ${colour} 0%, transparent 70%)`,
      }}
    />
  );
}
