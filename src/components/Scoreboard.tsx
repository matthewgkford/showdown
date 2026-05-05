import Image from "next/image";
import type { GameState, TeamState } from "@/lib/gameState";
import { getTeamDisplayColor } from "@/lib/teamColor";

export function Scoreboard({ state }: { state: GameState }) {
  return (
    <div className="flex items-center justify-between gap-2 sm:gap-4 text-xs sm:text-sm">
      <div className="flex items-center gap-1.5 shrink-0">
        <span aria-label={state.half === "top" ? "top" : "bottom"} className="text-zinc-400">
          {state.half === "top" ? "▲" : "▼"}
        </span>
        <span className="font-bold text-zinc-100">{state.inning}</span>
        {state.inning > 9 && (
          <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
            ext
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 font-mono min-w-0">
        <TeamScore team={state.away} batting={state.half === "top"} />
        <span className="text-zinc-700 shrink-0">·</span>
        <TeamScore team={state.home} batting={state.half === "bottom"} reverse />
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Out</span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${
              i < state.outs ? "bg-rose-500" : "bg-zinc-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function TeamScore({
  team,
  batting,
  reverse,
}: {
  team: TeamState;
  batting: boolean;
  reverse?: boolean;
}) {
  // The "currently batting" cue is a thin glow on the logo — uses the
  // team's display colour (accent for most, light for teams whose accent
  // is too dark on the zinc-950 background).
  const displayColor = getTeamDisplayColor(team.team);
  const logo = (
    <span
      className={`shrink-0 inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-md ring-1 transition-colors ${
        batting ? "bg-zinc-900/80" : "bg-transparent"
      }`}
      style={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ["--tw-ring-color" as any]: batting ? displayColor : "transparent",
      }}
      aria-label={team.team.name}
    >
      <Image
        src={team.team.logos.primary}
        alt=""
        width={48}
        height={48}
        className="h-full w-full rounded-md object-contain"
      />
    </span>
  );
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {!reverse && logo}
      <span className="text-zinc-100 font-bold tabular-nums">{team.runs}</span>
      {reverse && logo}
    </div>
  );
}
