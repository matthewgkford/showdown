# Design Decisions Log

Running log of design decisions made during development. Entry format: date, decision, reasoning. Update whenever a non-obvious choice is made.

---

## 2026-05-03: Use 2001 Showdown set rules only for v1

**Decision**: Build the engine for the 2001 set rules exclusively. No support for other sets (2002–2005, CLASSIC, EXPANDED).

**Reasoning**: Each Showdown set has slightly different chart distributions and point values. Supporting multiple sets means designing for variation upfront, which adds complexity without proportional value. The 2001 set is the most canonical and has the cleanest chart structure. We can add other sets in v2 if desired.

---

## 2026-05-03: JSON files for data storage in v1, no database

**Decision**: Store cards and teams in `data/cards.json` and `data/teams.json`. No database, no API, no external storage.

**Reasoning**: The card pool starts at ~23 cards and grows slowly through manual entry. A database adds infrastructure complexity (hosting, schema migrations, connection management) for a problem we don't have yet. JSON files are version-controlled, easy to edit, and Claude Code can read/write them directly. We can migrate to a database when the data model demands it (likely when season mode arrives).

---

## 2026-05-03: Next.js + TypeScript + Tailwind, deployed to Vercel

**Decision**: Use Next.js with the App Router, TypeScript for type safety, and Tailwind for styling. Deploy to Vercel.

**Reasoning**: Phone-first web app works on all platforms with one codebase. TypeScript catches data-model errors at compile time — critical for the chart structure where typos would silently break the engine. Tailwind is fast for iteration. Vercel deploys automatically from GitHub commits, which means every push goes live and is testable on phone immediately. Already familiar with Vercel from previous project.

---

## 2026-05-03: Manual card entry rather than OCR or API

**Decision**: Cards are entered manually in `data/cards.json` by reading the card images from showdownbot.com. No automated card import for v1.

**Reasoning**: showdownbot.com doesn't expose an API. Building OCR for the card images would be a significant detour from the core game. Manual entry of ~30 cards is tedious but bulletproof, and forces us to test the data model with real cards as we go. OCR or API integration can be added in v2 if the card pool grows large.

---

## 2026-05-03: Tap-to-roll dice with suspenseful reveal flow

**Decision**: Players tap a d20 to roll, with this sequence per at-bat: (1) tap pitcher's dice → animated tumble → settle on value, (2) advantage reveal, (3) tap batter's dice → animated tumble → settle on value, (4) result announcement.

**Reasoning**: The tactile dice roll is core to what makes Showdown feel like Showdown. An auto-resolving "click to play out at-bat" version would lose the ritual. The two-tap structure preserves the original game's drama. Animation timing will need tuning during Phase 4.

---

## 2026-05-03: Stats fields on cards are optional

**Decision**: The real-life MLB stats shown on cards (batting average, OPS+, ERA, etc.) are an optional `stats` field on cards. Not entered for the initial 23 cards.

**Reasoning**: These stats are display-only and don't affect gameplay. Entering them upfront for every card is busywork. Can be added later when card detail views are built and we want richer presentation. The data model allows it without requiring it.

---

## 2026-05-03: Player ability icons (MVP, Gold Glove, etc.) deferred to v2+

**Decision**: Cards have an optional `icons` field for special abilities, but the engine ignores it for v1.

**Reasoning**: The advanced rules give players icon-based abilities (e.g., MVP allows rerolling out results twice per game). These add real complexity to the game engine and require UI for triggering them. Per the rulebook, expert rules tie icons to strategy cards instead. Cleaner to ship v1 without and add either system later. Field is reserved on the data model to avoid migration.

---

## 2026-05-04: Curated themed packs over random pools (Phase 7)

**Decision**: Each pack is hand-defined in `data/packs.json` with a fixed list of card IDs. Opening a pack always grants exactly those cards. No randomization, no probability tables.

**Reasoning**: The card pool is small enough (29 cards) that random draws would feel arbitrary and would leak which cards are common vs. rare via repetition. Curated packs let us choreograph the reveal — every "Aces" pack ends on Pedro, every "Power Hitters" pack ends on Bonds — so the rhythm of the open is consistent and the climax is real. Random pools become interesting only at scale; we'll revisit when the card pool reaches the hundreds.

---

## 2026-05-04: Collection state in localStorage for v1

**Decision**: Owned cards and unopened packs are persisted to `localStorage` under the `showdown:collection` and `showdown:packs` keys. No backend, no auth, no sync across devices.

**Reasoning**: Same logic as cards/teams in JSON files — solving infrastructure problems we don't have yet. localStorage is per-browser, free, and instantly debuggable from the dev tools. Migrating to a real DB later is straightforward: the access layer is `lib/collection.ts`; swap the safe-load/safe-save helpers for fetch calls and the rest of the app is unchanged. Schema is documented in `docs/data-model.md` so the migration shape is locked in.

---

## 2026-05-04: Rarity tiers derived from points (Phase 7)

**Decision**: Card rarity is computed purely from `points`, not stored on the card itself.

- **Common**: < 400 pts
- **Uncommon**: 400–499 pts
- **Rare**: 500–599 pts
- **Legendary**: ≥ 600 pts

The bands live in `lib/rarity.ts` (`POINTS_BANDS`) and the rest of the app derives rarity via `getCardRarity(card)`.

**Reasoning**: Showdown points already encode card "value" — they're the budgeting cost for team-building. Re-using them as the rarity signal means every new card is automatically classified, no per-card metadata to maintain. Bands chosen so the seeded pool (29 cards, 320–700 pts) lands at roughly 17/45/24/14% common/uncommon/rare/legendary, putting the four 600+ cards (Delgado, A-Rod, Bonds, Pedro) into the "money pull" tier.

To tune later: edit `POINTS_BANDS` in `lib/rarity.ts`. Nothing else needs to change.

---

## 2026-05-04: Pack reveal in ascending rarity order (Phase 7)

**Decision**: When a pack is opened, the cards are revealed in ascending rarity order (commons first, legendary last). Ties are broken by points ascending so the highest-points card in the rarest tier is always the climactic last reveal.

**Reasoning**: The MLB The Show pack-opening rhythm depends on anticipation building toward the final card. If you reveal the legendary first, the rest of the pack is anticlimactic; if you reveal randomly, the pacing is inconsistent across packs. Ordering deterministically by rarity then points means *every* pack has a clear climax — the user learns the rhythm, and the question becomes "is the last card a rare or a legendary?" which is the right tension to keep alive across packs.

The sort lives in `lib/rarity.ts` (`sortForReveal`); pack JSON can list cards in any order.

---
