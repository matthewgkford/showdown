---
description: Add a new batch of cards. Converts PNGs to WebP, copies to public/cards/, and adds entries to data/cards.json.
argument-hint: /path/to/folder-of-new-pngs
---

You are adding a new batch of Showdown baseball cards to the app.

The source folder containing the new PNG files is: $ARGUMENTS

If no folder path was provided, ask the user for it before doing anything else.

---

## Step 1 — Convert and copy images

1. List every `.png` file in the source folder.
2. For each file, convert it to WebP (800px wide, quality 92) and write the result directly to `public/cards/<id>.webp`, where `<id>` is the filename without the `.png` extension.
3. Use this exact sharp invocation:
   ```js
   await sharp(src)
     .resize(800, null, { withoutEnlargement: true })
     .webp({ quality: 92 })
     .toFile(dest);
   ```
4. After converting all files, report how many were done and flag any that failed.

---

## Step 2 — Read each card image and extract stats

For each card image, use the Read tool to visually inspect it. The card ID is the filename without extension (e.g. `lindor-2025-nym`).

Read the following from the card face:

**All cards:**
- Player name
- Year, team abbreviation, full team name
- Set name (e.g. "2001")
- Points value
- Card type: `"batter"` or `"pitcher"`

**Batters additionally:**
- `onBase` — the On Base number printed on the card
- `speed` — letter (A/B/C/D) and numeric value (if speed digit shown is "20" treat as 20; see memory for Speed A default)
- `bats` — L / R / S
- `positions` — array of `{ position, fielding }` (fielding rating 1–4)
- `chart` — the hit outcome table. Each outcome maps to a `{ min, max }` range, or `null` if absent. Outcomes for batters: `so`, `gb`, `fb`, `bb`, `single`, `singlePlus`, `double`, `triple`, `homer`

**Pitchers additionally:**
- `control` — the Control number
- `ip` — innings pitched
- `throws` — L or R
- `pitcherType` — `"starter"` or `"reliever"`
- `chart` — the outcome table. Outcomes for pitchers: `pu`, `so`, `gb`, `fb`, `bb`, `single`, `double`, `homer`

---

## Step 3 — Confirm with user before writing

For each card, show the user the extracted data in a compact summary and ask them to confirm or correct it before writing. Process cards in small batches (5 at a time) so the user isn't overwhelmed.

Example summary format:
```
lindor-2025-nym — Francisco Lindor (NYM, 2025) — Batter — 400pts
  OB: 10 | Speed: A/20 | Bats: S | Pos: SS(3)
  Chart: SO 1-2, GB 3, FB 4-6, BB 7-10, 1B 11-14, 1B+ 15-16, 2B 17-18, HR 19-20
```

If anything is unclear from the image, flag it explicitly and ask the user to provide the value rather than guessing.

---

## Step 4 — Append to data/cards.json

Once confirmed, append each new card object to the end of the `data/cards.json` array. Do not reformat or re-sort the existing entries. Each new entry must follow this exact structure:

**Batter:**
```json
{
  "id": "...",
  "name": "...",
  "year": 0,
  "team": "...",
  "teamFullName": "...",
  "set": "2001",
  "points": 0,
  "cardType": "batter",
  "onBase": 0,
  "speed": { "letter": "A", "value": 20 },
  "bats": "R",
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

**Pitcher:**
```json
{
  "id": "...",
  "name": "...",
  "year": 0,
  "team": "...",
  "teamFullName": "...",
  "set": "2001",
  "points": 0,
  "cardType": "pitcher",
  "control": 0,
  "throws": "R",
  "pitcherType": "starter",
  "ip": 0,
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

---

## Step 5 — Summary

After all cards are processed, report:
- Total images converted and copied to `public/cards/`
- Total entries added to `data/cards.json`
- Any cards skipped or flagged for manual review
