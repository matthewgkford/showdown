import type { Bases } from "@/lib/gameState";

export function BaseDiamond({ bases }: { bases: Bases }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-12 w-12 sm:h-14 sm:w-14"
      aria-label="bases"
    >
      {/* Outfield grass */}
      <rect width="100" height="100" rx="3" fill="#2a5c32" />
      {/* Infield dirt */}
      <polygon points="50,18 82,50 50,82 18,50" fill="#b8844a" />
      {/* Infield grass – inner diamond creates visible basepath strips */}
      <polygon points="50,30 70,50 50,70 30,50" fill="#306b3a" />
      {/* Baselines */}
      <polygon
        points="50,18 82,50 50,82 18,50"
        fill="none"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      {/* Pitcher's mound */}
      <circle cx="50" cy="50" r="4" fill="#c4956a" />
      {/* 2nd base (top) */}
      <Base x={50} y={18} occupied={!!bases.second} />
      {/* 3rd base (left) */}
      <Base x={18} y={50} occupied={!!bases.third} />
      {/* 1st base (right) */}
      <Base x={82} y={50} occupied={!!bases.first} />
      {/* Home plate */}
      <rect
        x={42}
        y={74}
        width={16}
        height={16}
        transform="rotate(45 50 82)"
        fill="rgba(255,255,255,0.8)"
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
      fill={occupied ? "#22c55e" : "rgba(255,255,255,0.75)"}
      stroke={occupied ? "#4ade80" : "rgba(255,255,255,0.9)"}
      strokeWidth={1.5}
    />
  );
}
