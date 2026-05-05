"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import cardsData from "@data/cards.json";
import type { Card } from "@/types/card";
import type { Pack } from "@/types/collection";
import { sortForReveal } from "@/lib/rarity";
import { addToCollection } from "@/lib/collection";
import {
  consumeReward,
  getRewardsServerSnapshot,
  getRewardsSnapshot,
  subscribe,
} from "@/lib/rewards";
import { SealedPack } from "@/components/PackOpening/SealedPack";
import { RevealSequence } from "@/components/PackOpening/RevealSequence";

const allCards = cardsData as Card[];
const cardById = new Map(allCards.map((c) => [c.id, c]));

type Phase = "sealed" | "revealing";

// Open route for season-win packs. Mirrors /packs/[packId]/open but
// pulls the pack instance from the rewards store (rather than
// data/packs.json) so we can hand it the pre-rolled cards baked in at
// award time. Reuses the same SealedPack + RevealSequence components.
export default function OpenEarnedPackPage() {
  const router = useRouter();
  const params = useParams<{ instanceId: string }>();
  const instanceId = params.instanceId;

  const rewards = useSyncExternalStore(
    subscribe,
    getRewardsSnapshot,
    getRewardsServerSnapshot,
  );

  // Find the instance once and freeze it in local state — consumeReward
  // removes it from the store after the player completes the reveal,
  // and we don't want the page to flip into "not found" mid-animation.
  const [reward] = useState(() =>
    rewards.find((r) => r.instanceId === instanceId) ?? null,
  );

  // If we don't yet have a hydrated rewards list (SSR snapshot is empty),
  // try again from the just-arrived list.
  const live = useMemo(
    () => reward ?? rewards.find((r) => r.instanceId === instanceId) ?? null,
    [reward, rewards, instanceId],
  );

  const orderedCards = useMemo(() => {
    if (!live) return [];
    const cards = live.cardIds
      .map((id) => cardById.get(id))
      .filter((c): c is Card => Boolean(c));
    return sortForReveal(cards);
  }, [live]);

  const synthPack = useMemo<Pack | null>(() => {
    if (!live) return null;
    return {
      id: live.instanceId,
      name: live.label,
      description: "Earned by winning a season game",
      accentColor: live.accentColor,
      cardIds: live.cardIds,
    };
  }, [live]);

  const [phase, setPhase] = useState<Phase>("sealed");

  useEffect(() => {
    // If after hydration the instance still isn't present, the player
    // probably already opened it or it's an invalid id — bounce.
    if (!live) {
      const t = setTimeout(() => router.replace("/packs"), 200);
      return () => clearTimeout(t);
    }
  }, [live, router]);

  if (!synthPack || !live) {
    return (
      <main className="h-[100dvh] flex items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Pack not found</h1>
          <Link href="/packs" className="text-sm text-emerald-400">
            ← Back to packs
          </Link>
        </div>
      </main>
    );
  }

  function handleComplete() {
    addToCollection(orderedCards.map((c) => c.id));
    consumeReward(instanceId);
    router.push("/collection");
  }

  return (
    <main
      className="relative h-[100dvh] w-full overflow-hidden bg-zinc-950 text-zinc-100"
      style={{
        backgroundImage: `radial-gradient(ellipse at center, ${synthPack.accentColor}22 0%, transparent 60%)`,
      }}
    >
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-4">
        <Link
          href="/packs"
          className="text-xs text-zinc-500 hover:text-zinc-200"
        >
          ← Cancel
        </Link>
        <div
          className="text-[10px] font-bold uppercase tracking-[0.25em]"
          style={{ color: synthPack.accentColor }}
        >
          {synthPack.name}
        </div>
        <div className="w-10" aria-hidden />
      </header>

      <div className="relative h-full w-full">
        {phase === "sealed" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <SealedPack
              pack={synthPack}
              onComplete={() => setPhase("revealing")}
            />
          </div>
        )}
        {phase === "revealing" && (
          <RevealSequence
            pack={synthPack}
            cards={orderedCards}
            onComplete={handleComplete}
          />
        )}
      </div>
    </main>
  );
}
