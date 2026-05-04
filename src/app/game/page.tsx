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
import { getEffectiveRoster } from "@/lib/rosters";
import { getTeamBySlug } from "@/lib/teams";
import { getTeamDisplayColor } from "@/lib/teamColor";
import { DICE_TUMBLE_MS, Dice } from "@/components/Dice";
import { BaseDiamond } from "@/components/BaseDiamond";
import { Scoreboard } from "@/components/Scoreboard";

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
          }
          clearActiveSeasonGame();
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
      onPersist={(state) =>
        saveActiveExhibitionGame(
          state.away.team.slug,
          state.home.team.slug,
          state,
        )
      }
      onEnd={() => {
        clearActiveExhibitionGame();
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

  const awayRoster = getEffectiveRoster(
    awaySlug,
    awaySlug === playerSlug ? 1 : currentTier,
  );
  const homeRoster = getEffectiveRoster(
    homeSlug,
    homeSlug === playerSlug ? 1 : currentTier,
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

function Play({
  initial,
  onEnd,
  playerSide,
  onPersist,
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
}) {
  const [game, setGame] = useState<GameState>(initial);
  const [stage, setStage] = useState<Stage>({ kind: "intro" });
  const [manageOpen, setManageOpen] = useState(false);

  const pitcher = useMemo(() => currentPitcher(game), [game]);
  const batter = useMemo(() => currentBatter(game), [game]);
  const fatigue = useMemo(
    () => pitcherFatigue(fieldingTeam(game), game.inning),
    [game],
  );

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
        setGame((g) => applyAtBatOutcome(g, outcome));
      }, SWING_HOLD_MS);
    }, DICE_TUMBLE_MS);
  }

  function nextBatter() {
    setStage({ kind: "intro" });
  }

  // Auto-advance from intro → pitcher-ready after the matchup beat.
  useEffect(() => {
    if (stage.kind !== "intro") return;
    const t = setTimeout(
      () => setStage({ kind: "pitcher-ready" }),
      INTRO_HOLD_MS,
    );
    return () => clearTimeout(t);
  }, [stage.kind]);

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

  return (
    <main className="h-[100dvh] flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden px-3 py-2 sm:px-6 sm:py-3">
      {/* Two-row header keeps everything legible on narrow screens.
          Row 1: leave/sub controls. Row 2: scoreboard + bases. */}
      <header className="shrink-0 mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <button
            onClick={() => onEnd(game)}
            className="rounded-full border border-zinc-800 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
          >
            End
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
            <Scoreboard state={game} />
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
          onPlayAgain={() => onEnd(game)}
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
        />
      )}
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
          ringClass="ring-rose-400/40"
          position={pitcherPos(focus)}
        />
        <CardLayer
          card={batter}
          ringClass="ring-sky-400/40"
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
            tone="batter"
            status={swingStatus}
            value={swingValue}
            label={`OB ${batter.onBase}`}
            onTap={playerCanSwing ? onTapSwing : undefined}
          />
        ) : (
          <Dice
            tone="pitcher"
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
  ringClass,
  position,
}: {
  card: CardType;
  ringClass: string;
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
        className={`block max-h-full max-w-full w-auto h-auto rounded-xl shadow-md shadow-black/40 ring-4 ${ringClass}`}
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

type BasePos = "home" | "first" | "second" | "third" | "scored";
const BASE_ORDER: BasePos[] = ["home", "first", "second", "third", "scored"];

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

  const initial: RunnerSnapshot[] = [];
  if (prev.first) initial.push({ card: prev.first, pos: "first" });
  if (prev.second) initial.push({ card: prev.second, pos: "second" });
  if (prev.third) initial.push({ card: prev.third, pos: "third" });
  if (!isOut(outcome)) initial.push({ card: justBatted, pos: "home" });

  const dest: Record<string, BasePos> = {};
  for (const r of initial) {
    if (current.first?.id === r.card.id) dest[r.card.id] = "first";
    else if (current.second?.id === r.card.id) dest[r.card.id] = "second";
    else if (current.third?.id === r.card.id) dest[r.card.id] = "third";
    else dest[r.card.id] = "scored";
  }

  const frames: RunnerSnapshot[][] = [initial];
  let cur = initial;
  for (let safety = 0; safety < 6; safety++) {
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

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-between py-2">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className="text-center shrink-0"
      >
        <div
          className={`text-2xl sm:text-3xl font-bold tracking-tight ${
            isOut(outcome) ? "text-rose-400" : "text-emerald-400"
          }`}
        >
          {outcomeLabel(outcome).toUpperCase()}
        </div>
        <div className="text-xs sm:text-sm text-zinc-400">{justBatted.name}</div>
        {halfEnded && !gameOver && (
          <div
            className={`mt-1 text-xs sm:text-sm font-semibold uppercase tracking-wider ${
              game.inning >= 10 ? "text-amber-400" : "text-rose-400"
            }`}
          >
            {game.inning >= 10 ? "Extra innings" : "Side retired"}
          </div>
        )}
      </motion.div>

      <Field runners={visible} />

      {isAnimating ? (
        <div className="h-10" aria-hidden />
      ) : gameOver ? (
        <GameOverPanel game={game} winner={gameOver.winner} onPlayAgain={onPlayAgain} />
      ) : (
        <button
          onClick={onNext}
          className="shrink-0 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 active:bg-emerald-600"
        >
          {halfEnded
            ? `${game.half === "top" ? "Top" : "Bottom"} of ${game.inning}${game.inning > 9 ? " (extras)" : ""} →`
            : "Next batter →"}
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="shrink-0 flex flex-col items-center gap-2"
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        Final
      </div>
      <div
        className="text-lg sm:text-xl font-bold tracking-tight"
        style={{ color: getTeamDisplayColor(winningTeam) }}
      >
        {winningTeam.name} win
      </div>
      <div className="flex items-center gap-3 font-mono">
        <FinalScore team={game.away} winning={winner === "away"} />
        <span className="text-zinc-700">·</span>
        <FinalScore team={game.home} winning={winner === "home"} />
      </div>
      <button
        onClick={onPlayAgain}
        className="mt-1 rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 active:bg-emerald-600"
      >
        Play again
      </button>
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

function Field({ runners }: { runners: RunnerSnapshot[] }) {
  return (
    <div className="relative aspect-square w-full max-w-[min(70vh,420px)]">
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        <polygon
          points="50,12 88,50 50,88 12,50"
          fill="rgba(34,197,94,0.05)"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="0.4"
          strokeDasharray="2 2"
        />
        <BaseSquare cx={88} cy={50} occupied={runners.some((r) => r.pos === "first")} />
        <BaseSquare cx={50} cy={12} occupied={runners.some((r) => r.pos === "second")} />
        <BaseSquare cx={12} cy={50} occupied={runners.some((r) => r.pos === "third")} />
        <rect
          x={45}
          y={84}
          width={10}
          height={10}
          transform="rotate(45 50 89)"
          fill="rgba(255,255,255,0.35)"
        />
      </svg>

      <AnimatePresence>
        {runners.map((r) => (
          <RunnerCard key={r.card.id} card={r.card} pos={r.pos} />
        ))}
      </AnimatePresence>
    </div>
  );
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
      fill={occupied ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.05)"}
      stroke={occupied ? "#10b981" : "rgba(255,255,255,0.3)"}
      strokeWidth={0.6}
    />
  );
}

const POSITION_CLASS: Record<Exclude<BasePos, "scored">, string> = {
  home: "left-1/2 -translate-x-1/2 bottom-0",
  first: "right-0 top-1/2 -translate-y-1/2",
  second: "left-1/2 -translate-x-1/2 top-0",
  third: "left-0 top-1/2 -translate-y-1/2",
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
