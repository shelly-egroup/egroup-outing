import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const compiled = await readFile(new URL("../.tools/team-tests/teams.js", import.meta.url), "utf8");
const { assignTeams, parseTeams, teamCounts } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

test("a random draw splits everyone into two teams at most one apart", () => {
  for (const size of [0, 1, 2, 7, 12, 25]) {
    const uids = Array.from({ length: size }, (_, i) => "u" + i);
    const teams = assignTeams(uids, {}, { random: seeded(size + 3) });
    assert.equal(Object.keys(teams).length, size);
    const { red, blue, open } = teamCounts(uids, teams);
    assert.equal(open, 0);
    assert.ok(Math.abs(red - blue) <= 1, size + " people: " + red + " vs " + blue);
  }
});

test("hand picks stay put and only the others are drawn", () => {
  const uids = ["a", "b", "c", "d", "e", "f"];
  const teams = assignTeams(uids, { a: "red", b: "red", c: "red" }, { random: seeded(9) });
  assert.equal(teams.a, "red"); assert.equal(teams.b, "red"); assert.equal(teams.c, "red");
  assert.deepEqual([teams.d, teams.e, teams.f], ["blue", "blue", "blue"]);
});

test("a full reshuffle ignores earlier picks but keeps the balance", () => {
  const uids = ["a", "b", "c", "d"];
  const teams = assignTeams(uids, { a: "red", b: "red", c: "red", d: "red" }, { keep: false, random: seeded(4) });
  const { red, blue } = teamCounts(uids, teams);
  assert.equal(red, 2); assert.equal(blue, 2);
});

test("stored teams only keep valid team names", () => {
  assert.deepEqual(parseTeams({ a: "red", b: "blue", c: "green", d: 1, "": "red" }), { a: "red", b: "blue" });
  assert.deepEqual(parseTeams(null), {});
  assert.deepEqual(parseTeams(["red"]), {});
});

const { parseTeamConfig, captainOf, withCaptains, pickTurn, drawFirstPick, DEFAULT_TEAM_CONFIG } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

test("team set-up starts hidden, picking off, turns on, james and ivy as captains", () => {
  const config = parseTeamConfig(null);
  assert.equal(config.published, false); assert.equal(config.picking, false); assert.equal(config.turns, true); assert.equal(config.firstPick, null);
  assert.equal(config.captains.red.email, "egroup.james@gmail.com"); assert.equal(config.captains.blue.email, "egroup.ivy@gmail.com");
  assert.deepEqual(parseTeamConfig({}), DEFAULT_TEAM_CONFIG);
});

test("a stored set-up is read back, bad captains fall back, one person cannot lead both teams", () => {
  const config = parseTeamConfig({ published: true, picking: true, turns: false, firstPick: "blue", captains: { red: { email: " EGROUP.Daniel@gmail.com ", uid: "u1", name: "Daniel" }, blue: { email: "not-an-email" } } });
  assert.equal(config.published, true); assert.equal(config.picking, true); assert.equal(config.turns, false); assert.equal(config.firstPick, "blue");
  assert.deepEqual(config.captains.red, { email: "egroup.daniel@gmail.com", uid: "u1", name: "Daniel" });
  assert.equal(config.captains.blue.email, "egroup.ivy@gmail.com");
  const clash = parseTeamConfig({ captains: { red: { email: "egroup.ivy@gmail.com" }, blue: { email: "egroup.ivy@gmail.com" } } });
  assert.notEqual(clash.captains.red.email, clash.captains.blue.email);
  assert.equal(parseTeamConfig({ firstPick: "green" }).firstPick, null);
});

test("captains are found by uid or by email, and always sit on the team they lead", () => {
  const captains = { red: { email: "egroup.james@gmail.com", uid: "j" }, blue: { email: "egroup.ivy@gmail.com" } };
  assert.equal(captainOf(captains, "j"), "red");
  assert.equal(captainOf(captains, "x", "Egroup.Ivy@gmail.com"), "blue");
  assert.equal(captainOf(captains, "x", "someone@gmail.com"), undefined);
  assert.deepEqual(withCaptains({ j: "blue", a: "blue" }, captains), { j: "red", a: "blue" });
});

