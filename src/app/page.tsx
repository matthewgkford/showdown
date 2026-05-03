import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import cardsData from "@data/cards.json";
import { Card } from "@/components/Card";
import type { Card as CardType, BatterCard, PitcherCard } from "@/types/card";

const cards = cardsData as CardType[];

function loadAvailableImages(): Set<string> {
  const dir = path.join(process.cwd(), "public", "cards");
  if (!fs.existsSync(dir)) return new Set();
  return new Set(
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".png"))
      .map((f) => f.replace(/\.png$/, "")),
  );
}

export default function Home() {
  const haveImages = loadAvailableImages();
  const batters = cards.filter((c): c is BatterCard => c.cardType === "batter");
  const pitchers = cards.filter((c): c is PitcherCard => c.cardType === "pitcher");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Showdown</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {cards.length} cards · {batters.length} batters · {pitchers.length} pitchers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/at-bat"
              className="rounded-full border border-zinc-700 px-3 py-2 text-xs sm:text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
            >
              At-bat
            </Link>
            <Link
              href="/game"
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
            >
              New game →
            </Link>
          </div>
        </header>

        <Section title="Batters" count={batters.length}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {batters.map((c) => (
              <Card key={c.id} card={c} hasImage={haveImages.has(c.id)} />
            ))}
          </div>
        </Section>

        <Section title="Pitchers" count={pitchers.length}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pitchers.map((c) => (
              <Card key={c.id} card={c} hasImage={haveImages.has(c.id)} />
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {title} <span className="text-zinc-600">· {count}</span>
      </h2>
      {children}
    </section>
  );
}
