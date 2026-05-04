import type { SeasonState } from "@/types/season";

// localStorage key. Same prefix convention as collection/packs so a future
// backend migration can find them by namespace.
const SEASON_KEY = "showdown:season";

// Module-level singleton, same useSyncExternalStore pattern as lib/collection.
// Mutation functions create new references; getSnapshot returns the same
// reference until something changes.
let seasonState: SeasonState | null = null;
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
    const raw = window.localStorage.getItem(SEASON_KEY);
    if (raw) seasonState = JSON.parse(raw) as SeasonState;
  } catch {
    // Corrupted state — keep null.
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    if (seasonState === null) {
      window.localStorage.removeItem(SEASON_KEY);
    } else {
      window.localStorage.setItem(SEASON_KEY, JSON.stringify(seasonState));
    }
  } catch {
    // Quota / disabled — silently fail.
  }
}

// ─── Subscribe / snapshot API for useSyncExternalStore ──────────────────

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSeasonSnapshot(): SeasonState | null {
  loadInitial();
  return seasonState;
}

// SSR snapshot — must be a stable null. The first client render after
// hydration may swap to a real state if localStorage has one; that's
// expected and triggers a single re-render.
export function getSeasonServerSnapshot(): SeasonState | null {
  return null;
}

// ─── Mutation API ───────────────────────────────────────────────────────

export function startSeason(playerTeamSlug: string): SeasonState {
  loadInitial();
  seasonState = {
    playerTeamSlug,
    currentLeagueTier: 1,
    startedAt: new Date().toISOString(),
  };
  persist();
  notify();
  return seasonState;
}

export function resetSeason(): void {
  loadInitial();
  seasonState = null;
  persist();
  notify();
}
