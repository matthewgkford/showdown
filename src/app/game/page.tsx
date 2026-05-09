"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import cardsData from "@data/cards.json";
import teamsData from "@data/teams.json";
import type { BatterCard, Card as CardType, PitcherCard } from "@/types/card";
import type { Team } from "@/types/team";
import {
  type Advantage,
  type Outcome,
  calculateAdvantage,
  getOutcome,
  isOut,
  outcomeLabel,
  rollD20,
} from "@/lib/game";
import {
  type Bases,
  type GameState,
  type TeamSetup,
  applyAtBatOutcome,
  battingTeam,
  changePitcher,
  checkGameOver,
  currentBatter,
  currentPitcher,
  fieldingTeam,
  pinchHit,
  pitcherFatigue,
  startGame,
} from "@/lib/gameState";
import {
  getSeasonServerSnapshot,
  getSeasonSnapshot,
  recordPlayerGame,
  subscribe,
} from "@/lib/season";
import {
  clearActiveExhibitionGame,
  clearActiveSeasonGame,
  getActiveExhibitionGame,
  getActiveSeasonGame,
  saveActiveExhibitionGame,
  saveActiveSeasonGame,
} from "@/lib/activeGame";
import { pickReliever } from "@/lib/bullpen";
import {
  EMPTY_BATTER_STATS,
  EMPTY_PITCHER_STATS,
  applyOutcomeToBatter,
  applyOutcomeToPitcher,
  type BatterStats,
  type PitcherStats,
} from "@/lib/stats";
import { mergeGameStats } from "@/lib/seasonStats";
import { getEffectiveRoster } from "@/lib/rosters";
import { getOverrideFor } from "@/lib/playerRoster";
import { getTeamBySlug } from "@/lib/teams";
import { getMatchColors, getTeamDisplayColor } from "@/lib/teamColor";
import { DICE_TUMBLE_MS, Dice } from "@/components/Dice";
import { BaseDiamond } from "@/components/BaseDiamond";
import { Scoreboard } from "@/components/Scoreboard";
import { Scorecard } from "@/components/Scorecard";

const cards = cardsData as CardType[];
const allBatters = cards.filter((c): c is BatterCard => c.cardType === "batter");
const allPitchers = cards.filter((c): c is PitcherCard => c.cardType === "pitcher");
const teams = teamsData as Team[];

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pick lineups + bench + bullpen for both teams. With the current pool
// (21 batters, 8 pitchers) each team gets 9 starters + 1 bench batter +
// 1 starting pitcher + 3 relievers, drawn without overlap.
function randomLineups(): {
  away: { lineup: BatterCard[]; bench: BatterCard[]; pitcher: PitcherCard; bullpen: PitcherCard[] };
  home: { lineup: BatterCard[]; bench: BatterCard[]; pitcher: PitcherCard; bullpen: PitcherCard[] };
} {
  const b = shuffle(allBatters);
  const p = shuffle(allPitchers);
  return {
    away: {
      lineup: b.slice(0, 9),
      bench: b.slice(9, 10),
      pitcher: p[0],
      bullpen: p.slice(2, 5),
    },
    home: {
      lineup: b.slice(10, 19),
      bench: b.slice(19, 20),
      pitcher: p[1] ?? p[0],
      bullpen: p.slice(5, 8),
    },
  };
}

type Phase =
  | { kind: "setup" }
  | { kind: "playing"; game: GameState };

type SeasonContext = {
  round: number;
  awaySlug: string;
  homeSlug: string;
};

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100dvh] flex items-center justify-center bg-zinc-950 text-zinc-100">
          <p className="text-sm text-zinc-500">Loading…</p>
        </main>
      }
    >
      <GamePageInner />
    </Suspense>
  );
}

function GamePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const season = useSyncExternalStore(
    subscribe,
    getSeasonSnapshot,
    getSeasonServerSnapshot,
  );

  const seasonCtx: SeasonContext | null = useMemo(() => {
    if (searchParams.get("season") !== "1") return null;
    const round = Number(searchParams.get("round"));
    const awaySlug = searchParams.get("away");
    const homeSlug = searchParams.get("home");
    if (!round || !awaySlug || !homeSlug) return null;
    return { round, awaySlug, homeSlug };
  }, [searchParams]);

  // Which side does the player physically control? "home" or "away" in
  // season mode, null in exhibition (where the player drives both teams).
  const playerSide: "home" | "away" | null = useMemo(() => {
    if (!seasonCtx || !season) return null;
    if (season.playerTeamSlug === seasonCtx.awaySlug) return "away";
    if (season.playerTeamSlug === seasonCtx.homeSlug) return "home";
    return null;
  }, [seasonCtx, season]);

  // For season matchups, derive the initial game state from URL + season
  // snapshot. Restores from localStorage if a saved game matches the URL;
  // otherwise builds a fresh matchup. Each team's roster comes from
  // data/rosters.json with the opponent's stats scaled by the current
  // league tier (player's roster never scales). Returns null while season
  // state is hydrating.
  const seasonInitialGame = useMemo<GameState | null>(() => {
    if (!seasonCtx || !season) return null;
    const entry = season.schedule.find(
      (g) =>
        g.round === seasonCtx.round &&
        g.awaySlug === seasonCtx.awaySlug &&
        g.homeSlug === seasonCtx.homeSlug,
    );
    if (!entry || entry.result !== null) return null;

    // Saved game matching this matchup? Resume.
    const saved = getActiveSeasonGame();
    if (
      saved &&
      saved.round === seasonCtx.round &&
      saved.awaySlug === seasonCtx.awaySlug &&
      saved.homeSlug === seasonCtx.homeSlug
    ) {
      return saved.state;
    }

    return buildSeasonGame(
      seasonCtx.awaySlug,
      seasonCtx.homeSlug,
      season.playerTeamSlug,
      season.currentLeagueTier,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonCtx]);
  // Note: deliberately not depending on `season`. After recordPlayerGame()
  // the schedule entry will have a result and this memo would re-evaluate
  // to null mid-game. Compute once when the user lands on the URL; Play
  // owns its own internal game state from there.

  const records = useMemo(() => {
    if (!season || !seasonCtx) return null;
    const sched = season.schedule;
    function rec(slug: string) {
      let wins = 0, losses = 0;
      for (const g of sched) {
        if (!g.result) continue;
        const aw = g.awaySlug === slug, hm = g.homeSlug === slug;
        if (!aw && !hm) continue;
        if ((aw && g.result.winner === "away") || (hm && g.result.winner === "home")) wins++;
        else losses++;
      }
      return { wins, losses };
    }
    return { away: rec(seasonCtx.awaySlug), home: rec(seasonCtx.homeSlug) };
  }, [season, seasonCtx]);

  // Exhibition mode setup/playing phase. Hydrated lazily from localStorage
  // so accidentally exiting an exhibition game doesn't lose it either.
  const [exhibitionPhase, setExhibitionPhase] = useState<Phase>({
    kind: "setup",
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (seasonCtx) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHydrated(true);
      return;
    }
    // One-time load from localStorage after mount. Doing this in a lazy
    // useState initializer would cause a hydration mismatch (server has
    // no window). The setState-in-effect pattern is correct here.
    const saved = getActiveExhibitionGame();
    if (saved) {
      setExhibitionPhase({ kind: "playing", game: saved.state });
    }
    setHydrated(true);
  }, [seasonCtx]);

  // Season mode: bounce back to /season if the schedule entry is missing,
  // already played, or rosters fail to resolve.
  useEffect(() => {
    if (!seasonCtx) return;
    if (!season) return;
    if (seasonInitialGame === null) {
      router.replace("/season");
    }
  }, [seasonCtx, season, seasonInitialGame, router]);

  if (seasonCtx) {
    if (!season || !seasonInitialGame) {
      return (
        <main className="min-h-[100dvh] flex items-center justify-center bg-zinc-950 text-zinc-100">
          <p className="text-sm text-zinc-500">Loading matchup…</p>
        </main>
      );
    }
    return (
      <Play
        initial={seasonInitialGame}
        playerSide={playerSide}
        records={records}
        onPersist={(state) =>
          saveActiveSeasonGame(
            seasonCtx.round,
            seasonCtx.awaySlug,
            seasonCtx.homeSlug,
            state,
          )
        }
        onEnd={(final) => {
          const over = checkGameOver(final);
          if (over) {
            recordPlayerGame(
              seasonCtx.awaySlug,
              seasonCtx.homeSlug,
              seasonCtx.round,
              {
                awayRuns: final.away.runs,
                homeRuns: final.home.runs,
                winner: over.winner,
              },
            );
            clearActiveSeasonGame();
          }
          // If game is not over, the saved state stays in localStorage so
          // the player can resume by navigating back to this URL.
          router.push("/season");
        }}
      />
    );
  }

  // Exhibition mode (no season query params).
  if (!hydrated) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center bg-zinc-950 text-zinc-100">
        <p className="text-sm text-zinc-500">Loading…</p>
      </main>
    );
  }

  if (exhibitionPhase.kind === "setup") {
    return (
      <Setup
        onStart={(awayTeam, homeTeam) => {
          const { away, home } = randomLineups();
          const game = startGame(
            { team: awayTeam, ...away },
            { team: homeTeam, ...home },
          );
          saveActiveExhibitionGame(awayTeam.slug, homeTeam.slug, game);
          setExhibitionPhase({ kind: "playing", game });
        }}
      />
    );
  }

  return (
    <Play
      initial={exhibitionPhase.game}
      playerSide={null}
      records={null}
      onPersist={(state) =>
        saveActiveExhibitionGame(
          state.away.team.slug,
          state.home.team.slug,
          state,
        )
      }
      onEnd={(final) => {
        if (checkGameOver(final)) {
          clearActiveExhibitionGame();
        }
        setExhibitionPhase({ kind: "setup" });
      }}
    />
  );
}

