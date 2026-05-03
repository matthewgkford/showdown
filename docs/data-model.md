# Card Data Model

This document defines the structure of MLB Showdown cards in the Showdown app. All cards in `data/cards.json` conform to this model.

## Overview

A card represents either a batter or a pitcher. The `cardType` field discriminates between them. Both share common metadata fields, then have type-specific fields and charts.

## Common fields (all cards)

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier (e.g., `"lindor-2025-nym"`). Lowercase, hyphenated. |
| `name` | string | Player's display name (e.g., `"Francisco Lindor"`) |
| `year` | number | Season the stats represent (e.g., `2001`, `2025`) |
| `team` | string | MLB team abbreviation (e.g., `"NYM"`, `"OAK"`, `"BOS"`) |
| `teamFullName` | string | Full team name for display (e.g., `"New York Mets"`) |
| `set` | string | Showdown set identifier. Always `"2001"` for v1. |
| `points` | number | Point cost for team-building budget (e.g., `400`, `570`) |
| `cardType` | enum | `"batter"` or `"pitcher"` — the discriminator field |
| `imageUrl` | string (optional) | Path to the card image, if displaying the original |
| `icons` | string[] (optional) | Special ability icons (e.g., `["MVP", "GG"]`). Deferred for v1; field included for forward compatibility. |

## Batter-specific fields

| Field | Type | Description |
|---|---|---|
| `onBase` | number | The On-Base value (1–20). Used in pitch advantage calculation. |
| `speed` | Speed | Player speed (see below) |
| `bats` | enum | `"L"` (left), `"R"` (right), or `"S"` (switch) |
| `positions` | Position[] | Positions this player can play, with fielding bonuses |
| `chart` | BatterChart | The swing-result chart (see below) |

### Speed object

```json
{ "letter": "A", "value": 20 }
```

- `letter`: `"A"`, `"B"`, or `"C"` — the speed grade. Only matters for strategy cards (deferred to v2+).
- `value`: The actual numeric speed used in the engine for double-play attempts and extra-base attempts.

All pitchers are Speed C (8) per the rulebook — this is hardcoded in the engine, not stored on pitcher cards.

### Positions array

```json
[{ "position": "SS", "fielding": 3 }]
```

Or for multi-position players:

```json
[
  { "position": "LF", "fielding": 1 },
  { "position": "RF", "fielding": 1 }
]
```

Valid `position` values: `"CA"`, `"1B"`, `"2B"`, `"3B"`, `"SS"`, `"LF"`, `"CF"`, `"RF"`, `"OF"` (qualifies at all 3 outfield positions), `"IF"` (qualifies at all 4 infield positions), `"DH"` (designated hitter only — no field position).

For catchers, `fielding` represents the catcher's Arm value (used in steal attempts, deferred to v2+). For all other position players, it's the standard fielding bonus.

## Pitcher-specific fields

| Field | Type | Description |
|---|---|---|
| `control` | number | The Control value. Added to pitch roll in advantage calculation. |
| `throws` | enum | `"L"` (LHP) or `"R"` (RHP) |
| `pitcherType` | enum | `"starter"`, `"reliever"`, or `"closer"` |
| `ip` | number | Innings Pitched limit. Pitcher gets -1 to pitch rolls per inning beyond this. |
| `chart` | PitcherChart | The swing-result chart (see below) |

Pitchers don't have `positions` (always P) or `speed` (always C(8)) — these are handled in engine logic.

## Charts

A chart maps a d20 roll to an at-bat result. Each result type either has a range `{ min, max }` or is `null` if that result doesn't appear on the card.

### BatterChart

```typescript
{
  so:         ChartRange,  // Strikeout
  gb:         ChartRange,  // Ground ball out
  fb:         ChartRange,  // Fly ball out
  bb:         ChartRange,  // Walk
  single:     ChartRange,  // 1B
  singlePlus: ChartRange,  // 1B+ (single with auto-steal of 2nd)
  double:     ChartRange,  // 2B
  triple:     ChartRange,  // 3B
  homer:      ChartRange   // HR
}
```

