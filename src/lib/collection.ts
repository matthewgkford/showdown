import type { CollectionState, PacksInventory } from "@/types/collection";

// localStorage keys are namespaced so a future migration to a real backend
// can find them by prefix. Schema versioning isn't included in v1 — if the
// shape changes, write a one-shot migration in the same place we read.
const COLLECTION_KEY = "showdown:collection";
const PACKS_KEY = "showdown:packs";

const EMPTY_COLLECTION: CollectionState = { cards: {} };
const EMPTY_INVENTORY: PacksInventory = { packs: {} };

// Module-level singletons. useSyncExternalStore depends on snapshot calls
// returning the same reference across renders when state hasn't changed —
// only mutation functions create new references.
let collectionState: CollectionState = EMPTY_COLLECTION;
let packsState: PacksInventory = EMPTY_INVENTORY;
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
    const raw = window.localStorage.getItem(COLLECTION_KEY);
    if (raw) collectionState = JSON.parse(raw) as CollectionState;
  } catch {
    // Corrupted state — keep the empty default.
  }
  try {
    const raw = window.localStorage.getItem(PACKS_KEY);
    if (raw) packsState = JSON.parse(raw) as PacksInventory;
  } catch {
    // Corrupted state — keep the empty default.
  }
}

function persistCollection(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLLECTION_KEY, JSON.stringify(collectionState));
  } catch {
    // Quota exceeded or storage disabled — silently fail in v1.
  }
}

function persistPacks(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PACKS_KEY, JSON.stringify(packsState));
  } catch {
    // ditto
  }
}

// ─── Subscribe / snapshot API for useSyncExternalStore ───────────────────

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCollectionSnapshot(): CollectionState {
  loadInitial();
  return collectionState;
}

export function getPacksSnapshot(): PacksInventory {
  loadInitial();
  return packsState;
}

// SSR snapshots — must return a stable reference. They're the same EMPTY
// constants we use as the post-load default, so when localStorage is empty
// the client render also returns this exact reference and React doesn't
// trigger a hydration-mismatch warning.
export function getCollectionServerSnapshot(): CollectionState {
  return EMPTY_COLLECTION;
}
export function getPacksServerSnapshot(): PacksInventory {
  return EMPTY_INVENTORY;
}

// ─── Mutation API ────────────────────────────────────────────────────────

export function addToCollection(cardIds: string[]): CollectionState {
  loadInitial();
  const cards = { ...collectionState.cards };
  for (const id of cardIds) {
    cards[id] = (cards[id] ?? 0) + 1;
  }
  collectionState = { cards };
  persistCollection();
  notify();
  return collectionState;
}

export function resetCollection(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(COLLECTION_KEY);
  }
  collectionState = EMPTY_COLLECTION;
  notify();
}

export function consumePack(packId: string): PacksInventory {
  loadInitial();
  const packs = { ...packsState.packs };
  const count = packs[packId] ?? 0;
  if (count <= 1) {
    delete packs[packId];
  } else {
    packs[packId] = count - 1;
  }
  packsState = { packs };
  persistPacks();
  notify();
  return packsState;
}

export function grantPack(packId: string, count: number = 1): PacksInventory {
  loadInitial();
  const packs = { ...packsState.packs };
  packs[packId] = (packs[packId] ?? 0) + count;
  packsState = { packs };
  persistPacks();
  notify();
  return packsState;
}

export function grantPacks(packIds: string[]): PacksInventory {
  loadInitial();
  const packs = { ...packsState.packs };
  for (const id of packIds) {
    packs[id] = (packs[id] ?? 0) + 1;
  }
  packsState = { packs };
  persistPacks();
  notify();
  return packsState;
}

export function resetPacks(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(PACKS_KEY);
  }
  packsState = EMPTY_INVENTORY;
  notify();
}
