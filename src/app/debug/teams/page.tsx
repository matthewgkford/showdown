import Image from "next/image";
import Link from "next/link";
import { getAllDivisions, getTeamsByDivision } from "@/lib/teams";
import type { Team } from "@/types/team";

export default function DebugTeamsPage() {
  const divisions = getAllDivisions();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Debug · Teams
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Sanity check on the 10-team setup. Each tile shows the logo,
              short code, and the three brand colours.
            </p>
          </div>
          <Link
            href="/debug/leagues"
            className="rounded-full border border-zinc-700 px-3 py-2 text-xs sm:text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
          >
            Leagues →
          </Link>
        </header>

        {divisions.map((division) => (
          <section key={division.slug} className="mb-10">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {division.name}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {getTeamsByDivision(division.slug).map((team) => (
                <TeamTile key={team.slug} team={team} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function TeamTile({ team }: { team: Team }) {
  return (
    <article
      className="relative rounded-2xl p-4 flex flex-col items-center gap-3 ring-1"
      style={{
        background: `linear-gradient(160deg, ${team.colors.primary} 0%, ${team.colors.primary}cc 60%, ${team.colors.primary}88 100%)`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ["--tw-ring-color" as any]: team.colors.accent,
      }}
    >
      <div className="h-24 w-24 sm:h-28 sm:w-28 flex items-center justify-center">
        <Image
          src={team.logos.primary}
          alt={team.name}
          width={224}
          height={224}
          className="h-full w-full rounded-lg object-contain"
          priority
        />
      </div>
      <div className="text-center">
        <div className="text-sm sm:text-base font-bold text-white">
          {team.name}
        </div>
        <div
          className="text-[10px] uppercase tracking-[0.25em] mt-0.5"
          style={{ color: team.colors.accent }}
        >
          {team.shortName}
        </div>
      </div>
      <div className="flex gap-1.5">
        <Swatch color={team.colors.primary} label="primary" />
        <Swatch color={team.colors.accent} label="accent" />
        <Swatch color={team.colors.light} label="light" />
      </div>
      <div className="text-[9px] font-mono text-white/50">{team.slug}</div>
    </article>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="h-5 w-5 rounded-full ring-1 ring-white/20"
        style={{ backgroundColor: color }}
      />
      <span className="text-[8px] uppercase text-white/50">{label}</span>
    </div>
  );
}
