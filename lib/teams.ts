export type Team = "red" | "blue";
export type TeamMap = Record<string, Team>;
export const TEAMS: Team[] = ["red", "blue"];
export const TEAM_LABEL: Record<Team, string> = { red: "紅隊", blue: "藍隊" };
export const otherTeam = (team: Team): Team => team === "red" ? "blue" : "red";

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
 * without it the whole list is reshuffled. `fixed` people (the captains) always stay with their team. Each draw goes to the
 * smaller side, so the teams end at most one apart.
 */
export function assignTeams(uids: string[], current: TeamMap, { keep = true, random = Math.random, fixed = {} }: { keep?: boolean; random?: () => number; fixed?: TeamMap } = {}): TeamMap {
  const next: TeamMap = {}, pool: string[] = [];
  for (const uid of uids) { if (fixed[uid]) next[uid] = fixed[uid]; else if (keep && current[uid]) next[uid] = current[uid]; else pool.push(uid); }
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  let { red, blue } = teamCounts(Object.keys(next), next);
  for (const uid of pool) {
    const team: Team = red < blue ? "red" : blue < red ? "blue" : random() < .5 ? "red" : "blue";
    next[uid] = team;
    if (team === "red") red++; else blue++;
  }
  return next;
}

/** A team captain, known by their company Google account; `uid`, name and photo are filled in once they have signed in. */
export type Captain = { email: string; uid?: string; name?: string; photoURL?: string };
export type Captains = Record<Team, Captain>;
/** Who leads each team until the organisers change it. */
export const DEFAULT_CAPTAINS: Captains = { red: { email: "egroup.james@gmail.com" }, blue: { email: "egroup.ivy@gmail.com" } };
/**
 * How the teams work on the site (`outing/teamConfig`): `published` shows the teams on the front page, `picking` lets the
 * captains pick their people there, and `turns` makes them take turns rather than pick freely — `firstPick` (drawn by lot or
 * named by the organisers) opens. Publishing and picking start off, turns on; the organisers switch them in the back office.
 */
export type TeamConfig = { published: boolean; picking: boolean; turns: boolean; firstPick: Team | null; captains: Captains };
export const DEFAULT_TEAM_CONFIG: TeamConfig = { published: false, picking: false, turns: true, firstPick: null, captains: DEFAULT_CAPTAINS };

export const normalEmail = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : "";
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** A stored captain, or the fallback when the record is missing or has no usable email. */
export function parseCaptain(value: unknown, fallback: Captain): Captain {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const v = value as Record<string, unknown>, email = normalEmail(v.email);
  if (!isEmail(email)) return fallback;
  const captain: Captain = { email };
  if (typeof v.uid === "string" && v.uid.length > 0 && v.uid.length <= 128) captain.uid = v.uid;
  if (typeof v.name === "string" && v.name.trim()) captain.name = v.name.trim().slice(0, 80);
  if (typeof v.photoURL === "string" && v.photoURL.startsWith("https://")) captain.photoURL = v.photoURL.slice(0, 1000);
  return captain;
}

export function parseTeamConfig(value: unknown): TeamConfig {
  const v = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const c = v.captains && typeof v.captains === "object" && !Array.isArray(v.captains) ? v.captains as Record<string, unknown> : {};
  const captains = { red: parseCaptain(c.red, DEFAULT_CAPTAINS.red), blue: parseCaptain(c.blue, DEFAULT_CAPTAINS.blue) };
  // one person cannot lead both teams: the blue record gives way to a default that is not the red captain
  if (captains.red.email === captains.blue.email || (captains.red.uid && captains.red.uid === captains.blue.uid))
    captains.blue = captains.red.email !== DEFAULT_CAPTAINS.blue.email ? DEFAULT_CAPTAINS.blue : DEFAULT_CAPTAINS.red;
  return { published: v.published === true, picking: v.picking === true, turns: v.turns !== false, firstPick: v.firstPick === "red" || v.firstPick === "blue" ? v.firstPick : null, captains };
}

/** The team someone leads, if any — by uid once they have signed in, or by their email. */
export function captainOf(captains: Captains, uid?: string | null, email?: string | null): Team | undefined {
  const mail = normalEmail(email);
  return TEAMS.find(team => (!!uid && captains[team].uid === uid) || (!!mail && captains[team].email === mail));
}

/** Captains always belong to the team they lead; everyone else as drawn. */
export function withCaptains(teams: TeamMap, captains: Captains): TeamMap {
  const next = { ...teams };
  for (const team of TEAMS) { const uid = captains[team].uid; if (uid) next[uid] = team; }
  return next;
}

/**
 * Whose turn it is when the captains take turns, or null once everyone is placed: on equal numbers the first-pick team,
 * otherwise the team that is behind — so the picks alternate from the first pick. The captains themselves are not counted
 * (one each, and one may not have signed in yet).
 */
export function pickTurn(uids: string[], teams: TeamMap, captains: Captains, first: Team): Team | null {
  const counts = teamCounts(uids.filter(uid => !captainOf(captains, uid)), teams);
  if (!counts.open) return null;
  return counts.red === counts.blue ? first : counts.red < counts.blue ? "red" : "blue";
}

/** A coin toss for the first pick. */
export const drawFirstPick = (random = Math.random): Team => random() < .5 ? "red" : "blue";