Note: batter charts don't have `pu` (pop-up out).

### PitcherChart

```typescript
{
  pu:     ChartRange,  // Pop-up out
  so:     ChartRange,  // Strikeout
  gb:     ChartRange,  // Ground ball out
  fb:     ChartRange,  // Fly ball out
  bb:     ChartRange,  // Walk
  single: ChartRange,  // 1B
  double: ChartRange,  // 2B
  homer:  ChartRange   // HR
}
```

Note: pitcher charts don't have `singlePlus` or `triple`.

### ChartRange

```typescript
type ChartRange = { min: number; max: number } | null;
```

- `{ min: 11, max: 14 }` means rolls 11, 12, 13, or 14 produce this result.
- `null` means this result type doesn't appear on the card (shown as `—` on the physical card).

Ranges never overlap on a single card. Every roll 1–20 maps to exactly one result.

## Worked example: Francisco Lindor

```json
{
  "id": "lindor-2025-nym",
  "name": "Francisco Lindor",
  "year": 2025,
  "team": "NYM",
  "teamFullName": "New York Mets",
  "set": "2001",
  "points": 400,
  "cardType": "batter",
  "onBase": 10,
  "speed": { "letter": "A", "value": 20 },
  "bats": "S",
  "positions": [{ "position": "SS", "fielding": 3 }],
  "chart": {
    "so": { "min": 1, "max": 2 },
    "gb": { "min": 3, "max": 3 },
    "fb": { "min": 4, "max": 6 },
    "bb": { "min": 7, "max": 10 },
    "single": { "min": 11, "max": 14 },
    "singlePlus": { "min": 15, "max": 16 },
    "double": { "min": 17, "max": 18 },
    "triple": null,
    "homer": { "min": 19, "max": 20 }
  }
}
```

## Worked example: Pedro Martinez

```json
{
  "id": "pedro-bos",
  "name": "Pedro Martinez",
  "year": 2001,
  "team": "BOS",
  "teamFullName": "Boston Red Sox",
  "set": "2001",
  "points": 700,
  "cardType": "pitcher",
  "control": 5,
  "throws": "R",
  "pitcherType": "starter",
  "ip": 7,
  "chart": {
    "pu": { "min": 1, "max": 2 },
    "so": { "min": 3, "max": 10 },
    "gb": { "min": 11, "max": 14 },
    "fb": { "min": 15, "max": 17 },
    "bb": { "min": 18, "max": 18 },
    "single": { "min": 19, "max": 20 },
    "double": null,
    "homer": null
  }
}
```

## TypeScript reference

When implementing in `types/card.ts`:

```typescript
type ChartRange = { min: number; max: number } | null;

type BatterChart = {
  so: ChartRange;
  gb: ChartRange;
  fb: ChartRange;
  bb: ChartRange;
  single: ChartRange;
  singlePlus: ChartRange;
  double: ChartRange;
  triple: ChartRange;
  homer: ChartRange;
};

type PitcherChart = {
  pu: ChartRange;
  so: ChartRange;
  gb: ChartRange;
  fb: ChartRange;
  bb: ChartRange;
  single: ChartRange;
  double: ChartRange;
  homer: ChartRange;
};

type Speed = { letter: "A" | "B" | "C"; value: number };

type Position = {
  position: "CA" | "1B" | "2B" | "3B" | "SS" | "LF" | "CF" | "RF" | "OF" | "IF" | "DH";
  fielding: number;
};

type BaseCard = {
  id: string;
  name: string;
  year: number;
  team: string;
  teamFullName: string;
  set: string;
  points: number;
  imageUrl?: string;
  icons?: string[];
};

type BatterCard = BaseCard & {
  cardType: "batter";
  onBase: number;
  speed: Speed;
  bats: "L" | "R" | "S";
  positions: Position[];
  chart: BatterChart;
};

type PitcherCard = BaseCard & {
  cardType: "pitcher";
  control: number;
  throws: "L" | "R";
  pitcherType: "starter" | "reliever" | "closer";
  ip: number;
  chart: PitcherChart;
};

type Card = BatterCard | PitcherCard;
```
