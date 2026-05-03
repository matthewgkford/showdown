# Showdown App

A digital version of the MLB Showdown card game, playable on phone, tablet, and desktop. v1 lets you play single 9-inning games with custom teams built from a roster of manually-entered cards. Long-term goal is full season mode with trades, drafts, and stat tracking.

## Status

**Phase 0 (Pre-Code Setup)**: Complete
- Card data model defined (`docs/data-model.md`)
- 23 starter cards entered (`data/cards.json`)
- Tech stack chosen: Next.js + TypeScript + Tailwind, deployed to Vercel
- Design decisions logged (`docs/decisions.md`)

**Phase 1 (Project Setup)**: Not started
- Set up Next.js project, GitHub, Vercel deployment

See `TODO.md` (in Notion) for the full v1 phase plan.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion (for dice rolls)
- **Data storage**: JSON files in `data/` for v1 (no database)
- **Deployment**: Vercel
- **Hosting platform**: Web app (works on phone, tablet, desktop)

## Folder structure

```
/
├── app/              # Next.js App Router pages
├── components/       # React components (Card, Dice, etc.)
├── data/             # JSON data files
│   ├── cards.json    # All player cards
│   └── teams.json    # Custom-built teams (Phase 7+)
├── docs/             # Project documentation
│   ├── data-model.md # Card data structure reference
│   ├── game-rules.md # Which Showdown rules are implemented
│   └── decisions.md  # Design decision log
├── lib/              # Game logic and utilities
│   ├── game.ts       # Core engine (dice, advantage, results)
│   └── gameState.ts  # Game state management
└── types/            # TypeScript type definitions
    └── card.ts       # Card, BatterCard, PitcherCard types
```

## v1 Scope

The v1 game lets you:

- Browse a library of ~23 manually-entered cards
- Build custom teams (name, colors, logo, roster)
- Pick two teams and set lineups
- Play through 9 innings, managing both sides
- Tap an animated d20 to roll dice; see suspenseful pitch → advantage → swing → result reveals
- Make decisions: pinch hitters, pitching changes
- See a final score and basic box score

## Out of scope for v1

- Strategy cards
- Stolen bases / advanced baserunning decisions
- AI opponent
- Save/load games
- Season mode, trades, drafts
- Stats tracking across games
- Importing cards from images (OCR)
- Multiplayer

These are deferred to v2+.

## Working with Claude Code

When starting a new Claude Code session on this project, point it at this README and the relevant docs:

- For card-related work: `docs/data-model.md`
- For game rules questions: `docs/game-rules.md`
- For "why did we do it this way": `docs/decisions.md`

Update `docs/decisions.md` whenever a design choice is made — even small ones. Future-you will thank present-you.
