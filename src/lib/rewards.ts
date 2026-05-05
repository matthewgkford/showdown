import type { EarnedPack } from "@/types/rewards";

// Inventory of unopened pack instances earned from season wins. Stored
// as an ordered list (oldest first) under "showdown:rewards". Each
// instance has its own pre-rolled cardIds so the contents are stable
// across reloads — the player can leave a pack unopened and come back
// to the same draw later.
const REWARDS_KEY = "showdown:rewards";

let rewardsState: EarnedPack[] = [];
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
    const raw = window.localStorage.getItem(REWARDS_KEY);
    if (raw) rewardsState = JSON.parse(raw) as EarnedPack[];
  } catch {
    // Corrupted state — keep empty.
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REWARDS_KEY, JSON.stringify(rewardsState));
  } catch {
    // Quota / disabled — silently fail.
  }
}

// ─── Subscribe / snapshot API ─────────────────────────────────────────

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRewardsSnapshot(): EarnedPack[] {
  loadInitial();
  return rewardsState;
}

const EMPTY_REWARDS: EarnedPack[] = [];
export function getRewardsServerSnapshot(): EarnedPack[] {
  return EMPTY_REWARDS;
}

// ─── Mutation API ─────────────────────────────────────────────────────

export function grantReward(pack: EarnedPack): void {
  loadInitial();
  rewardsState = [...rewardsState, pack];
  persist();
  notify();
}

export function consumeReward(instanceId: string): void {
  loadInitial();
  rewardsState = rewardsState.filter((p) => p.instanceId !== instanceId);
  persist();
  notify();
}

export function getReward(instanceId: string): EarnedPack | null {
  loadInitial();
  return rewardsState.find((p) => p.instanceId === instanceId) ?? null;
}

export function resetRewards(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(REWARDS_KEY);
  }
  rewardsState = [];
  notify();
}

// Generate a unique instance id. Combines timestamp with a short
// random suffix so two grants in the same millisecond don't collide.
export function newInstanceId(): string {
  const ts = Date.now().toString(36);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `win-${ts}-${suffix}`;
}
