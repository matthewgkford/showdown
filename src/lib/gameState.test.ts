import { describe, expect, it } from "vitest";
import type { BatterCard, PitcherCard } from "@/types/card";
import type { Team } from "@/types/team";
import {
  EMPTY_BASES,
  applyAtBatOutcome,
  changePitcher,
  checkGameOver,
  currentBatter,
  currentPitcher,
  pinchHit,
  pitcherFatigue,
  startGame,
  type GameState,
} from "./gameState";

const awayTeam: Team = {
  slug: "away",
  name: "Away",
  shortName: "AWY",
  divisionSlug: "test",
  colors: { primary: "#888", accent: "#aaa", light: "#ccc" },
  logos: { primary: "/logos/away/primary.png" },
  flavor: "Test fixture team.",
  stadium: null,
};
const homeTeam: Team = {
  slug: "home",
  name: "Home",
  shortName: "HME",
  divisionSlug: "test",
  colors: { primary: "#888", accent: "#aaa", light: "#ccc" },
  logos: { primary: "/logos/home/primary.png" },
  flavor: "Test fixture team.",
  stadium: null,
};

// Synthetic cards — we don't care about the chart values here, only that
// each batter is identifiable by id when they end up on a base.
function batter(id: string, onBase = 9): BatterCard {
  return {
    id,
    name: id.toUpperCase(),
    year: 2001,
    team: "TST",
    teamFullName: "Test",
    set: "2001",
    points: 100,
    cardType: "batter",
    onBase,
    speed: { letter: "C", value: 10 },
    bats: "R",
    positions: [{ position: "DH", fielding: 0 }],
    chart: {
      so: { min: 1, max: 1 },
      gb: { min: 2, max: 2 },
      fb: { min: 3, max: 3 },
      bb: { min: 4, max: 4 },
      single: { min: 5, max: 5 },
      singlePlus: null,
      double: null,
      triple: null,
      homer: null,
    },
  };
}

const fakePitcher: PitcherCard = {
  id: "test-pitcher",
  name: "TestPitcher",
  year: 2001,
  team: "TST",
  teamFullName: "Test",
  set: "2001",
  points: 100,
  cardType: "pitcher",
  control: 3,
  throws: "R",
  pitcherType: "starter",
  ip: 6,
  chart: {
    pu: { min: 1, max: 1 },
    so: { min: 2, max: 2 },
    gb: { min: 3, max: 3 },
    fb: { min: 4, max: 4 },
    bb: { min: 5, max: 5 },
    single: { min: 6, max: 6 },
    double: null,
    homer: null,
  },
};

const awayLineup = Array.from({ length: 9 }, (_, i) => batter(`a${i}`));
const homeLineup = Array.from({ length: 9 }, (_, i) => batter(`h${i}`));

function freshGame(): GameState {
  return startGame(
    {
      team: awayTeam,
      lineup: awayLineup,
      bench: [],
      pitcher: fakePitcher,
      bullpen: [],
    },
    {
      team: homeTeam,
      lineup: homeLineup,
      bench: [],
      pitcher: fakePitcher,
      bullpen: [],
    },
  );
}

describe("startGame", () => {
  it("opens at top of 1st, no outs, empty bases, both teams 0 runs", () => {
    const g = freshGame();
    expect(g.inning).toBe(1);
    expect(g.half).toBe("top");
    expect(g.outs).toBe(0);
    expect(g.bases).toEqual(EMPTY_BASES);
    expect(g.away.runs).toBe(0);
    expect(g.home.runs).toBe(0);
    expect(g.away.battingIndex).toBe(0);
    expect(g.home.battingIndex).toBe(0);
  });

  it("currentBatter returns the away leadoff at top of 1st", () => {
    const g = freshGame();
    expect(currentBatter(g).id).toBe("a0");
  });

  it("currentPitcher returns the home pitcher at top of 1st", () => {
    const g = freshGame();
    expect(currentPitcher(g)).toBe(fakePitcher);
  });
});

