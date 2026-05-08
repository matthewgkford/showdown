import type { Team } from "@/types/team";

// Pick the team color that reads best on a dark background. We prefer
// accent (the designer's "callout" colour), but for teams whose accent
// is a deep tone (e.g. Pepperoni Slices' burgundy, Meadowlanders' teal)
// we fall back to light → primary so team names in the scoreboard never
// look muddy against zinc-950.
const MIN_LUMINANCE = 0.3;

// RGB Euclidean distance below which two team primaries are considered
// "too similar" and the away team falls back to its accent so the home
// vs away cue stays readable. The league has many near-black primaries
// (#1A1A1A, #1C1C1C, #1A1815) and several dark navys, so this threshold
// gets tripped a lot — exactly the case the user wants accent for.
const SIMILAR_THRESHOLD = 60;

// For a given matchup, decide which colour each side should use for the
// active dice + card ring. Default to primary; if both primaries are
// near-identical, switch the away team to its accent.
export function getMatchColors(
  home: Team,
  away: Team,
): { home: string; away: string } {
  const homePrimary = home.colors.primary;
  const awayPrimary = away.colors.primary;
  if (rgbDistance(homePrimary, awayPrimary) < SIMILAR_THRESHOLD) {
    return { home: homePrimary, away: away.colors.accent };
  }
  return { home: homePrimary, away: awayPrimary };
}

// Generate a top→bottom gradient pair from a single team colour. Mixes
// with white/black so the dice still has 3D depth even when the base
// is very dark or very light.
export function diceGradientStops(hex: string): [string, string] {
  return [mixWithWhite(hex, 0.45), mixWithBlack(hex, 0.35)];
}

function rgbDistance(a: string, b: string): number {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return Infinity;
  const dr = ra[0] - rb[0];
  const dg = ra[1] - rb[1];
  const db = ra[2] - rb[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function mixWithWhite(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex(rgb.map((v) => Math.round(v + (255 - v) * amount)) as [
    number,
    number,
    number,
  ]);
}

function mixWithBlack(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex(rgb.map((v) => Math.round(v * (1 - amount))) as [
    number,
    number,
    number,
  ]);
}

function toHex([r, g, b]: [number, number, number]): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function getTeamDisplayColor(team: Team): string {
  const candidates = [
    team.colors.accent,
    team.colors.light,
    team.colors.primary,
  ];
  for (const c of candidates) {
    if (relativeLuminance(c) >= MIN_LUMINANCE) return c;
  }
  // Everything was dark — return the brightest of the bunch anyway.
  return [...candidates].sort(
    (a, b) => relativeLuminance(b) - relativeLuminance(a),
  )[0];
}

// sRGB relative luminance per WCAG. 0 = black, 1 = white.
function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
