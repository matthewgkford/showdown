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

## 2026-05-04: 13-card rosters, 9 batters + 1 SP + 3 RP (Phase 8)

**Decision**: Every team's roster is exactly 13 cards: 9 batters in batting-order positions 1–9, 1 starting pitcher, 3 relievers.

**Reasoning**: Matches real-baseball lineup conventions and gives meaningful in-game decisions (lineup order, pitching changes mid-game) without a deep bench that overwhelms v1 UX. 9 batters fills the lineup with no DH-or-9 ambiguity. 1 SP keeps the starting-pitcher role single — fatigue logic still flips a switch when IP is exceeded. 3 RP gives a proper bullpen for the Phase 6 substitution UI without forcing us to find 50+ true relievers in the card pool.

---

## 2026-05-04: 18-game schedule, home-and-away round robin (Phase 8)

**Decision**: A season is exactly 18 games. Each team plays every other team in the league once at home and once away — no playoffs, no extras. Win the division, get promoted.

**Reasoning**: With 10 teams in 2 divisions, full home-and-away round-robin = 9 opponents × 2 = 18 games. That's a comfortable phone-session length over a couple of evenings, gives every matchup happens both at home and away (so Bagels-vs-Pepperoni feels rivalrous in both flavours), and keeps the win/pack reward loop tight without dragging. Playoffs would add UI surface and balance work without changing the season's emotional arc; the simpler "win your division" gating is enough for v1.

---

## 2026-05-04: Static-within-tier opponent rosters (Phase 8)

**Decision**: Opponent rosters are hand-defined in `data/rosters.json` and do not change during a season. They jump in difficulty between league tiers (via `powerLevel`) but never improve mid-season.

**Reasoning**: Player builds power; opponents stand still. That's the entire shape of the progression loop — every pack the player wins is a meaningful gain because the goalposts don't move. If opponents auto-improved week-to-week we'd be balancing two moving targets, which is harder to tune and harder for the player to feel progress against. Tiered jumps preserve the "you outgrew this league" celebration moment.

---

## 2026-05-04: Starter rosters use no legendaries, limited rares (Phase 8)

**Decision**: Starter rosters draw only from common + uncommon cards plus the 10 lowest-point rare batters and 5 lowest-point rare starters needed to fill the slot count. Every legendary card and every "good" rare card stays out of starter rosters and lives in the reward pool that pack rewards draw from. Average starter roster total is ~4,881 pts (vs. ~6,224 if every card were eligible); the 51-card reward pool covers all 25 legendaries + 26 unused rares.

**Reasoning**: If every team starts with Babe Ruth and Pedro Martinez, pack rewards feel pointless — there's nowhere meaningful to upgrade. Anchoring starter rosters to commons/uncommons (with a few low rares as fill-in) means every legendary or strong rare you pull from a pack is a tangible improvement to your lineup. The 21.6% average roster gap between starter level and the full card pool is the headroom the player closes over a season.

The "10 lowest-point rare batters" and "5 lowest-point rare starters" are chosen mechanically — when the starter pool runs short on a slot type, take the cheapest cards from the next tier up rather than dipping anywhere. Keeps the boundary clean.

---

## 2026-05-04: League tier architecture + powerLevel multiplier (Phase 8)

**Decision**: The league ladder is defined in `data/leagues.json` as tiered entries (`tier: number`, `powerLevel: number`). v1 only ships `tier: 1` (Single-A, powerLevel 1.0) as playable; `tier: 2` (Double-A, powerLevel 1.4) is a stub. Promotion = win-division. The same `data/rosters.json` is reused across tiers — at tier N, opponent rosters are passed through `applyPowerLevel(card, league.powerLevel)` which scales batter `onBase` and pitcher `control` by the multiplier.