describe("single", () => {
  it("from empty bases puts batter on 1st, no runs", () => {
    const g = applyAtBatOutcome(freshGame(), "single");
    expect(g.bases.first?.id).toBe("a0");
    expect(g.bases.second).toBeNull();
    expect(g.bases.third).toBeNull();
    expect(g.away.runs).toBe(0);
  });

  it("with runner on 3rd scores 1, batter to 1st", () => {
    const g0: GameState = {
      ...freshGame(),
      bases: { first: null, second: null, third: batter("x") },
    };
    const g = applyAtBatOutcome(g0, "single");
    expect(g.away.runs).toBe(1);
    expect(g.bases.third).toBeNull();
    expect(g.bases.first?.id).toBe("a0");
  });

  it("with bases loaded scores 1, runners advance 1", () => {
    const g0: GameState = {
      ...freshGame(),
      bases: { first: batter("r1"), second: batter("r2"), third: batter("r3") },
    };
    const g = applyAtBatOutcome(g0, "single");
    expect(g.away.runs).toBe(1);
    expect(g.bases.first?.id).toBe("a0");
    expect(g.bases.second?.id).toBe("r1");
    expect(g.bases.third?.id).toBe("r2");
  });
});

describe("singlePlus (1B+)", () => {
  it("from empty bases puts batter on 1st", () => {
    const g = applyAtBatOutcome(freshGame(), "singlePlus");
    expect(g.bases.first?.id).toBe("a0");
    expect(g.bases.second).toBeNull();
    expect(g.bases.third).toBeNull();
    expect(g.away.runs).toBe(0);
  });

  it("with runner on 1st: batter to 1st, runner to 3rd, no runs", () => {
    const g0: GameState = {
      ...freshGame(),
      bases: { first: batter("r1"), second: null, third: null },
    };
    const g = applyAtBatOutcome(g0, "singlePlus");
    expect(g.away.runs).toBe(0);
    expect(g.bases.first?.id).toBe("a0");
    expect(g.bases.third?.id).toBe("r1");
    expect(g.bases.second).toBeNull();
  });

  it("with bases loaded: 2 runs, batter on 1st, runner-from-1st on 3rd", () => {
    const g0: GameState = {
      ...freshGame(),
      bases: { first: batter("r1"), second: batter("r2"), third: batter("r3") },
    };
    const g = applyAtBatOutcome(g0, "singlePlus");
    expect(g.away.runs).toBe(2);
    expect(g.bases.first?.id).toBe("a0");
    expect(g.bases.second).toBeNull();
    expect(g.bases.third?.id).toBe("r1");
  });
});

describe("double", () => {
  it("with bases loaded: 2 runs, batter on 2nd, runner-from-1st on 3rd, 1st empty", () => {
    const g0: GameState = {
      ...freshGame(),
      bases: { first: batter("r1"), second: batter("r2"), third: batter("r3") },
    };
    const g = applyAtBatOutcome(g0, "double");
    expect(g.away.runs).toBe(2);
    expect(g.bases.first).toBeNull();
    expect(g.bases.second?.id).toBe("a0");
    expect(g.bases.third?.id).toBe("r1");
  });
});

describe("triple", () => {
  it("with bases loaded: 3 runs, batter on 3rd", () => {
    const g0: GameState = {
      ...freshGame(),
      bases: { first: batter("r1"), second: batter("r2"), third: batter("r3") },
    };
    const g = applyAtBatOutcome(g0, "triple");
    expect(g.away.runs).toBe(3);
    expect(g.bases.first).toBeNull();
    expect(g.bases.second).toBeNull();
    expect(g.bases.third?.id).toBe("a0");
  });
});

describe("homer", () => {
  it("from empty bases scores 1", () => {
    const g = applyAtBatOutcome(freshGame(), "homer");
    expect(g.away.runs).toBe(1);
    expect(g.bases).toEqual(EMPTY_BASES);
  });

  it("with bases loaded: grand slam = 4 runs, bases empty", () => {
    const g0: GameState = {
      ...freshGame(),
      bases: { first: batter("r1"), second: batter("r2"), third: batter("r3") },
    };
    const g = applyAtBatOutcome(g0, "homer");
    expect(g.away.runs).toBe(4);
    expect(g.bases).toEqual(EMPTY_BASES);
  });
});

