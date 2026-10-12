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
