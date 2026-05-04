import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import cardsData from "@data/cards.json";
import { getDivisionForTeam, getTeamBySlug } from "@/lib/teams";
import { getRoster } from "@/lib/rosters";
import {
  RARITY_TEXT_CLASS,
  getCardRarity,
} from "@/lib/rarity";
import type {
  BatterCard,
  Card as CardType,
  PitcherCard,
} from "@/types/card";

const CARDS = cardsData as CardType[];
const cardById = new Map(CARDS.map((c) => [c.id, c]));

export default async function TeamPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const team = getTeamBySlug(slug);
  if (!team) notFound();
  const roster = getRoster(slug);
  if (!roster) notFound();
  const division = getDivisionForTeam(slug);

  const batters = roster.batters
    .map((id) => cardById.get(id))
    .filter((c): c is BatterCard => Boolean(c) && c!.cardType === "batter");
  const sp = cardById.get(roster.startingPitcher);
  const bullpen = roster.relievers
    .map((id) => cardById.get(id))
    .filter((c): c is PitcherCard => Boolean(c) && c!.cardType === "pitcher");

  const totalPoints =
    batters.reduce((s, c) => s + c.points, 0) +
    (sp?.points ?? 0) +
    bullpen.reduce((s, c) => s + c.points, 0);

  return (
    <main
      className="min-h-screen bg-zinc-950 text-zinc-100"
      style={{
        backgroundImage: `radial-gradient(ellipse 80% 50% at top, ${team.colors.primary}66 0%, transparent 60%)`,
      }}
    >
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/standings"
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            ← standings
          </Link>
          <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200">
            home
          </Link>
        </header>

        <section className="mb-10 flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
          <div className="h-32 w-32 sm:h-40 sm:w-40 flex items-center justify-center">
            <Image
              src={team.logos.primary}
              alt={team.name}
              width={320}
              height={320}
              className="h-full w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
              priority
            />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.3em]"
              style={{ color: team.colors.accent }}
            >
              {division?.name ?? "—"}
            </div>
            <h1 className="mt-1 text-3xl sm:text-5xl font-bold tracking-tight">
              {team.name}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-300/90 leading-relaxed">
              {team.flavor}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-3 sm:justify-start text-xs text-zinc-400">
              <span>
                <span className="text-zinc-500">Roster total · </span>
                <span
                  className="font-mono font-semibold"
                  style={{ color: team.colors.accent }}
                >
                  {totalPoints} pts
                </span>
              </span>
              <span className="text-zinc-700">·</span>
              <span>
                <span className="text-zinc-500">13 cards</span>
                <span className="text-zinc-600"> · 9 batters · 1 SP · 3 RP</span>
              </span>
            </div>
          </div>
        </section>

        {/* Batting order */}
        <section className="mb-10">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Batting order
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 sm:gap-3">
            {batters.map((card, idx) => (
              <RosterSlot
                key={card.id}
                card={card}
                slotLabel={String(idx + 1)}
                accentColor={team.colors.accent}
              />
            ))}
          </div>
        </section>

        {/* Starting pitcher */}
        {sp && (
          <section className="mb-10">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Starting pitcher
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
              <RosterSlot
                card={sp}
                slotLabel="SP"
                accentColor={team.colors.accent}
              />
            </div>
          </section>
        )}

        {/* Bullpen */}
        <section className="mb-10">
          <h2 className="mb-3 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Bullpen
            <span className="text-zinc-600 font-normal normal-case">
              · 3 relievers
            </span>
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
            {bullpen.map((card, idx) => (
              <RosterSlot
                key={card.id}
                card={card}
                slotLabel={`RP${idx + 1}`}
                accentColor={team.colors.accent}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function RosterSlot({
  card,
  slotLabel,
  accentColor,
}: {
  card: CardType;
  slotLabel: string;
  accentColor: string;
}) {
  const rarity = getCardRarity(card);
  return (
    <div className="relative flex flex-col gap-1.5">
      <div className="absolute -top-1 -left-1 z-10">
        <span
          className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-950"
          style={{ backgroundColor: accentColor }}
        >
          {slotLabel}
        </span>
      </div>
      <Image
        src={`/cards/${card.id}.png`}
        alt={card.name}
        width={1488}
        height={2079}
        className="block w-full h-auto rounded-lg shadow-md shadow-black/40 ring-1 ring-zinc-800"
        sizes="(min-width: 1024px) 11vw, (min-width: 640px) 20vw, 33vw"
      />
      <div className="text-[10px] truncate text-zinc-300">{card.name}</div>
      <div
        className={`text-[9px] uppercase tracking-wider ${RARITY_TEXT_CLASS[rarity]}`}
      >
        {card.points} pts
      </div>
    </div>
  );
}