describe("walk forcing", () => {
  it("empty bases: batter to 1st, no runs", () => {
    const g = applyAtBatOutcome(freshGame(), "bb");
    expect(g.bases.first?.id).toBe("a0");
    expect(g.bases.second).toBeNull();
    expect(g.bases.third).toBeNull();
    expect(g.away.runs).toBe(0);
  });

  it("runner on 1st only: forces runner to 2nd, batter to 1st", () => {
    const g0: GameState = {
      ...freshGame(),
      bases: { first: batter("r1"), second: null, third: null },
    };
    const g = applyAtBatOutcome(g0, "bb");
    expect(g.away.runs).toBe(0);
    expect(g.bases.first?.id).toBe("a0");
    expect(g.bases.second?.id).toBe("r1");
    expect(g.bases.third).toBeNull();
  });

  it("runners on 2nd and 3rd: no force, batter to 1st, others stay", () => {
    const g0: GameState = {
      ...freshGame(),
      bases: { first: null, second: batter("r2"), third: batter("r3") },
    };
    const g = applyAtBatOutcome(g0, "bb");
    expect(g.away.runs).toBe(0);
    expect(g.bases.first?.id).toBe("a0");
    expect(g.bases.second?.id).toBe("r2");
    expect(g.bases.third?.id).toBe("r3");
  });

  it("bases loaded: 1 run forced in, bases stay loaded", () => {
    const g0: GameState = {
      ...freshGame(),
      bases: { first: batter("r1"), second: batter("r2"), third: batter("r3") },
    };
    const g = applyAtBatOutcome(g0, "bb");
    expect(g.away.runs).toBe(1);
    expect(g.bases.first?.id).toBe("a0");
    expect(g.bases.second?.id).toBe("r1");
    expect(g.bases.third?.id).toBe("r2");
  });
});

describe("outs", () => {
  it.each(["so", "fb", "pu"] as const)("%s increments outs and doesn't advance", (out) => {
    const g0: GameState = {
      ...freshGame(),
      bases: { first: batter("r1"), second: null, third: null },
    };
    const g = applyAtBatOutcome(g0, out);
    expect(g.outs).toBe(1);
    expect(g.bases.first?.id).toBe("r1");
    expect(g.away.runs).toBe(0);
  });

  it("gb with empty bases: batter is out, no advance", () => {
    const g0 = freshGame();
    const g = applyAtBatOutcome(g0, "gb");
    expect(g.outs).toBe(1);
    expect(g.bases).toEqual(EMPTY_BASES);
    expect(g.away.runs).toBe(0);
  });

  it("gb with runner on 1st: fielder's choice — runner out, batter to 1st", () => {
    const g0: GameState = {
      ...freshGame(),
      bases: { first: batter("r1"), second: null, third: null },
    };
    const g = applyAtBatOutcome(g0, "gb");
    expect(g.outs).toBe(1);
    // Batter takes 1st (lineup[0] is the batter at battingIndex=0)
    expect(g.bases.first?.id).toBe(g0.away.lineup[0].id);
    expect(g.bases.second).toBeNull();
    expect(g.bases.third).toBeNull();
    expect(g.away.runs).toBe(0);
  });

  it("gb with runner on 2nd only: regular ground out, runner holds", () => {
    const g0: GameState = {
      ...freshGame(),
      bases: { first: null, second: batter("r2"), third: null },
    };
    const g = applyAtBatOutcome(g0, "gb");
    expect(g.outs).toBe(1);
    expect(g.bases.first).toBeNull();
    expect(g.bases.second?.id).toBe("r2");
    expect(g.bases.third).toBeNull();
  });

  it("gb with bases loaded: lead force out, batter to 1st, others hold", () => {
    const g0: GameState = {
      ...freshGame(),
      bases: {
        first: batter("r1"),
        second: batter("r2"),
        third: batter("r3"),
      },
    };
    const g = applyAtBatOutcome(g0, "gb");
    expect(g.outs).toBe(1);
    expect(g.bases.first?.id).toBe(g0.away.lineup[0].id);
    expect(g.bases.second?.id).toBe("r2");
    expect(g.bases.third?.id).toBe("r3");
    expect(g.away.runs).toBe(0);
  });

  it("3rd out flips top → bottom, resets outs and bases, increments away batting index", () => {
    const g0: GameState = { ...freshGame(), outs: 2 };
    const g = applyAtBatOutcome(g0, "so");
    expect(g.half).toBe("bottom");
    expect(g.inning).toBe(1);
    expect(g.outs).toBe(0);
    expect(g.bases).toEqual(EMPTY_BASES);
    expect(g.away.battingIndex).toBe(1);
    expect(g.home.battingIndex).toBe(0);
  });

  it("3rd out in bottom flips to top of next inning", () => {
    const g0: GameState = {
      ...freshGame(),
      half: "bottom",
      outs: 2,
      inning: 3,
    };
    const g = applyAtBatOutcome(g0, "fb");
    expect(g.half).toBe("top");
    expect(g.inning).toBe(4);
    expect(g.outs).toBe(0);
    expect(g.home.battingIndex).toBe(1);
    expect(g.away.battingIndex).toBe(0);
  });
});

