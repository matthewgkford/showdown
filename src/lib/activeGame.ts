import type { GameState } from "@/lib/gameState";

// Mid-game persistence. Two independent slots so a saved exhibition game
// doesn't get clobbered by a season game and vice versa.
const SEASON_KEY = "showdown:active-game:season";
const EXHIBITION_KEY = "showdown:active-game:exhibition";

export type SeasonGameSnapshot = {
  round: number;
  awaySlug: string;
  homeSlug: string;
  state: GameState;
  savedAt: string;
};

export type ExhibitionGameSnapshot = {
  awaySlug: string;
  homeSlug: string;
  state: GameState;
  savedAt: string;
};

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / disabled — silently fail.
  }
}

function remove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ─── Season slot ──────────────────────────────────────────────────────

export function getActiveSeasonGame(): SeasonGameSnapshot | null {
  return readJson<SeasonGameSnapshot>(SEASON_KEY);
}

export function saveActiveSeasonGame(
  round: number,
  awaySlug: string,
  homeSlug: string,
  state: GameState,
): void {
  const snap: SeasonGameSnapshot = {
    round,
    awaySlug,
    homeSlug,
    state,
    savedAt: new Date().toISOString(),
  };
  writeJson(SEASON_KEY, snap);
}

export function clearActiveSeasonGame(): void {
  remove(SEASON_KEY);
}

// ─── Exhibition slot ──────────────────────────────────────────────────

export function getActiveExhibitionGame(): ExhibitionGameSnapshot | null {
  return readJson<ExhibitionGameSnapshot>(EXHIBITION_KEY);
}

export function saveActiveExhibitionGame(
  awaySlug: string,
  homeSlug: string,
  state: GameState,
): void {
  const snap: ExhibitionGameSnapshot = {
    awaySlug,
    homeSlug,
    state,
    savedAt: new Date().toISOString(),
  };
  writeJson(EXHIBITION_KEY, snap);
}

export function clearActiveExhibitionGame(): void {
  remove(EXHIBITION_KEY);
}
