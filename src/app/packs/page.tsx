"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import packsData from "@data/packs.json";
import cardsData from "@data/cards.json";
import type { Card as CardType } from "@/types/card";
import type { Pack } from "@/types/collection";
import type { EarnedPack } from "@/types/rewards";
import { RARITY_TEXT_CLASS, getCardRarity } from "@/lib/rarity";
import {
  addToCollection,
  consumePack,
  getPacksServerSnapshot,
  getPacksSnapshot,
  grantPacks,
  subscribe,
} from "@/lib/collection";
import {
  getRewardsServerSnapshot,
  getRewardsSnapshot,
  subscribe as subscribeRewards,
} from "@/lib/rewards";

const allCards = cardsData as CardType[];
const cardById = new Map(allCards.map((c) => [c.id, c]));
const allPacks = packsData as Pack[];
const packById = new Map(allPacks.map((p) => [p.id, p]));

export default function PacksPage() {
  const inv = useSyncExternalStore(
    subscribe,
    getPacksSnapshot,
    getPacksServerSnapshot,
  );
  const rewards = useSyncExternalStore(
    subscribeRewards,
    getRewardsSnapshot,
    getRewardsServerSnapshot,
  );

  const owned = useMemo(() => {
    const out: { pack: Pack; count: number }[] = [];
    for (const [id, count] of Object.entries(inv.packs)) {
      const pack = packById.get(id);
      if (!pack || count <= 0) continue;
      out.push({ pack, count });
    }
    // Stable order — same as the JSON
    out.sort(
      (a, b) =>
        allPacks.findIndex((p) => p.id === a.pack.id) -
        allPacks.findIndex((p) => p.id === b.pack.id),
    );
    return out;
  }, [inv]);

  const totalPacks = owned.reduce((a, p) => a + p.count, 0) + rewards.length;

  function debugOpen(packId: string) {
    const pack = packById.get(packId);
    if (!pack) return;
    addToCollection(pack.cardIds);
    consumePack(packId);
  }

  function handleGrantStarters() {
    grantPacks(allPacks.map((p) => p.id));
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Packs</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {totalPacks === 0 ? "No unopened packs." : `${totalPacks} unopened`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/collection"
              className="rounded-full border border-zinc-700 px-3 py-2 text-xs sm:text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
            >
              Collection
            </Link>
            <Link
              href="/"
              className="rounded-full border border-zinc-700 px-3 py-2 text-xs sm:text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
            >
              Home
            </Link>
          </div>
        </header>

        {totalPacks === 0 ? (
          <EmptyState onGrantStarters={handleGrantStarters} />
        ) : (
          <>
            {rewards.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-400">
                  Season rewards
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {rewards.map((pack) => (
                    <RewardTile key={pack.instanceId} pack={pack} />
                  ))}
                </div>
              </section>
            )}
            {owned.length > 0 && (
              <section>
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Starter packs
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {owned.map(({ pack, count }) => (
                    <PackTile
                      key={pack.id}
                      pack={pack}
                      count={count}
                      onDebugOpen={() => debugOpen(pack.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function EmptyState({ onGrantStarters }: { onGrantStarters: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 sm:p-12 text-center">
      <div className="text-2xl sm:text-3xl font-bold tracking-tight">
        No unopened packs
      </div>
      <p className="mt-2 max-w-md mx-auto text-sm text-zinc-400">
        Earn packs by playing games (coming in Stage 4), or grant yourself
        the four starter packs to get going.
      </p>
      <button
        onClick={onGrantStarters}
        className="mt-6 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
      >
        Grant 4 starter packs
      </button>
    </div>
  );
}

function PackTile({
  pack,
  count,
  onDebugOpen,
}: {
  pack: Pack;
  count: number;
  onDebugOpen: () => void;
}) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <div
        className="relative mb-3 overflow-hidden rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${pack.accentColor}55, ${pack.accentColor}10 60%, transparent)`,
        }}
      >
        <div className="px-4 py-6 sm:py-8">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: pack.accentColor }}
          >
            Pack
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-bold tracking-tight">
            {pack.name}
          </div>
          <div className="mt-1 text-xs text-zinc-300/80">
            {pack.cardIds.length} cards · {pack.description}
          </div>
        </div>
        {count > 1 && (
          <span className="absolute top-2 right-2 rounded-full bg-zinc-950/80 px-2 py-0.5 text-[10px] font-bold text-zinc-100 ring-1 ring-zinc-700">
            ×{count}
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5 text-[10px]">
        {pack.cardIds.map((id) => {
          const card = cardById.get(id);
          if (!card) return null;
          const r = getCardRarity(card);
          return (
            <span
              key={id}
              className={`rounded bg-zinc-900 px-1.5 py-0.5 ${RARITY_TEXT_CLASS[r]}`}
            >
              {card.name}
            </span>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Link
          href={`/packs/${pack.id}/open`}
          className="flex-1 rounded-md bg-emerald-500 px-3 py-2 text-center text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
        >
          Open
        </Link>
        <button
          onClick={onDebugOpen}
          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
          title="Add cards instantly without the reveal animation"
        >
          Skip
        </button>
      </div>
    </article>
  );
}

function RewardTile({ pack }: { pack: EarnedPack }) {
  // Earned packs have their cards baked in at award time. Show the
  // rarity badge counts as a tease (1 hero + 3 fillers without spoiling
  // who specifically). Tinted with the player team's accent.
  const cards = pack.cardIds
    .map((id) => cardById.get(id))
    .filter((c): c is CardType => Boolean(c));
  const rarities = cards.map((c) => getCardRarity(c));

  return (
    <article
      className="rounded-2xl border p-4 sm:p-5"
      style={{
        borderColor: `${pack.accentColor}55`,
        backgroundColor: `${pack.accentColor}0d`,
      }}
    >
      <div
        className="relative mb-3 overflow-hidden rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${pack.accentColor}66, ${pack.accentColor}11 60%, transparent)`,
        }}
      >
        <div className="px-4 py-6 sm:py-8">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: pack.accentColor }}
          >
            Win reward
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-bold tracking-tight">
            {pack.label}
          </div>
          <div className="mt-1 text-xs text-zinc-300/80">
            {cards.length} cards · 1 hero + {cards.length - 1} fillers
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5 text-[10px]">
        {rarities.map((r, i) => (
          <span
            key={i}
            className={`rounded bg-zinc-900 px-1.5 py-0.5 capitalize ${RARITY_TEXT_CLASS[r]}`}
          >
            {r}
          </span>
        ))}
      </div>

      <Link
        href={`/packs/earned/${pack.instanceId}/open`}
        className="block rounded-md bg-emerald-500 px-3 py-2 text-center text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
      >
        Open
      </Link>
    </article>
  );
}
