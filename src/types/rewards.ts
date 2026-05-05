// A pack instance earned by winning a season game. Unlike the curated
// packs in data/packs.json (which are templates with fixed contents),
// these are runtime instances — each one has its own pre-rolled set of
// cards baked in at award time and a unique instanceId for routing.
export type EarnedPack = {
  // Unique id for this instance. Used as the URL param when opening
  // and as the key in the rewards inventory.
  instanceId: string;
  // ISO timestamp the pack was awarded.
  earnedAt: string;
  // Exact cards rolled at award time — referenced into data/cards.json.
  // Order is the order they were rolled; the open flow re-sorts for
  // reveal pacing (highest rarity last).
  cardIds: string[];
  // Display label, e.g. "Round 4 · vs Boardwalk Bandits".
  label: string;
  // Hex colour for the pack tile + reveal backdrop. Tinted with the
  // player team's accent colour at grant time so wins feel personal.
  accentColor: string;
};
