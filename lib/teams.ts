export type Team = "red" | "blue";
export type TeamMap = Record<string, Team>;
export const TEAMS: Team[] = ["red", "blue"];
export const TEAM_LABEL: Record<Team, string> = { red: "紅隊", blue: "藍隊" };

/** Only well-formed entries survive: a uid key and one of the two team names. */
export function parseTeams(value: unknown): TeamMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([uid, team]) => uid.length > 0 && uid.length <= 128 && (team === "red" || team === "blue"))) as TeamMap;
}

export function teamCounts(uids: string[], teams: TeamMap) {
  const counts = { red: 0, blue: 0, open: 0 };
  for (const uid of uids) counts[teams[uid] || "open"]++;
  return counts;
}

/**
 * Deals people into red and blue. With `keep`, everyone already placed (a hand pick) stays put and only the rest are drawn;
 * without it the whole list is reshuffled. Each draw goes to the smaller side, so the teams end at most one apart.
 */
export function assignTeams(uids: string[], current: TeamMap, { keep = true, random = Math.random }: { keep?: boolean; random?: () => number } = {}): TeamMap {
  const next: TeamMap = {}, pool: string[] = [];
  for (const uid of uids) { if (keep && current[uid]) next[uid] = current[uid]; else pool.push(uid); }
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  let { red, blue } = teamCounts(Object.keys(next), next);
  for (const uid of pool) {
    const team: Team = red < blue ? "red" : blue < red ? "blue" : random() < .5 ? "red" : "blue";
    next[uid] = team;
    if (team === "red") red++; else blue++;
  }
  return next;
}
