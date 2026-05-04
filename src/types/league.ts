// League tier. v1 only ships Single-A as playable; higher tiers exist as
// stubs so the multi-tier architecture is wired in from day one. When
// the player wins their division they're "promoted" to the next tier;
// for v1 promotion lands on a "coming soon" stub screen.
export type League = {
  // Numeric ladder rank. 1 = entry tier (Single-A). Higher = harder.
  tier: number;
  // URL-safe id, e.g. "single-a", "double-a".
  id: string;
  // Short label (e.g. "Single-A").
  name: string;
  // Flavour name shown in UI (e.g. "The Garden State League").
  displayName: string;
  // Multiplier applied to opponent rosters when the player is at this
  // tier. The player's own roster never scales — they build power
  // through the card pool. Opponents at tier 1 use powerLevel 1.0
  // (raw card stats); higher tiers scale the same roster definitions
  // up so the same hand-picked opponent rosters get tougher across
  // tiers without maintaining ten separate roster files per tier.
  powerLevel: number;
  // What it takes to be promoted out of this tier. v1 only implements
  // "win-division"; the union is open for future rules.
  promotionRequirement: "win-division";
  // True if this tier exists in the data but is not yet playable.
  // Promotion to a stub tier shows a "coming soon" celebration.
  stub?: boolean;
};
