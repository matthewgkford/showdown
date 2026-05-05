"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  getRewardsServerSnapshot,
  getRewardsSnapshot,
  subscribe as subscribeRewards,
} from "@/lib/rewards";
import {
  getSeasonServerSnapshot,
  getSeasonSnapshot,
  subscribe as subscribeSeason,
} from "@/lib/season";

// Persistent bottom navigation. Shows on every "browsing" page when a
// season is active so the player can hop between Season / Roster /
// Stats / Packs without going home first. Hidden on immersive routes
// (/game, pack-open) and pre-season screens (/choose-team).
export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const season = useSyncExternalStore(
    subscribeSeason,
    getSeasonSnapshot,
    getSeasonServerSnapshot,
  );
  const rewards = useSyncExternalStore(
    subscribeRewards,
    getRewardsSnapshot,
    getRewardsServerSnapshot,
  );

  // Don't render until we have a season — pre-season screens have
  // their own nav, no point cluttering them with broken links.
  if (!season) return null;

  // Routes where the nav would get in the way of the experience.
  if (pathname.startsWith("/game")) return null;
  if (pathname.startsWith("/choose-team")) return null;
  if (
    pathname.startsWith("/packs/") &&
    (pathname.endsWith("/open") || pathname.includes("/earned/"))
  ) {
    return null;
  }

  const tabs: {
    href: string;
    label: string;
    icon: string;
    isActive: boolean;
    badge?: number;
  }[] = [
    {
      href: "/season",
      label: "Season",
      icon: "⚾",
      isActive: pathname === "/season",
    },
    {
      href: `/team/${season.playerTeamSlug}`,
      label: "Roster",
      icon: "🧢",
      isActive: pathname.startsWith("/team/"),
    },
    {
      href: "/season/stats",
      label: "Stats",
      icon: "📊",
      isActive: pathname === "/season/stats",
    },
    {
      href: "/packs",
      label: "Packs",
      icon: "🎁",
      isActive: pathname.startsWith("/packs"),
      badge: rewards.length > 0 ? rewards.length : undefined,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-md flex items-stretch">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
              tab.isActive
                ? "text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {/* Active indicator strip at the top of the tab. */}
            {tab.isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-emerald-400 rounded-b" />
            )}
            <span className="text-base leading-none">{tab.icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {tab.label}
            </span>
            {tab.badge !== undefined && (
              <span className="absolute top-1 right-[calc(50%-22px)] rounded-full bg-emerald-500 text-zinc-950 text-[9px] font-black w-4 h-4 flex items-center justify-center">
                {tab.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