// Construct the GameState for a season matchup: pull each team's roster
// from data/rosters.json, apply the league powerLevel multiplier to the
// opponent only (the player's own roster never scales — they grow
// stronger by collecting better cards from packs), and hand it to the
// existing engine. Bench is empty since season rosters are 13 cards
// (9 batters + 1 SP + 3 RP, no bench).
function buildSeasonGame(
  awaySlug: string,
  homeSlug: string,
  playerSlug: string,
  currentTier: number,
): GameState | null {
  const awayTeam = getTeamBySlug(awaySlug);
  const homeTeam = getTeamBySlug(homeSlug);
  if (!awayTeam || !homeTeam) return null;

  // Player's customised roster, if any, replaces their default starting
  // roster — so swapping cards in the team page actually changes the
  // lineup that takes the field. Opponent rosters always come from the
  // immutable league design.
  const playerOverride = getOverrideFor(playerSlug);

  const awayRoster = getEffectiveRoster(
    awaySlug,
    awaySlug === playerSlug ? 1 : currentTier,
    awaySlug === playerSlug ? playerOverride : null,
  );
  const homeRoster = getEffectiveRoster(
    homeSlug,
    homeSlug === playerSlug ? 1 : currentTier,
    homeSlug === playerSlug ? playerOverride : null,
  );
  if (!awayRoster || !homeRoster) return null;

  const awaySetup: TeamSetup = {
    team: awayTeam,
    lineup: awayRoster.batters,
    bench: [],
    pitcher: awayRoster.startingPitcher,
    bullpen: awayRoster.relievers,
  };
  const homeSetup: TeamSetup = {
    team: homeTeam,
    lineup: homeRoster.batters,
    bench: [],
    pitcher: homeRoster.startingPitcher,
    bullpen: homeRoster.relievers,
  };
  return startGame(awaySetup, homeSetup);
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup phase: pick which team is away vs home (rosters auto-randomize)
// ─────────────────────────────────────────────────────────────────────────────

function Setup({
  onStart,
}: {
  onStart: (away: Team, home: Team) => void;
}) {
  const [awaySlug, setAwaySlug] = useState<string>(teams[0].slug);
  const [homeSlug, setHomeSlug] = useState<string>(teams[1].slug);
  const awayTeam = teams.find((t) => t.slug === awaySlug) ?? teams[0];
  const homeTeam = teams.find((t) => t.slug === homeSlug) ?? teams[1];
  const sameTeam = awaySlug === homeSlug;

  function swap() {
    setAwaySlug(homeSlug);
    setHomeSlug(awaySlug);
  }

  return (
    <main className="min-h-[100dvh] flex flex-col bg-zinc-950 text-zinc-100 px-4 py-6 sm:px-8">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          Exhibition
        </h1>
        <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200">
          ← library
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="grid grid-cols-2 gap-4 sm:gap-12 items-center">
          <TeamPicker
            role="Away"
            value={awaySlug}
            onChange={setAwaySlug}
            team={awayTeam}
          />
          <TeamPicker
            role="Home"
            value={homeSlug}
            onChange={setHomeSlug}
            team={homeTeam}
          />
        </div>

        <button
          onClick={swap}
          className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
        >
          ⇄ swap home/away
        </button>

        <p className="text-xs text-zinc-500 max-w-xs text-center">
          Exhibition mode — rosters are randomized at game start. Pick any
          two of the ten teams.
        </p>

        <button
          onClick={() => onStart(awayTeam, homeTeam)}
          disabled={sameTeam}
          className="rounded-full bg-emerald-500 px-10 py-3 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sameTeam ? "Pick two different teams" : "Play ball"}
        </button>
      </div>
    </main>
  );
}

function TeamPicker({
  role,
  value,
  onChange,
  team,
}: {
  role: string;
  value: string;
  onChange: (slug: string) => void;
  team: Team;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex h-32 w-32 sm:h-40 sm:w-40 items-center justify-center rounded-2xl bg-zinc-900/60 ring-2"
        style={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ["--tw-ring-color" as any]: team.colors.primary,
        }}
      >
        <Image
          src={team.logos.primary}
          alt={team.name}
          width={320}
          height={320}
          className="h-24 w-24 sm:h-32 sm:w-32 rounded-lg object-contain"
          priority
        />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
      >
        {teams.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {role}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Playing phase: live game view
// ─────────────────────────────────────────────────────────────────────────────

type Stage =
  // At-bat opens with both cards on screen side-by-side ("here's the
  // matchup"); auto-advances after a beat into pitcher-ready.
  | { kind: "intro" }
  // Pitcher card is in focus, batter peeks from the side. Awaiting the
  // pitch — either a player tap or the CPU auto-rolling.
  | { kind: "pitcher-ready" }
  | { kind: "pitcher-rolling"; pitchRoll: number }
  // Pitch has settled; pitcher card stays in focus so the player can read
  // the dice number AND inspect the card. Auto-advances to batter-ready
  // after PITCH_HOLD_MS.
  | { kind: "pitcher-settled"; pitchRoll: number; advantage: Advantage }
  // Cards have swapped — batter is now in focus. Advantage announced.
  // Awaiting the swing.
  | { kind: "batter-ready"; pitchRoll: number; advantage: Advantage }
  | {
      kind: "batter-rolling";
      pitchRoll: number;
      advantage: Advantage;
      swingRoll: number;
    }
  | {
      kind: "batter-settled";
      pitchRoll: number;
      advantage: Advantage;
      swingRoll: number;
    }
  | {
      kind: "field";
      outcome: Outcome;
      justBatted: BatterCard;
      preBases: Bases;
    };

// At-bat opening: both cards visible side-by-side, then auto-transitions.
const INTRO_HOLD_MS = 1200;
// After the pitch settles, hold on the pitcher card with the dice
// number visible long enough to read the number AND check the card.
const PITCH_HOLD_MS = 2200;
// Same idea after the swing — slightly longer because the next thing
// is the outcome reveal and we want the swing roll to land first.
const SWING_HOLD_MS = 2500;
// Delay before the AI auto-rolls a die on the player's behalf when the
// opponent is acting. Long enough to feel like the CPU is "thinking,"
// short enough that the player isn't waiting around.
const AUTO_PAUSE_MS = 650;
const PREGAME_HOLD_MS = 5500;

function Play({
  initial,
  onEnd,
  playerSide,
  onPersist,
  records,
}: {
  initial: GameState;
  onEnd: (final: GameState) => void;
  // The side the human player controls. null means exhibition / spectator
  // — the player taps both sides' dice. Set to "home" or "away" in
  // season mode based on which slug matches the player's team.
  playerSide: "home" | "away" | null;
  // Called whenever the game state changes so the parent can persist it
  // to localStorage. Gets the latest GameState.
  onPersist?: (state: GameState) => void;
  records?: { away: { wins: number; losses: number }; home: { wins: number; losses: number } } | null;
}) {
  const [game, setGame] = useState<GameState>(initial);
  const [stage, setStage] = useState<Stage>({ kind: "intro" });
  const [manageOpen, setManageOpen] = useState(false);
  const [showPregame, setShowPregame] = useState(() =>
    initial.inning === 1 &&
    initial.half === "top" &&
    initial.outs === 0 &&
    initial.away.runs === 0 &&
    initial.home.runs === 0,
  );

  const pitcher = useMemo(() => currentPitcher(game), [game]);
  const batter = useMemo(() => currentBatter(game), [game]);
  const fatigue = useMemo(
    () => pitcherFatigue(fieldingTeam(game), game.inning),
    [game],
  );

  // Per-card stats accumulator for THIS live game. We update it
  // synchronously inside tapBatter (using the closure-captured state)
  // so we never double-count under React strict-mode double-renders.
  // On game-over the entire blob gets folded into the running season
  // totals.
  const gameStatsRef = useRef<{
    batters: Record<string, BatterStats>;
    pitchers: Record<string, PitcherStats>;
  }>({ batters: {}, pitchers: {} });

  // Wrap the parent onEnd so that whenever a finished game ends, we
  // first fold the game's per-card stats into the running season
  // totals. Abandoning mid-game (End button before the 9th out) does
  // NOT merge — the game wasn't completed.
  const handleEnd = (final: GameState): void => {
    if (checkGameOver(final)) {
      mergeGameStats(gameStatsRef.current);
    }
    onEnd(final);
  };

  // Persist on every game state change. We use a ref so we don't have to
  // memoise onPersist in every parent — the latest callback always wins.
  const persistRef = useRef(onPersist);
  useEffect(() => {
    persistRef.current = onPersist;
  }, [onPersist]);
  useEffect(() => {
    persistRef.current?.(game);
  }, [game]);

  // Who is the player allowed to control right now?
  const fieldingSide: "home" | "away" =
    game.half === "top" ? "home" : "away";
  const battingSide: "home" | "away" =
    game.half === "top" ? "away" : "home";
  const playerCanPitch =
    stage.kind === "pitcher-ready" &&
    (playerSide === null || playerSide === fieldingSide);
  const playerCanSwing =
    stage.kind === "batter-ready" &&
    (playerSide === null || playerSide === battingSide);

  function tapPitcher() {
    if (stage.kind !== "pitcher-ready") return;
    const pitchRoll = rollD20();
    setStage({ kind: "pitcher-rolling", pitchRoll });
    setTimeout(() => {
      const advantage = calculateAdvantage(pitcher, batter, pitchRoll, fatigue);
      setStage({ kind: "pitcher-settled", pitchRoll, advantage });
    }, DICE_TUMBLE_MS);
  }

  function tapBatter() {
    if (stage.kind !== "batter-ready") return;
    const swingRoll = rollD20();
    const { pitchRoll, advantage } = stage;
    setStage({ kind: "batter-rolling", pitchRoll, advantage, swingRoll });
    setTimeout(() => {
      setStage({ kind: "batter-settled", pitchRoll, advantage, swingRoll });
      setTimeout(() => {
        const outcome = getOutcome(pitcher, batter, advantage, swingRoll);
        const justBatted = batter;
        const preBases = game.bases;
        setStage({ kind: "field", outcome, justBatted, preBases });

        // Record stats for this at-bat. Compute runsScored from the
        // closure-captured `game` (no other update can race in here —
        // the swing-settled stage waits for the timer alone).
        const newGame = applyAtBatOutcome(game, outcome);
        const battingSide: "home" | "away" =
          game.half === "top" ? "away" : "home";
        const runsScored =
          newGame[battingSide].runs - game[battingSide].runs;
        const stats = gameStatsRef.current;
        stats.batters[justBatted.id] = applyOutcomeToBatter(
          stats.batters[justBatted.id] ?? EMPTY_BATTER_STATS,
          outcome,
          runsScored,
        );
        stats.pitchers[pitcher.id] = applyOutcomeToPitcher(
          stats.pitchers[pitcher.id] ?? EMPTY_PITCHER_STATS,
          outcome,
          runsScored,
        );

        setGame((g) => applyAtBatOutcome(g, outcome));
      }, SWING_HOLD_MS);
    }, DICE_TUMBLE_MS);
  }

  function nextBatter() {
    // CPU pitcher auto-sub: if the opponent is on the mound and their
    // current pitcher is fatigued, bring in the next reliever before the
    // at-bat begins. Mirrors what the headless simulator does for
    // background games — keeps the live game from punishing the CPU
    // for not "managing" its bullpen. The player still manages their
    // own pitcher manually via the Sub modal.
    if (playerSide !== null) {
      const upcomingFieldingSide: "home" | "away" =
        game.half === "top" ? "home" : "away";
      if (upcomingFieldingSide !== playerSide) {
        const fielding =
          upcomingFieldingSide === "home" ? game.home : game.away;
        const fatigue = pitcherFatigue(fielding, game.inning);
        if (fatigue > 0 && fielding.bullpen.length > 0) {
          const next = pickReliever(fielding.bullpen, game.inning);
          if (next) {
            setGame((g) =>
              changePitcher(g, upcomingFieldingSide, next.id),
            );
          }
        }
      }
    }
    setStage({ kind: "intro" });
  }

  // Auto-advance from intro → pitcher-ready after the matchup beat.
  // Waits for the pregame overlay to be dismissed first.
  useEffect(() => {
    if (stage.kind !== "intro") return;
    if (showPregame) return;
    const t = setTimeout(
      () => setStage({ kind: "pitcher-ready" }),
      INTRO_HOLD_MS,
    );
    return () => clearTimeout(t);
  }, [stage.kind, showPregame]);

  useEffect(() => {
    if (!showPregame) return;
    const t = setTimeout(() => setShowPregame(false), PREGAME_HOLD_MS);
    return () => clearTimeout(t);
  }, [showPregame]);

  // Auto-advance from pitcher-settled → batter-ready after the read pause.
  useEffect(() => {
    if (stage.kind !== "pitcher-settled") return;
    const { pitchRoll, advantage } = stage;
    const t = setTimeout(
      () => setStage({ kind: "batter-ready", pitchRoll, advantage }),
      PITCH_HOLD_MS,
    );
    return () => clearTimeout(t);
  }, [stage]);

  // Auto-roll the pitch when the player is on offense and waiting for the
  // CPU to throw. Cleanup clears the timeout if the stage changes first.
  useEffect(() => {
    if (stage.kind !== "pitcher-ready") return;
    if (playerSide === null) return;
    if (fieldingSide === playerSide) return;
    const t = setTimeout(() => tapPitcher(), AUTO_PAUSE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.kind, fieldingSide, playerSide]);

  // Auto-swing when the player is on defense and the CPU batter is up.
  useEffect(() => {
    if (stage.kind !== "batter-ready") return;
    if (playerSide === null) return;
    if (battingSide === playerSide) return;
    const t = setTimeout(() => tapBatter(), AUTO_PAUSE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.kind, battingSide, playerSide]);

  // Card focus mode for the two-card layout. Determines which card sits
  // at the centre and which peeks from the side.
  const focus: CardFocus =
    stage.kind === "intro"
      ? "intro"
      : stage.kind === "pitcher-ready" ||
          stage.kind === "pitcher-rolling" ||
          stage.kind === "pitcher-settled"
        ? "pitcher"
        : "batter";

  const pitchValue =
    stage.kind === "intro" || stage.kind === "pitcher-ready"
      ? null
      : "pitchRoll" in stage
        ? stage.pitchRoll
        : null;
  const pitchStatus =
    stage.kind === "pitcher-ready" || stage.kind === "intro"
      ? "idle"
      : stage.kind === "pitcher-rolling"
        ? "rolling"
        : "settled";

  const swingValue =
    stage.kind === "batter-rolling" || stage.kind === "batter-settled"
      ? stage.swingRoll
      : null;
  const swingStatus =
    stage.kind === "batter-ready"
      ? "idle"
      : stage.kind === "batter-rolling"
        ? "rolling"
        : stage.kind === "batter-settled"
          ? "settled"
          : "idle";

  const advantage = "advantage" in stage ? stage.advantage : null;
  const advantageHolder =
    advantage === "pitcher"
      ? pitcher.name
      : advantage === "batter"
        ? batter.name
        : null;

  // Resolve which colour each side gets for active dice + card ring.
  // When the two primaries are too similar, the away team uses accent
  // so the matchup still reads as two distinct teams.
  const matchColors = useMemo(
    () => getMatchColors(game.home.team, game.away.team),
    [game.home.team, game.away.team],
  );
  // Pitcher = fielding team, batter = batting team.
  const pitcherColor =
    fieldingSide === "home" ? matchColors.home : matchColors.away;
  const batterColor =
    battingSide === "home" ? matchColors.home : matchColors.away;

  // applyAtBatOutcome flips half + bumps inning the moment the 3rd out
  // lands. Roll that back for the scoreboard so it shows the half that
  // was actually in play until the scorecard overlay takes over.
  //   game.half === "top" after flip  → home just batted (bottom of N-1)
  //   game.half === "bottom" after flip → away just batted (top of N)
  const scoreboardGame: GameState =
    stage.kind === "field" && isOut(stage.outcome) && game.outs === 0
      ? game.half === "top"
        ? { ...game, half: "bottom" as const, inning: game.inning - 1 }
        : { ...game, half: "top" as const }
      : game;

  return (
    <main className={`h-[100dvh] flex flex-col text-zinc-100 overflow-hidden ${
      stage.kind === "field"
        ? "bg-[#1b4520]"
        : "bg-zinc-950 px-3 py-2 sm:px-6 sm:py-3"
    }`}>
      <header className={`relative isolate shrink-0 mb-2 ${
        stage.kind === "field" ? "px-3 pt-2 sm:px-6 sm:pt-3" : ""
      }`}>
        {stage.kind === "field" && (
          <div
            className="absolute inset-x-0 -top-2 bottom-0 -z-10 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)" }}
          />
        )}
        <div className="flex items-center justify-between mb-1.5">
          <button
            onClick={() => handleEnd(game)}
            className="rounded-full border border-zinc-800 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
          >
            ←
          </button>
          {(stage.kind === "intro" ||
            stage.kind === "pitcher-ready" ||
            stage.kind === "batter-ready") && (
            <button
              onClick={() => setManageOpen(true)}
              className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
            >
              Sub
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <Scoreboard state={scoreboardGame} />
          </div>
          {stage.kind !== "field" && <BaseDiamond bases={game.bases} />}
        </div>
      </header>

      <ManageModal
        open={manageOpen}
        game={game}
        onClose={() => setManageOpen(false)}
        onChangePitcher={(side, id) => {
          setGame((g) => changePitcher(g, side, id));
          setManageOpen(false);
        }}
        onPinchHit={(side, id) => {
          setGame((g) => pinchHit(g, side, id));
          setManageOpen(false);
        }}
      />

      {stage.kind === "field" ? (
        <FieldView
          game={game}
          preBases={stage.preBases}
          outcome={stage.outcome}
          justBatted={stage.justBatted}
          onNext={nextBatter}
          onPlayAgain={() => handleEnd(game)}
        />
      ) : (
        <TwoCardLayout
          focus={focus}
          pitcher={pitcher}
          batter={batter}
          batterSlot={currentBatterSlot(game)}
          fatigue={fatigue}
          stage={stage}
          pitchValue={pitchValue}
          pitchStatus={pitchStatus}
          swingValue={swingValue}
          swingStatus={swingStatus}
          advantageHolder={advantageHolder}
          playerCanPitch={playerCanPitch}
          playerCanSwing={playerCanSwing}
          isOpponentActing={
            playerSide !== null &&
            ((stage.kind === "pitcher-ready" && fieldingSide !== playerSide) ||
              (stage.kind === "batter-ready" && battingSide !== playerSide))
          }
          onTapPitch={tapPitcher}
          onTapSwing={tapBatter}
          pitcherColor={pitcherColor}
          batterColor={batterColor}
        />
      )}
      <AnimatePresence>
        {showPregame && (
          <PreGameScreen
            away={game.away.team}
            home={game.home.team}
            awayPitcher={game.away.pitcher}
            homePitcher={game.home.pitcher}
            records={records ?? null}
            onDismiss={() => setShowPregame(false)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

// Card focus mode. "intro" = both cards visible side-by-side at the
// start of the at-bat. "pitcher" = pitcher card centered, batter peeks
// from the right. "batter" = batter card centered, pitcher peeks from
// the left. The TwoCardLayout animates between these via framer-motion.
type CardFocus = "intro" | "pitcher" | "batter";

type CardSlotPosition = {
  left: string;
  top: string;
  width: string;
  height: string;
  opacity: number;
  scale: number;
  zIndex: number;
};

// Card positions per focus mode — pitcher on the left half, batter on
// the right when both are shown, with the focused card filling more of
// the area and the off-card tucking away in the opposite corner.
function pitcherPos(focus: CardFocus): CardSlotPosition {
  switch (focus) {
    case "intro":
      return {
        left: "5%",
        top: "5%",
        width: "42%",
        height: "90%",
        opacity: 1,
        scale: 1,
        zIndex: 1,
      };
    case "pitcher":
      return {
        left: "20%",
        top: "0%",
        width: "60%",
        height: "100%",
        opacity: 1,
        scale: 1,
        zIndex: 2,
      };
    case "batter":
      return {
        left: "0%",
        top: "55%",
        width: "22%",
        height: "42%",
        opacity: 0.95,
        scale: 1,
        zIndex: 1,
      };
  }
}

function batterPos(focus: CardFocus): CardSlotPosition {
  switch (focus) {
    case "intro":
      return {
        left: "53%",
        top: "5%",
        width: "42%",
        height: "90%",
        opacity: 1,
        scale: 1,
        zIndex: 1,
      };
    case "pitcher":
      return {
        left: "78%",
        top: "55%",
        width: "22%",
        height: "42%",
        opacity: 0.95,
        scale: 1,
        zIndex: 1,
      };
    case "batter":
      return {
        left: "20%",
        top: "0%",
        width: "60%",
        height: "100%",
        opacity: 1,
        scale: 1,
        zIndex: 2,
      };
  }
}

const CARD_SPRING = { type: "spring", stiffness: 220, damping: 28 } as const;

// Two-card playing layout. Both pitcher + batter are in the DOM the whole
// time, framer-motion just slides them between intro / pitcher-focus /
// batter-focus positions. Keeps the matchup feeling continuous.
function TwoCardLayout({
  focus,
  pitcher,
  batter,
  batterSlot,
  fatigue,
  stage,
  pitchValue,
  pitchStatus,
  swingValue,
  swingStatus,
  advantageHolder,
  playerCanPitch,
  playerCanSwing,
  isOpponentActing,
  onTapPitch,
  onTapSwing,
  pitcherColor,
  batterColor,
}: {
  focus: CardFocus;
  pitcher: PitcherCard;
  batter: BatterCard;
  batterSlot: number;
  fatigue: number;
  stage: Stage;
  pitchValue: number | null;
  pitchStatus: "idle" | "rolling" | "settled";
  swingValue: number | null;
  swingStatus: "idle" | "rolling" | "settled";
  advantageHolder: string | null;
  playerCanPitch: boolean;
  playerCanSwing: boolean;
  isOpponentActing: boolean;
  onTapPitch: () => void;
  onTapSwing: () => void;
  pitcherColor: string;
  batterColor: string;
}) {
  const headline =
    focus === "intro"
      ? `${pitcher.name} vs ${batter.name}`
      : focus === "pitcher"
        ? `P · ${pitcher.name}${fatigue > 0 ? ` (−${fatigue})` : ""}`
        : `#${batterSlot + 1} · ${batter.name}`;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div
        className={`shrink-0 truncate text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 text-center ${
          focus === "pitcher" && fatigue > 0
            ? "text-amber-400"
            : focus === "intro"
              ? "text-zinc-400"
              : "text-emerald-300"
        }`}
      >
        {headline}
      </div>

      <div className="relative flex-1 min-h-0">
        <CardLayer
          card={pitcher}
          ringColor={pitcherColor}
          position={pitcherPos(focus)}
        />
        <CardLayer
          card={batter}
          ringColor={batterColor}
          position={batterPos(focus)}
        />
        {focus === "intro" && (
          <motion.div
            key="vs"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 320 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none text-zinc-100 text-3xl sm:text-4xl font-black tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
          >
            vs
          </motion.div>
        )}
      </div>

      <StatusLine
        stage={stage}
        pitcher={pitcher}
        batter={batter}
        fatigue={fatigue}
        advantageHolder={advantageHolder}
        playerCanPitch={playerCanPitch}
        playerCanSwing={playerCanSwing}
        isOpponentActing={isOpponentActing}
      />

      <div className="shrink-0 mt-2 flex items-center justify-center">
        {focus === "batter" ? (
          <Dice
            baseColor={batterColor}
            status={swingStatus}
            value={swingValue}
            label={`OB ${batter.onBase}`}
            onTap={playerCanSwing ? onTapSwing : undefined}
          />
        ) : (
          <Dice
            baseColor={pitcherColor}
            status={pitchStatus}
            value={pitchValue}
            label={`+${pitcher.control}`}
            onTap={playerCanPitch ? onTapPitch : undefined}
          />
        )}
      </div>
    </div>
  );
}

function CardLayer({
  card,
  ringColor,
  position,
}: {
  card: CardType;
  ringColor: string;
  position: CardSlotPosition;
}) {
  return (
    <motion.div
      animate={{
        left: position.left,
        top: position.top,
        width: position.width,
        height: position.height,
        opacity: position.opacity,
        scale: position.scale,
      }}
      style={{ zIndex: position.zIndex }}
      transition={CARD_SPRING}
      className="absolute flex items-center justify-center"
    >
      <Image
        src={`/cards/${card.id}.png`}
        alt={card.name}
        width={1488}
        height={2079}
        // 8-digit hex: ~40% alpha, matching the old ring-rose-400/40 cue.
        style={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ["--tw-ring-color" as any]: `${ringColor}66`,
        }}
        className="block max-h-full max-w-full w-auto h-auto rounded-xl shadow-md shadow-black/40 ring-4"
        sizes="90vw"
        priority
      />
    </motion.div>
  );
}

function StatusLine({
  stage,
  pitcher,
  batter,
  fatigue,
  advantageHolder,
  playerCanPitch,
  playerCanSwing,
  isOpponentActing,
}: {
  stage: Stage;
  pitcher: PitcherCard;
  batter: BatterCard;
  fatigue: number;
  advantageHolder: string | null;
  playerCanPitch: boolean;
  playerCanSwing: boolean;
  isOpponentActing: boolean;
}) {
  return (
    <div className="shrink-0 mt-2 h-12 flex flex-col items-center justify-center text-center">
      <AnimatePresence mode="wait">
        {stage.kind === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs sm:text-sm text-zinc-400"
          >
            <span className="text-rose-400">Ctrl {pitcher.control}</span>
            <span className="text-zinc-600"> · </span>
            <span className="text-sky-400">OB {batter.onBase}</span>
          </motion.div>
        )}
        {stage.kind === "pitcher-ready" && (
          <motion.div
            key="pitcher-ready"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs sm:text-sm text-zinc-400"
          >
            {playerCanPitch
              ? "Tap the red die to pitch"
              : isOpponentActing
                ? "Opponent winding up…"
                : "—"}
          </motion.div>
        )}
        {stage.kind === "pitcher-rolling" && (
          <motion.div
            key="pitcher-rolling"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs sm:text-sm text-zinc-500"
          >
            …
          </motion.div>
        )}
        {stage.kind === "pitcher-settled" && (
          <motion.div
            key="pitcher-settled"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-0.5"
          >
            <div className="text-[11px] sm:text-xs text-zinc-400 font-mono">
              <span className="text-zinc-200 font-bold text-base">
                {stage.pitchRoll}
              </span>{" "}
              + {pitcher.control}
              {fatigue > 0 && <span className="text-amber-400">−{fatigue}</span>}
              {" = "}
              <span className="text-zinc-100 font-bold">
                {stage.pitchRoll + pitcher.control - fatigue}
              </span>{" "}
              vs OB {batter.onBase}
            </div>
            <div className="text-[11px] sm:text-xs font-bold">
              <span
                className={
                  stage.advantage === "pitcher"
                    ? "text-rose-400"
                    : "text-sky-400"
                }
              >
                {advantageHolder}
              </span>{" "}
              <span className="text-zinc-400 font-normal">advantage</span>
            </div>
          </motion.div>
        )}
        {stage.kind === "batter-ready" && (
          <motion.div
            key="batter-ready"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-0.5"
          >
            <div className="text-sm font-bold">
              <span
                className={
                  stage.advantage === "pitcher"
                    ? "text-rose-400"
                    : "text-sky-400"
                }
              >
                {advantageHolder}
              </span>{" "}
              <span className="text-zinc-400">advantage</span>
            </div>
            <div className="text-[10px] text-zinc-500">
              {playerCanSwing ? "Tap blue die to swing" : "Opponent swings…"}
            </div>
          </motion.div>
        )}
        {stage.kind === "batter-rolling" && (
          <motion.div
            key="batter-rolling"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs sm:text-sm text-zinc-500"
          >
            …
          </motion.div>
        )}
        {stage.kind === "batter-settled" && (
          <motion.div
            key="batter-settled"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-0.5"
          >
            <div className="text-[11px] sm:text-xs text-zinc-400 font-mono">
              Swing{" "}
              <span className="text-zinc-100 font-bold text-base">
                {stage.swingRoll}
              </span>{" "}
              on {stage.advantage === "pitcher" ? "pitcher" : "batter"} chart…
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function currentBatterSlot(g: GameState): number {
  return g.half === "top" ? g.away.battingIndex : g.home.battingIndex;
}

// ─────────────────────────────────────────────────────────────────────────────
// Field view: between at-bats. Big diamond with each runner's card on
// their base, animated step-by-step around the basepath.
// ─────────────────────────────────────────────────────────────────────────────

// "scoring" is the moment a runner crosses home plate before the run
// is recorded — visually they're at home, but they're on their way off
// the field. Lets a homer's batter actually step on the plate instead
// of vanishing at third. "scored" then removes them from the field.
type BasePos =
  | "home"
  | "first"
  | "second"
  | "third"
  | "scoring"
  | "scored";
const BASE_ORDER: BasePos[] = [
  "home",
  "first",
  "second",
  "third",
  "scoring",
  "scored",
];

type RunnerSnapshot = { card: BatterCard; pos: BasePos };

const STEP_MS = 380;

// Build a sequence of intermediate snapshots that walk every runner one
// base at a time from the pre-play state to the post-play state. Each
// element of the returned array is a frame the field view will render in
// turn; layoutId animates the cards between consecutive frames.
//
// Special case: when an out ends the half-inning, runners on base don't
// actually advance — they head to the dugout. Show them at their current
// bases for one frame, then fade them off (empty frame), instead of
// running them around the basepath as if they scored.
function computeSteps(
  prev: Bases,
  current: Bases,
  justBatted: BatterCard,
  outcome: Outcome,
  halfEnded: boolean,
): RunnerSnapshot[][] {
  if (halfEnded) {
    const stuck: RunnerSnapshot[] = [];
    if (prev.first) stuck.push({ card: prev.first, pos: "first" });
    if (prev.second) stuck.push({ card: prev.second, pos: "second" });
    if (prev.third) stuck.push({ card: prev.third, pos: "third" });
    return stuck.length > 0 ? [stuck, []] : [stuck];
  }

  // Fielder's choice on a ground out: there was a runner on 1st pre-play
  // and the batter ended up there post-play, meaning the lead forced
  // runner was put out. The lead-out depends on which bases were
  // occupied (1st-only → R1, 1st+2nd → R2, loaded → R3). We find them
  // by spotting the pre-play runner who isn't on any base post-play —
  // they get drawn at their original base for one frame, then fade out
  // via AnimatePresence as the next frame omits them.
  const isFCGroundOut =
    outcome === "gb" && !!prev.first && current.first?.id === justBatted.id;
  const forcedOutId = (() => {
    if (!isFCGroundOut) return null;
    const currentIds = new Set(
      [current.first?.id, current.second?.id, current.third?.id].filter(
        (id): id is string => Boolean(id),
      ),
    );
    const preRunners = [prev.first, prev.second, prev.third].filter(
      (r): r is BatterCard => Boolean(r),
    );
    return preRunners.find((r) => !currentIds.has(r.id))?.id ?? null;
  })();

  const initial: RunnerSnapshot[] = [];
  if (prev.first) initial.push({ card: prev.first, pos: "first" });
  if (prev.second) initial.push({ card: prev.second, pos: "second" });
  if (prev.third) initial.push({ card: prev.third, pos: "third" });
  // Add the batter to the diamond if they made it on base. That includes
  // hits, walks, AND fielder's-choice ground outs (they take first).
  if (!isOut(outcome) || isFCGroundOut) {
    initial.push({ card: justBatted, pos: "home" });
  }

  // Subsequent frames don't include the forced-out runner — they fade in
  // place via AnimatePresence as the simulation moves on.
  const advancing = forcedOutId
    ? initial.filter((r) => r.card.id !== forcedOutId)
    : initial;

  const dest: Record<string, BasePos> = {};
  for (const r of advancing) {
    if (current.first?.id === r.card.id) dest[r.card.id] = "first";
    else if (current.second?.id === r.card.id) dest[r.card.id] = "second";
    else if (current.third?.id === r.card.id) dest[r.card.id] = "third";
    else dest[r.card.id] = "scored";
  }

  const frames: RunnerSnapshot[][] = [initial];
  let cur = advancing;
  // 6 hops from "home" (idx 0) to "scored" (idx 5) covers the longest
  // possible path; a couple extra iterations leaves headroom.
  for (let safety = 0; safety < 7; safety++) {
    let moved = false;
    const next: RunnerSnapshot[] = cur.map((r) => {
      const dIdx = BASE_ORDER.indexOf(dest[r.card.id]);
      const cIdx = BASE_ORDER.indexOf(r.pos);
      if (cIdx < dIdx) {
        moved = true;
        return { card: r.card, pos: BASE_ORDER[cIdx + 1] };
      }
      return r;
    });
    if (!moved) break;
    frames.push(next);
    cur = next;
  }
  return frames;
}

function FieldView({
  game,
  preBases,
  outcome,
  justBatted,
  onNext,
  onPlayAgain,
}: {
  game: GameState;
  preBases: Bases;
  outcome: Outcome;
  justBatted: BatterCard;
  onNext: () => void;
  onPlayAgain: () => void;
}) {
  // The half flips back to outs=0 only when the 3rd out lands.
  const halfEnded = isOut(outcome) && game.outs === 0;
  const gameOver = checkGameOver(game);

  const frames = useMemo(
    () => computeSteps(preBases, game.bases, justBatted, outcome, halfEnded),
    [preBases, game.bases, justBatted, outcome, halfEnded],
  );

  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    if (frameIdx >= frames.length - 1) return;
    const t = setTimeout(() => setFrameIdx((i) => i + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [frameIdx, frames.length]);

  const isAnimating = frameIdx < frames.length - 1;
  const visible = frames[frameIdx].filter((r) => r.pos !== "scored");

  // Brief hold on the field after a 3rd-out animation finishes, before
  // the half-inning scorecard takes over. Lets the OUT stamp land and
  // the empty diamond breathe instead of the scorecard immediately
  // covering everything.
  const POST_OUT_HOLD_MS = 1100;
  const [holdDone, setHoldDone] = useState(false);
  useEffect(() => {
    if (isAnimating) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHoldDone(false);
      return;
    }
    if (!halfEnded) {
      setHoldDone(true);
      return;
    }
    const t = setTimeout(() => setHoldDone(true), POST_OUT_HOLD_MS);
    return () => clearTimeout(t);
  }, [isAnimating, halfEnded]);

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-between">
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="text-center shrink-0 px-4 pt-2"
      >
        {/* Compact label up top — the field animation does the heavy
            lifting visually now. */}
        <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
          <span className={isOut(outcome) ? "text-rose-300" : "text-emerald-300"}>
            {outcomeLabel(outcome)}
          </span>
          <span className="text-zinc-600"> · </span>
          <span>{justBatted.name}</span>
        </div>
        {halfEnded && !gameOver && (
          <div
            className={`mt-1 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.25em] ${
              game.inning >= 10 ? "text-amber-400" : "text-rose-400"
            }`}
          >
            {game.inning >= 10 ? "Extra innings" : "Side retired"}
          </div>
        )}
      </motion.div>

      <Field runners={visible} outcome={outcome} preBases={preBases} />

      {isAnimating || (halfEnded && !holdDone) ? (
        <div className="h-14" aria-hidden />
      ) : gameOver ? (
        <GameOverPanel
          game={game}
          winner={gameOver.winner}
          onPlayAgain={onPlayAgain}
        />
      ) : halfEnded ? (
        // Between halves: full-screen linescore takes over until the
        // player taps Continue (or the backdrop) to start the next half.
        <Scorecard state={game} onContinue={onNext} />
      ) : (
        <button
          onClick={onNext}
          className="shrink-0 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 active:bg-emerald-600 mb-4"
        >
          Next batter →
        </button>
      )}
    </div>
  );
}

function GameOverPanel({
  game,
  winner,
  onPlayAgain,
}: {
  game: GameState;
  winner: "home" | "away";
  onPlayAgain: () => void;
}) {
  const winningTeam = winner === "home" ? game.home.team : game.away.team;
  const winColor = getTeamDisplayColor(winningTeam);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 backdrop-blur-md px-4 py-6"
      // Tap outside the card → dismiss (same as the main button).
      onClick={onPlayAgain}
    >
      <motion.div
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 24, delay: 0.05 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl border bg-zinc-950 px-6 py-8 sm:px-8 sm:py-10 flex flex-col items-center gap-4"
        style={{
          borderColor: `${winColor}55`,
          boxShadow: `0 0 60px ${winColor}33`,
          background: `radial-gradient(ellipse at top, ${winColor}22 0%, rgb(9,9,11) 70%)`,
        }}
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500">
          Final
        </div>

        {/* Logo — biggest visual, bounces in. */}
        <motion.div
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 240,
            damping: 14,
            delay: 0.15,
          }}
          className="rounded-2xl p-1 ring-4"
          style={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ["--tw-ring-color" as any]: `${winColor}80`,
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <Image
            src={winningTeam.logos.primary}
            alt={winningTeam.name}
            width={320}
            height={320}
            priority
            className="h-32 w-32 sm:h-40 sm:w-40 rounded-xl object-contain"
          />
        </motion.div>

        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 280 }}
          className="flex flex-col items-center gap-1 text-center"
        >
          <div
            className="text-2xl sm:text-3xl font-black tracking-tight"
            style={{ color: winColor }}
          >
            {winningTeam.name}
          </div>
          <div className="text-xs font-bold uppercase tracking-[0.45em] text-zinc-300">
            Win
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.3 }}
          className="flex items-center gap-3 font-mono mt-1"
        >
          <FinalScore team={game.away} winning={winner === "away"} />
          <span className="text-zinc-700">·</span>
          <FinalScore team={game.home} winning={winner === "home"} />
        </motion.div>

        <motion.button
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.25 }}
          onClick={onPlayAgain}
          className="mt-3 w-full rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 active:bg-emerald-600"
        >
          Continue
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function FinalScore({
  team,
  winning,
}: {
  team: GameState["away"];
  winning: boolean;
}) {
  const color = getTeamDisplayColor(team.team);
  return (
    <span
      className={`flex items-baseline gap-1.5 ${winning ? "" : "opacity-60"}`}
      style={{ color: winning ? color : undefined }}
    >
      <span className="text-sm font-semibold">{team.team.shortName}</span>
      <span className="text-xl sm:text-2xl font-bold tabular-nums">
        {team.runs}
      </span>
    </span>
  );
}

function PreGameScreen({
  away,
  home,
  awayPitcher,
  homePitcher,
  records,
  onDismiss,
}: {
  away: Team;
  home: Team;
  awayPitcher: PitcherCard;
  homePitcher: PitcherCard;
  records: { away: { wins: number; losses: number }; home: { wins: number; losses: number } } | null;
  onDismiss: () => void;
}) {
  const awayColor = getTeamDisplayColor(away);
  const homeColor = getTeamDisplayColor(home);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-40 flex overflow-hidden cursor-pointer"
      onClick={onDismiss}
    >
      {/* Away team panel — slides in from the left */}
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%", transition: { duration: 0.25, ease: "easeIn" } }}
        transition={{ type: "spring", stiffness: 185, damping: 26 }}
        className="flex-1 relative flex flex-col items-center justify-center gap-3 overflow-hidden px-5"
        style={{
          background: `linear-gradient(140deg, ${awayColor}2a 0%, #050507 58%)`,
        }}
      >
        <div
          className="absolute -top-20 -left-20 h-72 w-72 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${awayColor}38 0%, transparent 65%)` }}
          aria-hidden
        />
        <div className="text-[9px] font-bold uppercase tracking-[0.45em] text-zinc-600">Away</div>
        <motion.div
          initial={{ scale: 0.45, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.18 }}
          className="rounded-2xl p-2 ring-2 bg-black/40"
          style={{ ["--tw-ring-color" as any]: `${awayColor}55` }}
        >
          <Image
            src={away.logos.primary}
            alt={away.name}
            width={320}
            height={320}
            className="h-20 w-20 sm:h-28 sm:w-28 rounded-xl object-contain"
          />
        </motion.div>
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 260 }}
          className="text-center"
        >
          <div
            className="text-lg sm:text-xl font-black tracking-tight"
            style={{ color: awayColor }}
          >
            {away.shortName}
          </div>
          {records && (
            <div className="text-xs text-zinc-400 font-mono tabular-nums mt-0.5">
              {records.away.wins}–{records.away.losses}
            </div>
          )}
        </motion.div>
        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.46, duration: 0.28 }}
          className="mt-1 text-center"
        >
          <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-600">Starting</div>
          <div className="text-xs sm:text-sm font-semibold text-zinc-200 mt-0.5">
            {awayPitcher.name}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">
            Ctrl {awayPitcher.control} · IP {awayPitcher.ip}
          </div>
        </motion.div>
      </motion.div>

      {/* VS badge */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 20, delay: 0.28 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"
      >
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/80">
          <span className="text-sm sm:text-base font-black text-zinc-300 tracking-tight leading-none">
            vs
          </span>
        </div>
      </motion.div>

      {/* Home team panel — slides in from the right */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%", transition: { duration: 0.25, ease: "easeIn" } }}
        transition={{ type: "spring", stiffness: 185, damping: 26 }}
        className="flex-1 relative flex flex-col items-center justify-center gap-3 overflow-hidden px-5"
        style={{
          background: `linear-gradient(220deg, ${homeColor}2a 0%, #050507 58%)`,
        }}
      >
        <div
          className="absolute -top-20 -right-20 h-72 w-72 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${homeColor}38 0%, transparent 65%)` }}
          aria-hidden
        />
        <div className="text-[9px] font-bold uppercase tracking-[0.45em] text-zinc-600">Home</div>
        <motion.div
          initial={{ scale: 0.45, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.22 }}
          className="rounded-2xl p-2 ring-2 bg-black/40"
          style={{ ["--tw-ring-color" as any]: `${homeColor}55` }}
        >
          <Image
            src={home.logos.primary}
            alt={home.name}
            width={320}
            height={320}
            className="h-20 w-20 sm:h-28 sm:w-28 rounded-xl object-contain"
          />
        </motion.div>
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.34, type: "spring", stiffness: 260 }}
          className="text-center"
        >
          <div
            className="text-lg sm:text-xl font-black tracking-tight"
            style={{ color: homeColor }}
          >
            {home.shortName}
          </div>
          {records && (
            <div className="text-xs text-zinc-400 font-mono tabular-nums mt-0.5">
              {records.home.wins}–{records.home.losses}
            </div>
          )}
        </motion.div>
        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.28 }}
          className="mt-1 text-center"
        >
          <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-600">Starting</div>
          <div className="text-xs sm:text-sm font-semibold text-zinc-200 mt-0.5">
            {homePitcher.name}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">
            Ctrl {homePitcher.control} · IP {homePitcher.ip}
          </div>
        </motion.div>
      </motion.div>

      {/* Stadium image — home team venue */}
      {home.stadium && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.55, duration: 0.4, ease: "easeOut" }}
          className="absolute bottom-12 left-3 right-3 z-10 pointer-events-none"
        >
          <div className="relative w-full h-28 sm:h-36 overflow-hidden rounded-xl">
            <Image
              src={home.stadium}
              alt={`${home.name} stadium`}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-zinc-950/70 via-transparent to-zinc-950/30" />
          </div>
        </motion.div>
      )}

      {/* Tap hint + draining progress bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.3 }}
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
      >
        <div className="text-center pb-2.5">
          <span className="text-[10px] uppercase tracking-[0.4em] text-zinc-600 font-semibold">
            Tap to begin
          </span>
        </div>
        <div className="h-0.5 bg-zinc-900 overflow-hidden">
          <motion.div
            className="h-full bg-zinc-600"
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: PREGAME_HOLD_MS / 1000, ease: "linear" }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({
  runners,
  outcome,
  preBases,
}: {
  runners: RunnerSnapshot[];
  outcome: Outcome;
  preBases: Bases;
}) {
  return (
    <div className="relative aspect-square w-full">
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Outfield grass: lighter centre, fades to the same dark green
              used for the full-screen background so the edges blend in */}
          <radialGradient id="fl-outfield" cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor="#2d6b34" />
            <stop offset="100%" stopColor="#1b4520" />
          </radialGradient>
          {/* Infield dirt: lighter centre fading to darker clay at edges */}
          <radialGradient id="fl-dirt" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#cc9f68" />
            <stop offset="100%" stopColor="#8f5e2e" />
          </radialGradient>
          {/* Infield grass: brighter centre fading out */}
          <radialGradient id="fl-ingrass" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#2e7040" />
            <stop offset="100%" stopColor="#1b4e2a" />
          </radialGradient>
        </defs>

        {/* Outfield grass with mow stripes */}
        <rect width="100" height="100" fill="url(#fl-outfield)" />
        {/* Infield dirt — r=41 keeps the base bags fully within the skin */}
        <circle cx="50" cy="50" r="41" fill="url(#fl-dirt)" />
        {/* Infield grass */}
        <polygon points="50,25 75,50 50,75 25,50" fill="url(#fl-ingrass)" />
        {/* Foul lines */}
        <line x1="50" y1="88" x2="100" y2="38" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
        <line x1="50" y1="88" x2="0" y2="38" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
        {/* Baselines */}
        <polygon
          points="50,12 88,50 50,88 12,50"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        {/* Pitcher's mound */}
        <circle cx="50" cy="50" r="5" fill="#cc9f68" />
        {/* Base bags */}
        <BaseSquare cx={88} cy={50} occupied={runners.some((r) => r.pos === "first")} />
        <BaseSquare cx={50} cy={12} occupied={runners.some((r) => r.pos === "second")} />
        <BaseSquare cx={12} cy={50} occupied={runners.some((r) => r.pos === "third")} />
        {/* Home plate */}
        <rect
          x={45}
          y={84}
          width={10}
          height={10}
          transform="rotate(45 50 89)"
          fill="white"
        />

        {/* Outcome trajectory: lives inside the same viewBox so coords
            line up perfectly with the diamond. */}
        <OutcomeTrajectory outcome={outcome} preBases={preBases} />
      </svg>

      {/* Big animated label sitting on top of the diamond — K for a
          strikeout, GONE! for a homer, etc. Uses HTML so the type
          rendering is crisp and easy to style. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <OutcomeBadge outcome={outcome} />
      </div>

      <AnimatePresence>
        {runners.map((r) => (
          <RunnerCard key={r.card.id} card={r.card} pos={r.pos} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Trajectory paths drawn within the diamond's viewBox.
//
// Coordinates: the diamond is 100×100 with home plate at (50,88), 1st
// base at (88,50), 2nd at (50,12), 3rd at (12,50). Smaller y-values =
// "deeper" outfield. Paths start at home and curve outward, with shape
// chosen to evoke each outcome — short arcs for outs, long sweeping
// arcs for hits, a near-straight rocket for a homer.
type TrajectoryCfg = {
  paths: string[];
  duration: number;
  segDelay?: number;
};

// SVG coordinate helper — one decimal place is plenty.
const f = (n: number) => n.toFixed(1);

// Randomised trajectory for every outcome so no two at-bats look identical.
// Called inside a useMemo in OutcomeTrajectory so the values are frozen for
// the lifetime of each field view.
function randomTrajectory(outcome: Outcome, preBases: Bases): TrajectoryCfg | null {
  const r = Math.random;
  switch (outcome) {
    case "single": {
      // Shallow outfield — full width spread
      const endX = 15 + r() * 70;
      const endY = 24 + r() * 16;
      return { paths: [`M 50 88 Q ${f(40 + r() * 20)} 42 ${f(endX)} ${f(endY)}`], duration: 0.62 };
    }
    case "singlePlus": {
      const endX = 12 + r() * 76;
      const endY = 13 + r() * 16;
      return { paths: [`M 50 88 Q ${f(38 + r() * 24)} 35 ${f(endX)} ${f(endY)}`], duration: 0.7 };
    }
    case "double": {
      const endX = 5 + r() * 90;
      const endY = 4 + r() * 14;
      return { paths: [`M 50 88 Q ${f(32 + r() * 36)} 28 ${f(endX)} ${f(endY)}`], duration: 0.85 };
    }
    case "triple": {
      // Deep corner shots — left or right at random
      const toLeft = r() < 0.5;
      const endX = toLeft ? 4 + r() * 22 : 74 + r() * 22;
      const endY = 4 + r() * 16;
      const cpX = toLeft ? 16 + r() * 18 : 66 + r() * 18;
      return { paths: [`M 50 88 Q ${f(cpX)} 24 ${f(endX)} ${f(endY)}`], duration: 1.0 };
    }
    case "homer": {
      // Straight over the fence with a slight L/R drift
      const drift = r() * 20 - 10;
      return { paths: [`M 50 88 Q ${f(50 + drift)} 30 ${f(50 + drift)} -22`], duration: 1.0 };
    }
    case "fb": {
      // Fly ball out — caught anywhere in the outfield
      const endX = 12 + r() * 76;
      const endY = 10 + r() * 34;
      return {
        paths: [`M 50 88 Q ${f(36 + r() * 28)} ${f(18 + r() * 24)} ${f(endX)} ${f(endY)}`],
        duration: 0.9,
      };
    }
    case "pu": {
      // Pop up — dies near the plate with slight direction variation
      const endX = 44 + r() * 12;
      const endY = 70 + r() * 14;
      return { paths: [`M 50 88 Q ${f(44 + r() * 12)} 62 ${f(endX)} ${f(endY)}`], duration: 0.52 };
    }
    case "gb":
      return gbTrajectory(preBases);
    default:
      return null;
  }
}

// Ground out: rolls to the relevant infield position near the basepath
// boundary, then gets thrown to the force-play target base.
function gbTrajectory(preBases: Bases): TrajectoryCfg {
  const target = (() => {
    if (!preBases.first) return { x: 84, y: 50 };                   // 1st
    if (preBases.second && preBases.third) return { x: 50, y: 84 }; // home
    if (preBases.second) return { x: 16, y: 50 };                   // 3rd
    return { x: 50, y: 16 };                                        // 2nd
  })();

  // Fielding spot randomised near the relevant section of the basepath edge
  const r = Math.random;
  const fp = (() => {
    if (!preBases.first)
      return { x: 64 + r() * 16, y: 54 + r() * 14 }; // 1B side
    if (preBases.second && preBases.third)
      return { x: 17 + r() * 14, y: 50 + r() * 14 }; // near 3B
    if (preBases.second)
      return { x: 28 + r() * 12, y: 42 + r() * 14 }; // SS area
    return r() > 0.5
      ? { x: 30 + r() * 14, y: 44 + r() * 14 }  // SS
      : { x: 56 + r() * 14, y: 44 + r() * 14 };  // 2B
  })();

  return {
    paths: [`M 50 88 L ${f(fp.x)} ${f(fp.y)}`, `M ${f(fp.x)} ${f(fp.y)} L ${target.x} ${target.y}`],
    duration: 0.38,
    segDelay: 0.38,
  };
}

function OutcomeTrajectory({
  outcome,
  preBases,
}: {
  outcome: Outcome;
  preBases: Bases;
}) {
  // Freeze the random trajectory for this at-bat. Runner IDs are stable
  // within a single field view so this fires exactly once per outcome.
  const cfg = useMemo(
    () => randomTrajectory(outcome, preBases),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outcome, preBases.first?.id, preBases.second?.id, preBases.third?.id],
  );
  if (!cfg) return null;

  const isHit =
    outcome === "single" ||
    outcome === "singlePlus" ||
    outcome === "double" ||
    outcome === "triple" ||
    outcome === "homer";
  const stroke = isHit ? "#fbbf24" : "#fb7185";

  return (
    <g>
      {cfg.paths.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          stroke={stroke}
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0.95 }}
          animate={{ pathLength: 1 }}
          transition={{
            pathLength: {
              duration: cfg.duration,
              delay: i * (cfg.segDelay ?? 0),
              ease: "easeOut",
            },
          }}
          style={{
            filter: `drop-shadow(0 0 4px ${stroke}80)`,
          }}
        />
      ))}
    </g>
  );
}

// Big text overlay sitting on top of the diamond. Most plays get nothing
// (the trajectory speaks for itself); the dramatic ones get a stamped
// callout — K for strikeout, GONE! for homer, OUT for routine outs, BB
// for a walk.
function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  if (outcome === "so") {
    // Big red K stamps in cleanly — start large + faded, slam down to
    // size with a tight spring. No rotation jitter, no multi-keyframe
    // wobble; one motion, lands hard.
    return (
      <motion.div
        key="K"
        initial={{ scale: 2.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 360,
          damping: 16,
          mass: 0.9,
        }}
        className="font-black text-rose-500 leading-none italic"
        style={{
          fontSize: "min(45vw, 20rem)",
          textShadow:
            "0 6px 28px rgba(244,63,94,0.6), 0 0 6px rgba(0,0,0,0.7)",
        }}
      >
        K
      </motion.div>
    );
  }

  if (outcome === "homer") {
    return (
      <motion.div
        key="HR"
        initial={{ scale: 0, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{
          delay: 0.85,
          type: "spring",
          stiffness: 240,
          damping: 14,
        }}
        className="rounded-full bg-emerald-500/90 px-4 py-2 text-sm sm:text-base font-black uppercase tracking-[0.3em] text-zinc-950 shadow-lg shadow-emerald-500/40"
      >
        Gone!
      </motion.div>
    );
  }

  if (outcome === "bb") {
    return (
      <motion.div
        key="BB"
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="rounded-full bg-amber-400/90 px-3 py-1.5 text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-zinc-950"
      >
        Walk
      </motion.div>
    );
  }

  if (outcome === "gb" || outcome === "fb" || outcome === "pu") {
    return (
      <motion.div
        key="OUT"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.15, 1], opacity: 1 }}
        transition={{
          delay: outcome === "gb" ? 0.85 : 0.7,
          duration: 0.4,
          ease: "easeOut",
        }}
        className="rounded-full bg-rose-500/90 px-3 py-1.5 text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-white"
      >
        Out
      </motion.div>
    );
  }

  return null;
}

function BaseSquare({
  cx,
  cy,
  occupied,
}: {
  cx: number;
  cy: number;
  occupied: boolean;
}) {
  return (
    <rect
      x={cx - 3}
      y={cy - 3}
      width={6}
      height={6}
      transform={`rotate(45 ${cx} ${cy})`}
      fill={occupied ? "#22c55e" : "white"}
      stroke={occupied ? "#4ade80" : "rgba(255,255,255,0.6)"}
      strokeWidth={0.6}
    />
  );
}

const POSITION_CLASS: Record<Exclude<BasePos, "scored">, string> = {
  home: "left-1/2 -translate-x-1/2 bottom-0",
  first: "right-0 top-1/2 -translate-y-1/2",
  second: "left-1/2 -translate-x-1/2 top-0",
  third: "left-0 top-1/2 -translate-y-1/2",
  // "scoring" sits on home plate — same spot as where a batter starts.
  // Runners pass through this for one frame as they cross the plate, so
  // the player actually sees the run get scored before the card exits.
  scoring: "left-1/2 -translate-x-1/2 bottom-0",
};

function RunnerCard({ card, pos }: { card: BatterCard; pos: BasePos }) {
  if (pos === "scored") return null;
  return (
    <motion.div
      layoutId={`runner-${card.id}`}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7 }}
      transition={{
        layout: { duration: STEP_MS / 1000, ease: "easeInOut" },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
      }}
      className={`absolute ${POSITION_CLASS[pos]} flex flex-col items-center w-[22%]`}
    >
      <Image
        src={`/cards/${card.id}.png`}
        alt={card.name}
        width={1488}
        height={2079}
        className="block w-full h-auto rounded-md shadow-lg shadow-black/60 ring-1 ring-emerald-400/40"
        sizes="120px"
      />
      <div className="mt-1 max-w-full truncate text-[10px] font-semibold text-zinc-200">
        {card.name.split(" ").slice(-1)[0]}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manage modal: pitching change (fielding team) + pinch hit (batting team)
// ─────────────────────────────────────────────────────────────────────────────

function ManageModal({
  open,
  game,
  onClose,
  onChangePitcher,
  onPinchHit,
}: {
  open: boolean;
  game: GameState;
  onClose: () => void;
  onChangePitcher: (side: "home" | "away", id: string) => void;
  onPinchHit: (side: "home" | "away", id: string) => void;
}) {
  const fielding = fieldingTeam(game);
  const fieldingSide: "home" | "away" = game.half === "top" ? "home" : "away";
  const batting = battingTeam(game);
  const battingSide: "home" | "away" = game.half === "top" ? "away" : "home";
  const fatigue = pitcherFatigue(fielding, game.inning);
  const currentBatterCard = batting.lineup[batting.battingIndex];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 px-3"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider">Manage</h2>
              <button
                onClick={onClose}
                className="text-xs text-zinc-500 hover:text-zinc-200"
              >
                Close
              </button>
            </div>

            <Section
              title={`Pitching · ${fielding.team.shortName}`}
              color={fielding.team.colors.primary}
            >
              <div className="text-[11px] text-zinc-400 mb-2">
                On the mound:{" "}
                <span className="text-zinc-100 font-semibold">{fielding.pitcher.name}</span>{" "}
                <span className="text-zinc-500">
                  · Ctrl {fielding.pitcher.control} · IP {fielding.pitcher.ip}
                </span>
                {fatigue > 0 && (
                  <span className="ml-1 text-amber-400">(−{fatigue})</span>
                )}
              </div>
              {fielding.bullpen.length === 0 ? (
                <div className="text-[11px] text-zinc-600 italic">
                  No relievers available.
                </div>
              ) : (
                <div className="space-y-1">
                  {fielding.bullpen.map((p) => (
                    <SubButton
                      key={p.id}
                      onClick={() => onChangePitcher(fieldingSide, p.id)}
                    >
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-zinc-500">
                        Ctrl {p.control} · IP {p.ip}
                      </span>
                    </SubButton>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title={`Pinch hit · ${batting.team.shortName}`}
              color={batting.team.colors.primary}
            >
              <div className="text-[11px] text-zinc-400 mb-2">
                Up next:{" "}
                <span className="text-zinc-100 font-semibold">
                  {currentBatterCard.name}
                </span>{" "}
                <span className="text-zinc-500">
                  · OB {currentBatterCard.onBase}
                </span>
              </div>
              {batting.bench.length === 0 ? (
                <div className="text-[11px] text-zinc-600 italic">
                  No bench batters available.
                </div>
              ) : (
                <div className="space-y-1">
                  {batting.bench.map((b) => (
                    <SubButton
                      key={b.id}
                      onClick={() => onPinchHit(battingSide, b.id)}
                    >
                      <span className="font-semibold">{b.name}</span>
                      <span className="text-zinc-500">OB {b.onBase}</span>
                    </SubButton>
                  ))}
                </div>
              )}
            </Section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 last:mb-0">
      <div
        className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em]"
        style={{ color }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function SubButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs hover:border-emerald-500/60 hover:bg-zinc-900 active:bg-zinc-800"
    >
      {children}
    </button>
  );
}
