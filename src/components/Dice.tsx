"use client";

import { motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { diceGradientStops } from "@/lib/teamColor";

type Status = "idle" | "rolling" | "settled";
type Tone = "neutral" | "pitcher" | "batter";

const TUMBLE_MS = 900;
const TUMBLE_TICK_MS = 70;

const TONE_STOPS: Record<Tone, [string, string]> = {
  neutral: ["#52525b", "#27272a"], // zinc 600 → 800
  pitcher: ["#fb7185", "#9f1239"], // rose 400 → 800
  batter: ["#38bdf8", "#075985"], // sky 400 → 800
};

export function Dice({
  status,
  value,
  label,
  onTap,
  tone = "neutral",
  baseColor,
}: {
  status: Status;
  value: number | null;
  label: string;
  onTap?: () => void;
  tone?: Tone;
  // When set, overrides `tone` and derives a light→dark gradient from
  // the given hex colour. Used in live games to tint the active die in
  // the acting team's colour.
  baseColor?: string;
}) {
  const [tumbleFace, setTumbleFace] = useState<number>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status === "rolling") {
      intervalRef.current = setInterval(() => {
        setTumbleFace(Math.floor(Math.random() * 20) + 1);
      }, TUMBLE_TICK_MS);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [status]);

  const tappable = status === "idle" && !!onTap;
  const display: number | string =
    status === "settled" && value !== null
      ? value
      : status === "rolling"
        ? tumbleFace
        : "?";

  return (
    <div className="flex flex-col items-center gap-1">
      <motion.button
        type="button"
        disabled={!tappable}
        onClick={onTap}
        animate={
          status === "rolling"
            ? { rotate: [0, 360, 720, 1080], scale: [1, 1.08, 0.96, 1] }
            : status === "settled"
              ? { rotate: 0, scale: [1.15, 1] }
              : { rotate: 0, scale: 1 }
        }
        transition={
          status === "rolling"
            ? { duration: TUMBLE_MS / 1000, ease: "easeOut" }
            : { duration: 0.25, ease: "easeOut" }
        }
        className={`relative h-16 w-16 sm:h-20 sm:w-20 select-none ${
          tappable
            ? "cursor-pointer hover:brightness-110 active:brightness-95"
            : "cursor-default"
        } ${status === "idle" ? "opacity-80" : "opacity-100"}`}
      >
        <D20 value={display} tone={tone} baseColor={baseColor} />
        {tappable && (
          <span className="absolute inset-0 rounded-full ring-4 ring-emerald-400/50 animate-pulse pointer-events-none" />
        )}
      </motion.button>
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
    </div>
  );
}

function D20({
  value,
  tone,
  baseColor,
}: {
  value: number | string;
  tone: Tone;
  baseColor?: string;
}) {
  const rawId = useId();
  const gradId = `d${rawId.replace(/:/g, "")}`;

  const [stopA, stopB] = baseColor
    ? diceGradientStops(baseColor)
    : TONE_STOPS[tone];
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-full w-full drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stopA} />
          <stop offset="100%" stopColor={stopB} />
        </linearGradient>
      </defs>

      {/*
        Pointy-top regular hex (T, TR, BR, B, BL, TL) with three
        inner vertices forming the front face:
          A (apex, upper-middle), L (base-left), R (base-right)
        The interior splits into the main face (A-L-R) plus 9
        surrounding triangles — 10 visible facets, mirroring what
        you'd see looking at a real icosahedron face-on.
        Coordinates chosen so A-L-R is approximately equilateral
        (side ~50) and the front face is large enough for "20".
      */}
      {/* hexagonal silhouette filled with the gradient */}
      <polygon
        points="50,5 89,27.5 89,72.5 50,95 11,72.5 11,27.5"
        fill={`url(#${gradId})`}
        stroke="rgba(0,0,0,0.5)"
        strokeWidth="1"
        strokeLinejoin="round"
      />

      {/* nine surrounding facets, shaded as if lit from the top-left */}
      {/* upper ring */}
      <polygon points="50,5 11,27.5 50,22" fill="rgba(0,0,0,0.06)" />
      <polygon points="50,5 89,27.5 50,22" fill="rgba(0,0,0,0.20)" />
      {/* upper flanks */}
      <polygon points="11,27.5 50,22 25,65" fill="rgba(0,0,0,0.02)" />
      <polygon points="89,27.5 50,22 75,65" fill="rgba(0,0,0,0.26)" />
      {/* mid flanks */}
      <polygon points="11,27.5 25,65 11,72.5" fill="rgba(0,0,0,0.10)" />
      <polygon points="89,27.5 75,65 89,72.5" fill="rgba(0,0,0,0.32)" />
      {/* lower ring */}
      <polygon points="11,72.5 25,65 50,95" fill="rgba(0,0,0,0.28)" />
      <polygon points="89,72.5 75,65 50,95" fill="rgba(0,0,0,0.38)" />
      <polygon points="25,65 75,65 50,95" fill="rgba(0,0,0,0.20)" />

      {/* equilateral front face holding the rolled value */}
      <polygon
        points="50,22 25,65 75,65"
        fill="rgba(255,255,255,0.18)"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* facet edges across the rest of the die — thin highlights */}
      <g
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.4"
        strokeLinejoin="round"
        fill="none"
      >
        <line x1="50" y1="5" x2="50" y2="22" />
        <line x1="11" y1="27.5" x2="50" y2="22" />
        <line x1="89" y1="27.5" x2="50" y2="22" />
        <line x1="11" y1="27.5" x2="25" y2="65" />
        <line x1="89" y1="27.5" x2="75" y2="65" />
        <line x1="11" y1="72.5" x2="25" y2="65" />
        <line x1="89" y1="72.5" x2="75" y2="65" />
        <line x1="25" y1="65" x2="50" y2="95" />
        <line x1="75" y1="65" x2="50" y2="95" />
      </g>

      {/* the rolled value, sitting in the wider lower half of the front face */}
      <text
        x="50"
        y="55"
        textAnchor="middle"
        fontSize="22"
        fontWeight="800"
        fill="white"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        style={{ paintOrder: "stroke fill" }}
        stroke="rgba(0,0,0,0.45)"
        strokeWidth="1.2"
      >
        {value}
      </text>
    </svg>
  );
}

export const DICE_TUMBLE_MS = TUMBLE_MS;
