"use client";

import { motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";

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
}: {
  status: Status;
  value: number | null;
  label: string;
  onTap?: () => void;
  tone?: Tone;
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
        <D20 value={display} tone={tone} />
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
}: {
  value: number | string;
  tone: Tone;
}) {
  const gradId = useId();
  const [stopA, stopB] = TONE_STOPS[tone];
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
        Regular pointy-top hexagon, vertices T, TR, BR, B, BL, TL.
        Inscribing an equilateral triangle by connecting T-BL-BR
        leaves 3 isosceles "ear" triangles around it (T-TR-BR,
        BL-B-BR, TL-T-BL). All four shapes are real triangles —
        no quadrilaterals — and the front face is equilateral.
      */}
      {/* hexagonal silhouette filled with the gradient */}
      <polygon
        points="50,5 89,27.5 89,72.5 50,95 11,72.5 11,27.5"
        fill={`url(#${gradId})`}
        stroke="rgba(0,0,0,0.5)"
        strokeWidth="1"
        strokeLinejoin="round"
      />

      {/* three surrounding "ear" triangles, dark to suggest receding faces */}
      <polygon points="50,5 89,27.5 89,72.5" fill="rgba(0,0,0,0.18)" />
      <polygon points="11,72.5 50,95 89,72.5" fill="rgba(0,0,0,0.30)" />
      <polygon points="11,27.5 50,5 11,72.5" fill="rgba(0,0,0,0.06)" />

      {/* equilateral front face holding the rolled value */}
      <polygon
        points="50,5 11,72.5 89,72.5"
        fill="rgba(255,255,255,0.10)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* the rolled value */}
      <text
        x="50"
        y="60"
        textAnchor="middle"
        fontSize="30"
        fontWeight="800"
        fill="white"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        style={{ paintOrder: "stroke fill" }}
        stroke="rgba(0,0,0,0.4)"
        strokeWidth="1.2"
      >
        {value}
      </text>
    </svg>
  );
}

export const DICE_TUMBLE_MS = TUMBLE_MS;
