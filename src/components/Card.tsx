import Image from "next/image";
import type { Card as CardType } from "@/types/card";

const CARD_WIDTH = 1488;
const CARD_HEIGHT = 2079;

export function Card({ card, hasImage }: { card: CardType; hasImage: boolean }) {
  if (hasImage) {
    return (
      <Image
        src={`/cards/${card.id}.png`}
        alt={card.name}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        className="w-full h-auto rounded-xl shadow-md shadow-black/40"
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
      />
    );
  }
  return <Placeholder card={card} />;
}

function Placeholder({ card }: { card: CardType }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center"
      style={{ aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}` }}
    >
      <div className="text-sm font-semibold text-zinc-200">{card.name}</div>
      <div className="mt-1 text-xs text-zinc-500">
        {card.year} · {card.team}
      </div>
      <div className="mt-3 text-[10px] uppercase tracking-wider text-zinc-600">
        Image pending
      </div>
    </div>
  );
}
