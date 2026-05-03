import type { GameState, TeamState } from "@/lib/gameState";

export function Scoreboard({ state }: { state: GameState }) {
  return (
    <div className="flex items-center justify-between gap-2 sm:gap-4 text-xs sm:text-sm">
      <div className="flex items-center gap-1.5">
        <span aria-label={state.half === "top" ? "top" : "bottom"} className="text-zinc-400">
          {state.half === "top" ? "▲" : "▼"}
        </span>
        <span className="font-bold text-zinc-100">{state.inning}</span>
      </div>

      <div className="flex items-center gap-2 font-mono">
        <TeamScore team={state.away} batting={state.half === "top"} />
        <span className="text-zinc-700">·</span>
        <TeamScore team={state.home} batting={state.half === "bottom"} reverse />
      </div>

      <div className="flex items-center gap-1">
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
  const dot = (
    <span
      className="h-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: batting ? team.team.color : "transparent" }}
      aria-hidden
    />
  );
  return (
    <div className="flex items-center gap-1">
      {!reverse && dot}
      <span
        className="font-semibold"
        style={{ color: batting ? team.team.color : undefined }}
      >
        {team.team.shortName}
      </span>
      <span className="text-zinc-100 font-bold tabular-nums">{team.runs}</span>
      {reverse && dot}
    </div>
  );
}
