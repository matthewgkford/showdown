import type { Bases } from "@/lib/gameState";

export function BaseDiamond({ bases }: { bases: Bases }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-12 w-12 sm:h-14 sm:w-14"
      aria-label="bases"
    >
      {/* dashed diamond outline */}
      <polygon
        points="50,18 82,50 50,82 18,50"
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="2"
        strokeDasharray="3 3"
        strokeLinejoin="round"
      />
      {/* 2nd base (top) */}
      <Base x={50} y={18} occupied={!!bases.second} />
      {/* 3rd base (left) */}
      <Base x={18} y={50} occupied={!!bases.third} />
      {/* 1st base (right) */}
      <Base x={82} y={50} occupied={!!bases.first} />
      {/* home plate (bottom) */}
      <rect
        x={42}
        y={74}
        width={16}
        height={16}
        transform="rotate(45 50 82)"
        fill="rgba(255,255,255,0.5)"
      />
    </svg>
  );
}

function Base({ x, y, occupied }: { x: number; y: number; occupied: boolean }) {
  return (
    <rect
      x={x - 8}
      y={y - 8}
      width={16}
      height={16}
      transform={`rotate(45 ${x} ${y})`}
      fill={occupied ? "#10b981" : "rgba(255,255,255,0.05)"}
      stroke={occupied ? "#10b981" : "rgba(255,255,255,0.4)"}
      strokeWidth={1.5}
    />
  );
}
