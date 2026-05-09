"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import cardsData from "@data/cards.json";
import packsData from "@data/packs.json";
import type { Card as CardType } from "@/types/card";
import type { Pack, Rarity } from "@/types/collection";
import {
  RARITY_ASCENDING,
  RARITY_LABEL,
  RARITY_RING_CLASS,
  RARITY_TEXT_CLASS,
  getCardRarity,
} from "@/lib/rarity";
import {
  addToCollection,
  getCollectionServerSnapshot,
  getCollectionSnapshot,
  getPacksServerSnapshot,
  getPacksSnapshot,
  grantPacks,
  resetCollection,
  resetPacks,
  subscribe,
} from "@/lib/collection";

const allCards = cardsData as CardType[];
const cardById = new Map(allCards.map((c) => [c.id, c]));
const allPacks = packsData as Pack[];
const STARTER_PACK_IDS = allPacks.map((p) => p.id);

type Entry = { card: CardType; count: number; rarity: Rarity };

export default function CollectionPage() {
  const collection = useSyncExternalStore(
    subscribe,
    getCollectionSnapshot,
    getCollectionServerSnapshot,
  );
  const packs = useSyncExternalStore(
    subscribe,
    getPacksSnapshot,
    getPacksServerSnapshot,
  );

  const entries: Entry[] = useMemo(() => {
    const out: Entry[] = [];
    for (const [id, count] of Object.entries(collection.cards)) {
      const card = cardById.get(id);
      if (!card || count <= 0) continue;
      out.push({ card, count, rarity: getCardRarity(card) });
    }
    return out;
  }, [collection]);

  const grouped = useMemo(() => {
    const map = new Map<Rarity, Entry[]>();
    for (const e of entries) {
      const list = map.get(e.rarity) ?? [];
      list.push(e);
      map.set(e.rarity, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.card.points - a.card.points);
    }
    return map;
  }, [entries]);

  const ownedPackCount = Object.values(packs.packs).reduce((a, b) => a + b, 0);

  const totalCards = entries.reduce((a, e) => a + e.count, 0);
  const uniqueCards = entries.length;

  // Mutation handlers — useSyncExternalStore re-renders on its own when
  // the store notifies, so we don't need to wire setState here.
  function handleGrantStarters() {
    grantPacks(STARTER_PACK_IDS);
  }
  function handleResetCollection() {
    resetCollection();
  }
  function handleResetPacks() {
    resetPacks();
  }
  function handleDebugFillCollection() {
    addToCollection(allCards.map((c) => c.id));
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-8 pb-24">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Collection</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {totalCards === 0
                ? "No cards yet."
                : `${uniqueCards} unique · ${totalCards} cards · ${ownedPackCount} pack${
                    ownedPackCount === 1 ? "" : "s"
                  } unopened`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-full border border-zinc-700 px-3 py-2 text-xs sm:text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
            >
              Home
            </Link>
            <Link
              href="/packs"
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
            >
              Packs
              {ownedPackCount > 0 && (
                <span className="ml-1.5 rounded-full bg-zinc-950/30 px-1.5 py-0.5 text-[10px]">
                  {ownedPackCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {entries.length === 0 ? (
          <EmptyState
            ownedPackCount={ownedPackCount}
            onGrantStarters={handleGrantStarters}
          />
        ) : (
          <>
            {RARITY_ASCENDING.slice()
              .reverse()
              .map((r) => {
                const list = grouped.get(r);
                if (!list || list.length === 0) return null;
                return (
                  <RaritySection key={r} rarity={r} entries={list} />
                );
              })}
          </>
        )}

        <DebugSection
          onGrantStarters={handleGrantStarters}
          onResetPacks={handleResetPacks}
          onResetCollection={handleResetCollection}
          onFillCollection={handleDebugFillCollection}
        />
      </div>
    </main>
  );
}

function EmptyState({
  ownedPackCount,
  onGrantStarters,
}: {
  ownedPackCount: number;
  onGrantStarters: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 sm:p-12 text-center">
      <div className="text-2xl sm:text-3xl font-bold tracking-tight">
        No cards yet
      </div>
      <p className="mt-2 max-w-md mx-auto text-sm text-zinc-400">
        Open a pack to start your collection.
      </p>
      {ownedPackCount === 0 ? (
        <button
          onClick={onGrantStarters}
          className="mt-6 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
        >
          Grant 4 starter packs
        </button>
      ) : (
        <Link
          href="/packs"
          className="mt-6 inline-block rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
        >
          Open packs ({ownedPackCount}) →
        </Link>
      )}
    </div>
  );
}

function RaritySection({
  rarity,
  entries,
}: {
  rarity: Rarity;
  entries: Entry[];
}) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="mb-3 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wider">
        <span className={RARITY_TEXT_CLASS[rarity]}>{RARITY_LABEL[rarity]}</span>
        <span className="text-zinc-600">· {entries.length}</span>
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {entries.map(({ card, count, rarity }) => (
          <CardTile key={card.id} card={card} count={count} rarity={rarity} />
        ))}
      </div>
    </section>
  );
}

function CardTile({
  card,
  count,
  rarity,
}: {
  card: CardType;
  count: number;
  rarity: Rarity;
}) {
  return (
    <div className="relative">
      <Image
        src={`/cards/${card.id}.webp`}
        alt={card.name}
        width={1488}
        height={2079}
        className={`block w-full h-auto rounded-xl shadow-md shadow-black/40 ring-1 ${RARITY_RING_CLASS[rarity]}`}
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
      />
      {count > 1 && (
        <span className="absolute top-2 right-2 rounded-full bg-zinc-950/80 px-2 py-0.5 text-[10px] font-bold text-zinc-100 ring-1 ring-zinc-700">
          ×{count}
        </span>
      )}
    </div>
  );
}

function DebugSection({
  onGrantStarters,
  onResetPacks,
  onResetCollection,
  onFillCollection,
}: {
  onGrantStarters: () => void;
  onResetPacks: () => void;
  onResetCollection: () => void;
  onFillCollection: () => void;
}) {
  return (
    <section className="mt-12 border-t border-zinc-900 pt-6">
      <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
        Debug
      </h2>
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          onClick={onGrantStarters}
          className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-zinc-300 hover:border-zinc-600"
        >
          Grant 4 starter packs
        </button>
        <button
          onClick={onFillCollection}
          className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-zinc-300 hover:border-zinc-600"
        >
          +1 of every card
        </button>
        <button
          onClick={onResetPacks}
          className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-rose-300 hover:border-rose-700"
        >
          Reset packs
        </button>
        <button
          onClick={onResetCollection}
          className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-rose-300 hover:border-rose-700"
        >
          Reset collection
        </button>
      </div>
    </section>
  );
}
