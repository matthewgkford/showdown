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
  // Always color the team name with its display colour — accent for most
  // teams, light for teams whose accent is too dark for the dark theme.
  // The "currently batting" cue is now a tinted dot beside the name.
  const displayColor = getTeamDisplayColor(team.team);
  const dot = (
    <span
      className="h-1.5 w-1.5 rounded-full shrink-0"
      style={{ backgroundColor: batting ? displayColor : "transparent" }}
      aria-hidden
    />
  );
  return (
    <div className="flex items-center gap-1 min-w-0">
      {!reverse && dot}
      <span
        className="font-semibold truncate"
        style={{ color: displayColor }}
      >
        {team.team.shortName}
      </span>
      <span className="text-zinc-100 font-bold tabular-nums">{team.runs}</span>
      {reverse && dot}
    </div>
  );
}
