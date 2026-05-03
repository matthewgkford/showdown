"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type Status = "idle" | "rolling" | "settled";

const TUMBLE_MS = 900;
const TUMBLE_TICK_MS = 70;

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
  tone?: "neutral" | "pitcher" | "batter";
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
  const display =
    status === "settled"
      ? value
      : status === "rolling"
        ? tumbleFace
        : "?";

  const toneClass =
    tone === "pitcher"
      ? "from-rose-500 to-rose-700 ring-rose-300/30"
      : tone === "batter"
        ? "from-sky-500 to-sky-700 ring-sky-300/30"
        : "from-zinc-600 to-zinc-800 ring-zinc-400/20";

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
        className={`relative h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br ${toneClass} ring-2 shadow-lg shadow-black/40 flex items-center justify-center font-mono text-2xl sm:text-3xl font-bold text-white select-none ${
          tappable
            ? "cursor-pointer hover:brightness-110 active:brightness-95"
            : "cursor-default"
        } ${status === "idle" ? "opacity-70" : "opacity-100"}`}
      >
        <span>{display}</span>
        {tappable && (
          <span className="absolute inset-0 rounded-2xl ring-4 ring-emerald-400/50 animate-pulse pointer-events-none" />
        )}
      </motion.button>
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
    </div>
  );
}

export const DICE_TUMBLE_MS = TUMBLE_MS;
