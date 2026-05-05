import type { PitcherCard } from "@/types/card";

// Pick the next reliever to bring in from a bullpen, given the current
// inning. Heuristic:
//
//   - 9th inning or later → prefer the closer (this is what the player
//     would do — save them for the save).
//   - Earlier than 9th → use a regular reliever, save the closer.
//   - Falls back to whatever's available if the preferred bucket is
//     empty.
//
// Returns null if the bullpen is empty.
export function pickReliever(
  bullpen: PitcherCard[],
  currentInning: number,
): PitcherCard | null {
  if (bullpen.length === 0) return null;
  if (currentInning >= 9) {
    const closer = bullpen.find((p) => p.pitcherType === "closer");
    if (closer) return closer;
  }
  const reliever = bullpen.find((p) => p.pitcherType !== "closer");
  if (reliever) return reliever;
  return bullpen[0];
}