**Reasoning**: Maintaining 10 separate rosters per tier × N tiers gets unmaintainable fast. With a multiplier, one set of hand-picked rosters serves every tier — the same Bagels lineup gets harder as you climb. Chart values stay 1–20 (they're d20 ranges by definition); only the advantage probability shifts.

The player's own roster is **never** passed through `applyPowerLevel`. Players gain power by collecting better cards from packs, not by auto-scaling. This keeps the progression loop honest: a Single-A roster that wins the division should feel meaningfully under-equipped vs. raw Double-A opponents until the player upgrades it.

---

## 2026-05-04: Reliever-shortage v1 expedient (Phase 8)

**Decision**: When the card pool has fewer "true" relievers/closers than the league needs (currently 18 vs. 30 slots across 10 teams), starter-type pitchers may fill bullpen slots. The card data does not change — it stays a starter with starter-shaped IP/stats; it's just slotted as a reliever for that team.

**Reasoning**: The Phase 6 fatigue/inning-eligibility engine reads from card stats (`pitcher.ip`, `pitcher.pitcherType`), not roster slot. A starter slotted into the bullpen retains its IP value, which means it's unusually durable as a reliever — but functionally correct. Accepted for v1; will tighten when the card pool has 30+ true relievers.

Documented loudly so reviewers understand why a 540-pt starter might appear in a team's bullpen.

---

## 2026-05-04: Pack reward formula — 4 cards, 1 rare/legendary + 3 commons (Phase 8)

**Decision**: Winning a season game generates a custom 4-card pack on the fly: 1 guaranteed rare-or-legendary "good card" plus 3 commons. Lose a game, no pack. Pack quality scales with the league tier (Single-A is the entry pool; higher tiers will pull from stronger pools).

**Reasoning**: The "1 good card" guarantee is the dopamine — every win produces a tangible reward worth opening. The 3 commons add bulk so the pack-opening Phase 7 reveal sequence still has rhythm (commons first, climax last). Loss = no pack keeps wins meaningful; we don't want to incentivise farming losses.

The "good card" is sourced from a reward pool defined as cards not already in any starter roster, OR cards stronger than the player's weakest current card — heuristic: top ~30% of available cards but not always the absolute best. Tunable per tier.

---

## 2026-05-04: Win-division → promotion (stub for v1) (Phase 8)

**Decision**: Promotion to the next league tier is triggered by winning your division at season end. v1 ships only Single-A as playable; promotion lands on a "coming soon" celebration screen and offers replay of the same league with the player's existing roster.

**Reasoning**: Winning the division is the cleanest, easiest-to-grasp promotion criterion — no playoff brackets, no top-N finishes to explain. The stub exists so the celebratory moment is preserved even though the next tier's content is v1+. Roster persists across the stub so when Double-A actually exists, the player walks in with the team they built.

---

## 2026-05-04: Season state in localStorage (Phase 8)

**Decision**: Season state lives in `localStorage` under `showdown:season` and includes `playerTeamSlug`, `currentLeagueTier`, `startedAt` (Stage 2). Stage 4 will extend with `schedule`, `completedGames`, and `careerHistory`. Same migration path as collection/packs — replace `safeLoad`/`safeSave` with authenticated fetches when a backend exists.

**Reasoning**: One unified persistence story across Phase 7 (collection, packs) and Phase 8 (season). All accessors go through `lib/season.ts`, so a future backend swap touches one file.

---

## 2026-05-04: Schedule = full 90-game double round-robin, not just player view (Phase 8 Stage 4)

**Decision**: `generateSchedule()` produces all 90 canonical games for the league (10 teams × double round-robin = 18 rounds × 5 games), not just the 18 the player participates in. SeasonState stores the entire 90-game array; the player view is filtered out as needed. Algorithm is the classic circle method with a second cycle of home/away flips, fully deterministic.

**Reasoning**: For division standings to mean anything, every team needs a real W-L record — which requires simulating the 72 background games. Storing the full schedule (with results filled in over time) keeps the season state self-contained: standings are a pure walk over the schedule, no parallel "league sim" structure.

---

## 2026-05-04: Auto-simulate non-player games on round advance (Phase 8 Stage 4)

**Decision**: When the player completes their round-N game (via the live UI), we synchronously auto-simulate every other unplayed round-N matchup using a headless wrapper around the same engine (`lib/gameSimulator.ts`). Then the round is "closed" and the standings update.

**Reasoning**: Players see realistic standings movement after every game without sitting through 4 sim animations. Using the real engine (not a coin flip with a bias) means simulated games feel consistent with player-played ones — same fatigue, same chart swings. The simulator runs ~80 at-bats per game and finishes in milliseconds, so it's fine to do inline on the result-recording call.

---

## 2026-05-04: Player roster never scales by powerLevel (Phase 8 Stage 4)

**Decision**: When constructing season matchups in `app/game/page.tsx`, the player's effective roster is always fetched at tier 1 (no scaling), regardless of which league tier they're competing in. Only the opponent gets scaled by the current tier's `powerLevel`.

**Reasoning**: Reinforces the design intent from Stage 1 — players grow stronger by collecting better cards from packs (rewards), not by automatic stat inflation. If the player's roster scaled along with opponents, tier progression would be invisible: the relative balance never changes. By holding the player constant, climbing tiers genuinely feels harder, and pack rewards are what bridges the gap.

---

## 2026-05-05: Win rewards are pre-rolled instances, not curated packs (Phase 8 Stage 5)

**Decision**: Season-win rewards are stored as `EarnedPack` instances under `showdown:rewards` — each instance has its own `instanceId` and a `cardIds` array baked in at award time. The existing `data/packs.json` template + `PacksInventory` (count by template id) system from Phase 7 is unchanged; the two coexist on the /packs page in separate sections.

**Reasoning**: Curated packs have known contents (the same cards every time you open a copy of the "Heavy Hitters" pack). Win rewards are random rolls from a 51-card pool — each instance has unique contents that need to survive across reloads. Forcing this into the curated system would require either making contents random at open time (loses determinism, hard to preview) or generating throwaway template entries (pollutes data/packs.json with hundreds of one-off entries). A separate inventory keyed by instanceId is the cleanest fit.

---

## 2026-05-05: Win pack formula — 1 hero + 3 fillers from the 51-card pool (Phase 8 Stage 5)

**Decision**: Each win drops a 4-card pack: 1 "hero" slot biased 35% legendary / 65% rare, and 3 "filler" slots drawn uniformly from the remainder of the reward pool. Because the current pool is entirely rare/legendary, fillers will be rare/legendary too — that's intentional for the small initial card set; the player needs meaningful upgrades to feel progression.

**Reasoning**: Original spec was "1 rare/legendary + 3 commons" but the reward pool is all elite cards (commons + uncommons live in the starter rosters). Going generous on fillers makes wins feel rewarding in v1. If the meta gets too elite later, easy levers: lower `HERO_LEGENDARY_CHANCE`, swap fillers to draw from `cards.json` instead of the reward pool, or shrink to 2 cards per pack.

---
