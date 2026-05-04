export type TeamColors = {
  // Primary brand colour — uniform body, scoreboard tinting, hero
  // backgrounds.
  primary: string;
  // Accent — secondary highlight, outlines, callouts.
  accent: string;
  // Light — pale tint used for cream/foreground elements (jersey
  // pinstripes, foil treatment, etc.).
  light: string;
};

export type TeamLogos = {
  // Path under public/, e.g. "/logos/bagels/primary.png".
  primary: string;
  // Future: cap, wordmark variants — left out of v1.
};

export type Team = {
  // URL-safe identifier, also the directory name under public/logos/.
  // Used as the foreign key from rosters, schedules, divisions, etc.
  slug: string;
  // Display name on team pages and standings.
  name: string;
  // 3-letter scoreboard code (e.g. "BAG", "PEP").
  shortName: string;
  // Foreign key into divisions.json.
  divisionSlug: string;
  colors: TeamColors;
  logos: TeamLogos;
  // 1-2 sentences of personality. Shown on the choose-team confirm
  // screen and reusable on the future season dashboard.
  flavor: string;
  // Stadium name. Null for v1 — populate in a later phase.
  stadium: string | null;
};
