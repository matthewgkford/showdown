// Card rarity tiers, derived from points value (see lib/rarity.ts).
// Order in this union is also the ascending reveal order.
export type Rarity = "common" | "uncommon" | "rare" | "legendary";

// A curated pack of cards. Hand-defined in data/packs.json — not a random
// draw. cardIds reference ids in data/cards.json.
export type Pack = {
  id: string;
  name: string;
  description: string;
  // Hex color used for the pack tile gradient and accent treatments
  // (later: pack-tear glow, hero-card halo on the rarest pull).
  accentColor: string;
  cardIds: string[];
};

// Local persisted state. Stored in localStorage as JSON; structure documented
// in docs/data-model.md so a future backend migration is straightforward.
export type CollectionState = {
  // Map of cardId → number of copies owned. Duplicates are tracked as a
  // count rather than as separate entries so the collection grid can show
  // "(×3)" badges without storing redundant data.
  cards: Record<string, number>;
};

export type PacksInventory = {
  // Map of packId → number of unopened copies the user has on hand.
  packs: Record<string, number>;
};
