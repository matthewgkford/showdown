"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import packsData from "@data/packs.json";
import cardsData from "@data/cards.json";
import type { Card } from "@/types/card";
import type { Pack } from "@/types/collection";
import { sortForReveal } from "@/lib/rarity";
import { addToCollection, consumePack } from "@/lib/collection";
import { SealedPack } from "@/components/PackOpening/SealedPack";
import { RevealSequence } from "@/components/PackOpening/RevealSequence";

const allPacks = packsData as Pack[];
const allCards = cardsData as Card[];
const cardById = new Map(allCards.map((c) => [c.id, c]));

type Phase = "sealed" | "revealing";

export default function OpenPackPage() {
  const router = useRouter();
  const params = useParams<{ packId: string }>();
  const packId = params.packId;
  const pack = useMemo(
    () => allPacks.find((p) => p.id === packId) ?? null,
    [packId],
  );
  const orderedCards = useMemo(() => {
    if (!pack) return [];
    const cards = pack.cardIds
      .map((id) => cardById.get(id))
      .filter((c): c is Card => Boolean(c));
    return sortForReveal(cards);
  }, [pack]);

  const [phase, setPhase] = useState<Phase>("sealed");

  if (!pack) {
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
    consumePack(packId);
    router.push("/collection");
  }

  return (
    <main
      className="relative h-[100dvh] w-full overflow-hidden bg-zinc-950 text-zinc-100"
      style={{
        // Subtle radial backdrop tinted with the pack accent colour so the
        // pack and reveal feel like they sit in front of a stage light.
        backgroundImage: `radial-gradient(ellipse at center, ${pack.accentColor}22 0%, transparent 60%)`,
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
          style={{ color: pack.accentColor }}
        >
          {pack.name}
        </div>
        <div className="w-10" aria-hidden />
      </header>

      <div className="relative h-full w-full">
        {phase === "sealed" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <SealedPack
              pack={pack}
              onComplete={() => setPhase("revealing")}
            />
          </div>
        )}
        {phase === "revealing" && (
          <RevealSequence
            pack={pack}
            cards={orderedCards}
            onComplete={handleComplete}
          />
        )}
      </div>
    </main>
  );
}
