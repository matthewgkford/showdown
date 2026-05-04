import type { Team } from "@/types/team";

// Pick the team color that reads best on a dark background. We prefer
// accent (the designer's "callout" colour), but for teams whose accent
// is a deep tone (e.g. Pepperoni Slices' burgundy, Meadowlanders' teal)
// we fall back to light → primary so team names in the scoreboard never
// look muddy against zinc-950.
const MIN_LUMINANCE = 0.3;

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
