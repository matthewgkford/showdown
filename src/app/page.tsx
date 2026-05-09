"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  getSeasonServerSnapshot,
  getSeasonSnapshot,
  subscribe,
} from "@/lib/season";

export default function Home() {
  const router = useRouter();
  const season = useSyncExternalStore(
    subscribe,
    getSeasonSnapshot,
    getSeasonServerSnapshot,
  );

  useEffect(() => {
    if (season === null) {
      router.replace("/choose-team");
    } else {
      router.replace("/season");
    }
  }, [season, router]);

  return <main className="min-h-[100dvh] bg-zinc-950" />;
}