describe("batting index", () => {
  it("wraps from 8 back to 0 after the 9th batter", () => {
    let g: GameState = { ...freshGame(), away: { ...freshGame().away, battingIndex: 8 } };
    g = applyAtBatOutcome(g, "single");
    expect(g.away.battingIndex).toBe(0);
  });

  it("only the batting team's index advances per at-bat", () => {
    const g = applyAtBatOutcome(freshGame(), "single");
    expect(g.away.battingIndex).toBe(1);
    expect(g.home.battingIndex).toBe(0);
  });
});

describe("checkGameOver", () => {
  it("returns null in early innings regardless of score", () => {
    const g: GameState = {
      ...freshGame(),
      inning: 3,
      half: "bottom",
      home: { ...freshGame().home, runs: 5 },
      away: { ...freshGame().away, runs: 0 },
    };
    expect(checkGameOver(g)).toBeNull();
  });

  it("walk-off: home leads in bottom of 9th → home wins", () => {
    const g: GameState = {
      ...freshGame(),
      inning: 9,
      half: "bottom",
      home: { ...freshGame().home, runs: 4 },
      away: { ...freshGame().away, runs: 3 },
    };
    expect(checkGameOver(g)).toEqual({ winner: "home" });
  });

  it("home leads after top of 9th → bottom of 9th not needed (home wins)", () => {
    // After top of 9th's 3rd out, half flips to bottom, outs reset to 0.
    const g: GameState = {
      ...freshGame(),
      inning: 9,
      half: "bottom",
      outs: 0,
      home: { ...freshGame().home, runs: 5 },
      away: { ...freshGame().away, runs: 2 },
    };
    expect(checkGameOver(g)).toEqual({ winner: "home" });
  });

  it("home tied or behind in bottom of 9th → game continues", () => {
    const tied: GameState = {
      ...freshGame(),
      inning: 9,
      half: "bottom",
      home: { ...freshGame().home, runs: 3 },
      away: { ...freshGame().away, runs: 3 },
    };
    expect(checkGameOver(tied)).toBeNull();

    const behind: GameState = {
      ...freshGame(),
      inning: 9,
      half: "bottom",
      home: { ...freshGame().home, runs: 2 },
      away: { ...freshGame().away, runs: 4 },
    };
    expect(checkGameOver(behind)).toBeNull();
  });

  it("after bottom of 9th: away leads → away wins", () => {
    // bottom 9 finishes → half flips to top, inning becomes 10.
    const g: GameState = {
      ...freshGame(),
      inning: 10,
      half: "top",
      home: { ...freshGame().home, runs: 2 },
      away: { ...freshGame().away, runs: 5 },
    };
    expect(checkGameOver(g)).toEqual({ winner: "away" });
  });

  it("after bottom of 9th: home leads → home wins", () => {
    const g: GameState = {
      ...freshGame(),
      inning: 10,
      half: "top",
      home: { ...freshGame().home, runs: 6 },
      away: { ...freshGame().away, runs: 2 },
    };
    expect(checkGameOver(g)).toEqual({ winner: "home" });
  });

  it("tied after bottom of 9th → null (extras territory, deferred)", () => {
    const g: GameState = {
      ...freshGame(),
      inning: 10,
      half: "top",
      home: { ...freshGame().home, runs: 3 },
      away: { ...freshGame().away, runs: 3 },
    };
    expect(checkGameOver(g)).toBeNull();
  });

  it("walk-off in extras (e.g. bottom of 10th, home goes ahead)", () => {
    const g: GameState = {
      ...freshGame(),
      inning: 10,
      half: "bottom",
      home: { ...freshGame().home, runs: 4 },
      away: { ...freshGame().away, runs: 3 },
    };
    expect(checkGameOver(g)).toEqual({ winner: "home" });
  });
});

