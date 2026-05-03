export type Team = {
  id: string;
  name: string;       // e.g. "Red Boys"
  shortName: string;  // e.g. "RED" — for the scoreboard
  color: string;      // primary color (hex), used for scoreboard tinting
  logoUrl: string;    // path under public/, e.g. "/teams/red-boys.png"
};
