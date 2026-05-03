import cardsData from "@data/cards.json";
import { Card } from "@/components/Card";
import type { Card as CardType, BatterCard, PitcherCard } from "@/types/card";

const cards = cardsData as CardType[];

export default function Home() {
  const batters = cards.filter((c): c is BatterCard => c.cardType === "batter");
  const pitchers = cards.filter((c): c is PitcherCard => c.cardType === "pitcher");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Showdown</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {cards.length} cards · {batters.length} batters · {pitchers.length} pitchers
          </p>
        </header>

        <Section title="Batters" count={batters.length}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {batters.map((c) => (
              <Card key={c.id} card={c} />
            ))}
          </div>
        </Section>

        <Section title="Pitchers" count={pitchers.length}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pitchers.map((c) => (
              <Card key={c.id} card={c} />
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