test("a draw keeps the captains with their teams, even when everything else is reshuffled", () => {
  const uids = ["j", "i", "a", "b", "c", "d"], fixed = { j: "red", i: "blue" };
  for (const keep of [true, false]) {
    const teams = assignTeams(uids, { j: "blue", i: "red", a: "red" }, { keep, fixed, random: seeded(7) });
    assert.equal(teams.j, "red"); assert.equal(teams.i, "blue");
    const { red, blue, open } = teamCounts(uids, teams);
    assert.equal(open, 0); assert.ok(Math.abs(red - blue) <= 1);
  }
});

test("with turns the first pick opens and the picks alternate; captains are not counted", () => {
  const captains = { red: { email: "r@x.co", uid: "R" }, blue: { email: "b@x.co" } };   // blue's captain has not signed in
  const uids = ["R", "a", "b", "c", "d"];
  let teams = { R: "red" };
  const order = [];
  for (let n = 0; n < 4; n++) { const turn = pickTurn(uids, teams, captains, "blue"); order.push(turn); teams = { ...teams, [uids.find(u => !teams[u])]: turn }; }
  assert.deepEqual(order, ["blue", "red", "blue", "red"]);
  assert.equal(pickTurn(uids, teams, captains, "blue"), null);
  assert.equal(pickTurn(["R", "a"], { R: "red" }, captains, "red"), "red");
});

test("the coin toss lands on either team", () => {
  assert.equal(drawFirstPick(() => .1), "red"); assert.equal(drawFirstPick(() => .9), "blue");
});

const { drawOne, parseTeamDraw } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

test("one at a time: someone still to be placed, to the smaller team, either team on a tie", () => {
  const captains = { red: { email: "r@x.co", uid: "R" }, blue: { email: "b@x.co", uid: "B" } };
  const uids = ["R", "B", "a", "b", "c"];
  const one = drawOne(uids, { R: "red", B: "blue", a: "red" }, captains, () => .5);
  assert.equal(one.team, "blue"); assert.ok(["b", "c"].includes(one.uid));
  assert.equal(drawOne(uids, { R: "red", B: "blue" }, captains, () => .1).team, "red");
  assert.equal(drawOne(uids, { R: "red", B: "blue" }, captains, () => .9).team, "blue");
  assert.equal(drawOne(uids, { R: "red", B: "blue", a: "red", b: "blue", c: "red" }, captains), null);
  // drawn one by one to the end, the teams stay within one
  let teams = { R: "red", B: "blue" };
  for (let next; (next = drawOne(uids, teams, captains, seeded(5))); ) teams = { ...teams, [next.uid]: next.team };
  const { red, blue, open } = teamCounts(uids, teams);
  assert.equal(open, 0); assert.ok(Math.abs(red - blue) <= 1);
});

test("the draw event reads back one agent or everyone, and nothing else", () => {
  assert.deepEqual(parseTeamDraw({ seq: 3, uid: "a", team: "blue", at: 9 }), { seq: 3, uid: "a", team: "blue", at: 9 });
  assert.deepEqual(parseTeamDraw({ seq: 4, all: true, at: 10 }), { seq: 4, all: true, at: 10 });
  assert.equal(parseTeamDraw({ seq: 5, uid: "a", team: "green" }), null);
  assert.equal(parseTeamDraw({ uid: "a", team: "red" }), null);
  assert.equal(parseTeamDraw(null), null); assert.equal(parseTeamDraw([1]), null);
});

test("an odd number of agents: taking turns, the first pick also takes the one left over", () => {
  const captains = { red: { email: "r@x.co", uid: "R" }, blue: { email: "b@x.co", uid: "B" } };
  const uids = ["R", "B", "a", "b", "c", "d", "e", "f", "g"];
  for (const first of ["red", "blue"]) {
    let teams = { R: "red", B: "blue" };
    for (let turn; (turn = pickTurn(uids, teams, captains, first)); ) teams = { ...teams, [uids.find(u => !teams[u])]: turn };
    const counts = teamCounts(uids, teams);
    assert.equal(counts[first], 5, first + " picks first"); assert.equal(counts[first === "red" ? "blue" : "red"], 4);
  }
});

test("drawing everyone at once settles the odd one at random", () => {
  const uids = ["R", "B", "a", "b", "c"], fixed = { R: "red", B: "blue" }, sizes = new Set();
  for (let seed = 1; seed < 40; seed++) { const { red } = teamCounts(uids, assignTeams(uids, fixed, { keep: true, fixed, random: seeded(seed) })); sizes.add(red); }
  assert.deepEqual([...sizes].sort(), [2, 3]);
});
