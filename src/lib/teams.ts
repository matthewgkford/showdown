import teamsData from "@data/teams.json";
import divisionsData from "@data/divisions.json";
import type { Team } from "@/types/team";
import type { Division } from "@/types/division";

const TEAMS = teamsData as Team[];
const DIVISIONS = divisionsData as Division[];

const teamBySlug = new Map(TEAMS.map((t) => [t.slug, t]));
const divisionBySlug = new Map(DIVISIONS.map((d) => [d.slug, d]));

export function getAllTeams(): Team[] {
  return TEAMS;
}

export function getTeamBySlug(slug: string): Team | null {
  return teamBySlug.get(slug) ?? null;
}

export function getAllDivisions(): Division[] {
  return DIVISIONS;
}

export function getDivisionBySlug(slug: string): Division | null {
  return divisionBySlug.get(slug) ?? null;
}

export function getTeamsByDivision(divisionSlug: string): Team[] {
  return TEAMS.filter((t) => t.divisionSlug === divisionSlug);
}

export function getDivisionForTeam(teamSlug: string): Division | null {
  const team = teamBySlug.get(teamSlug);
  if (!team) return null;
  return divisionBySlug.get(team.divisionSlug) ?? null;
}
