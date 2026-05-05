import { getRoster } from "@/lib/rosters";
import type { Roster } from "@/types/roster";

// The player's customised roster — same shape as a starting roster
// from data/rosters.json, but stored as a localStorage override so
// cards earned from packs can replace starters. Other teams' rosters
// are not customisable; they're part of the league design.
//
// The override is "lazy" — null until the player makes their first
// swap, at which point we copy the default roster for their team and
// start mutating that.
const KEY = "showdown:player-roster";

let state: Roster | null = null;
let initialized = false;

const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function loadInitial(): void {
  if (initialized) return;
  initialized = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as Roster;
  } catch {
    // Corrupted state — keep null.
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    if (state === null) {
      window.localStorage.removeItem(KEY);
    } else {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    }
  } catch {
    // Quota / disabled — silently fail.
  }
}

// ─── Subscribe / snapshot API ───────────────────────────────────────────

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPlayerRosterSnapshot(): Roster | null {
  loadInitial();
  return state;
}

export function getPlayerRosterServerSnapshot(): Roster | null {
  return null;
}

// Returns the override if it exists AND matches the requested team.
// Used by callers that want "the active roster for this team" — they
// fall back to the default if this returns null.
export function getOverrideFor(teamSlug: string): Roster | null {
  loadInitial();
  if (!state || state.teamSlug !== teamSlug) return null;
  return state;
}

// ─── Mutation API ───────────────────────────────────────────────────────

// Initialise the override from the default roster for a team if one
// doesn't already exist. Returns the resulting override (always non-null
// after this call, assuming the team has a default).
function ensureOverride(playerSlug: string): Roster | null {
  loadInitial();
  if (state && state.teamSlug === playerSlug) return state;
  const def = getRoster(playerSlug);
  if (!def) return null;
  // Deep copy arrays so subsequent edits don't mutate the imported JSON.
  state = {
    teamSlug: def.teamSlug,
    batters: [...def.batters],
    startingPitcher: def.startingPitcher,
    relievers: [...def.relievers],
  };
  persist();
  notify();
  return state;
}

export function swapBatter(
  playerSlug: string,
  slotIdx: number,
  newCardId: string,
): Roster | null {
  const override = ensureOverride(playerSlug);
  if (!override) return null;
  if (slotIdx < 0 || slotIdx >= override.batters.length) return override;
  const batters = [...override.batters];
  batters[slotIdx] = newCardId;
  state = { ...override, batters };
  persist();
  notify();
  return state;
}

// Swap two batters within the lineup — used for reordering the batting
// order without changing who's on the active roster. No-op if either
// index is out of range or both are the same.
export function swapBatterSlots(
  playerSlug: string,
  idxA: number,
  idxB: number,
): Roster | null {
  const override = ensureOverride(playerSlug);
  if (!override) return null;
  if (idxA === idxB) return override;
  if (idxA < 0 || idxA >= override.batters.length) return override;
  if (idxB < 0 || idxB >= override.batters.length) return override;
  const batters = [...override.batters];
  [batters[idxA], batters[idxB]] = [batters[idxB], batters[idxA]];
  state = { ...override, batters };
  persist();
  notify();
  return state;
}

// Replace the entire batting order with a new permutation. Used by
// drag-and-drop reordering in the team page edit mode. Validates the
// new array is a true permutation of the current batters (same length,
// same set of card ids) so a malformed call can't quietly drop or
// duplicate cards.
export function setBatters(
  playerSlug: string,
  newOrder: string[],
): Roster | null {
  const override = ensureOverride(playerSlug);
  if (!override) return null;
  if (newOrder.length !== override.batters.length) return override;
  const existing = new Set(override.batters);
  if (newOrder.some((id) => !existing.has(id))) return override;
  if (new Set(newOrder).size !== newOrder.length) return override;
  state = { ...override, batters: [...newOrder] };
  persist();
  notify();
  return state;
}

export function swapStartingPitcher(
  playerSlug: string,
  newCardId: string,
): Roster | null {
  const override = ensureOverride(playerSlug);
  if (!override) return null;
  state = { ...override, startingPitcher: newCardId };
  persist();
  notify();
  return state;
}

export function swapReliever(
  playerSlug: string,
  slotIdx: number,
  newCardId: string,
): Roster | null {
  const override = ensureOverride(playerSlug);
  if (!override) return null;
  if (slotIdx < 0 || slotIdx >= override.relievers.length) return override;
  const relievers = [...override.relievers];
  relievers[slotIdx] = newCardId;
  state = { ...override, relievers };
  persist();
  notify();
  return state;
}

// Drop the override entirely — next read falls back to the team's
// default starting roster. Used by the "Reset to default" button and
// when the player switches teams via choose-team.
export function resetPlayerRoster(): void {
  loadInitial();
  state = null;
  persist();
  notify();
}
