// A division groups teams within a league. The Single-A league has two
// divisions (Turnpike, Garden State) of 5 teams each.
export type Division = {
  slug: string;
  name: string;
  // Ordered list of team slugs in this division. Order is canonical for
  // display in standings before any games are played.
  teamSlugs: string[];
};