describe("changePitcher", () => {
  function reliever(id: string, ip = 4): PitcherCard {
    return { ...fakePitcher, id, name: id, ip };
  }

  it("swaps the pitcher in, sets the start-inning to current, removes from bullpen", () => {
    const r1 = reliever("r1");
    const r2 = reliever("r2");
    const g0: GameState = {
      ...freshGame(),
      inning: 7,
      home: { ...freshGame().home, bullpen: [r1, r2] },
    };
    const g = changePitcher(g0, "home", "r1");
    expect(g.home.pitcher.id).toBe("r1");
    expect(g.home.pitcherStartedInning).toBe(7);
    expect(g.home.bullpen.map((p) => p.id)).toEqual(["r2"]);
  });

  it("ignores unknown pitcher id (state unchanged)", () => {
    const r1 = reliever("r1");
    const g0: GameState = {
      ...freshGame(),
      home: { ...freshGame().home, bullpen: [r1] },
    };
    const g = changePitcher(g0, "home", "nope");
    expect(g).toEqual(g0);
  });
});

describe("pinchHit", () => {
  it("replaces the current batter, removes pinch hitter from bench", () => {
    const ph = batter("pinch");
    const g0: GameState = {
      ...freshGame(),
      away: {
        ...freshGame().away,
        battingIndex: 4,
        bench: [ph],
      },
    };
    const g = pinchHit(g0, "away", "pinch");
    expect(g.away.lineup[4].id).toBe("pinch");
    expect(g.away.lineup[3].id).toBe("a3"); // others untouched
    expect(g.away.bench).toEqual([]);
  });

  it("ignores unknown bench id (state unchanged)", () => {
    const g0 = freshGame();
    const g = pinchHit(g0, "away", "nope");
    expect(g).toEqual(g0);
  });
});

describe("pitcherFatigue", () => {
  // The fake pitcher in this file has IP 6, started in inning 1 (default).
  it("0 within IP", () => {
    const g = freshGame();
    expect(pitcherFatigue(g.home, 1)).toBe(0);
    expect(pitcherFatigue(g.home, 5)).toBe(0);
    expect(pitcherFatigue(g.home, 6)).toBe(0); // IP=6 → through 6th is fine
  });

  it("1 in the inning right after IP", () => {
    const g = freshGame();
    expect(pitcherFatigue(g.home, 7)).toBe(1);
  });

  it("scales linearly past IP", () => {
    const g = freshGame();
    expect(pitcherFatigue(g.home, 8)).toBe(2);
    expect(pitcherFatigue(g.home, 10)).toBe(4);
  });

  it("counts only innings pitched since the pitcher entered", () => {
    // Reliever entered in inning 6, IP 4 → through inning 9 is exactly IP.
    const g: GameState = {
      ...freshGame(),
      home: {
        ...freshGame().home,
        pitcher: { ...freshGame().home.pitcher, ip: 4 },
        pitcherStartedInning: 6,
      },
    };
    expect(pitcherFatigue(g.home, 9)).toBe(0);
    expect(pitcherFatigue(g.home, 10)).toBe(1);
  });
});
