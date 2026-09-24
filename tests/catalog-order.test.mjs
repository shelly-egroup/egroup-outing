import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const uri = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const trips = uri(await readFile(new URL("../.tools/admin-tests/trips.js", import.meta.url), "utf8"));
const { sortedChoices, moveChoice, appendChoice, moveItem, cleanPreferences } = await import(trips);
const impactSource = (await readFile(new URL("../.tools/admin-tests/catalog-impact.js", import.meta.url), "utf8")).replace('"./trips"', JSON.stringify(trips));
const { catalogImpacts } = await import(uri(impactSource));
const choice = label => ({ label, description: "", price: "1000" });
const group = () => ({ label: "按摩", choices: { c0: choice("腳底 60 分鐘"), c1: choice("腳底 80 分鐘"), c2: choice("全身指壓") } });
const ids = group => sortedChoices(group).map(([id]) => id);

test("legacy catalogs render without a migration and new choices append", () => {
  const current = group();
  assert.deepEqual(ids(current), ["c0", "c1", "c2"]);
  appendChoice(current, "item-new", choice("新療程"));
  assert.deepEqual(ids(current), ["c0", "c1", "c2", "item-new"]);
});
test("saved order survives object key reordering and preserves vote IDs and labels", () => {
  const current = group();
  const original = structuredClone(current);
  moveChoice(current, 0, 2);
  const stored = JSON.parse(JSON.stringify(current));
  stored.choices = Object.fromEntries(Object.entries(stored.choices).reverse());
  assert.deepEqual(ids(stored), ["c1", "c2", "c0"]);
  for (const [id, value] of Object.entries(original.choices)) {
    const { order, ...sameChoice } = stored.choices[id];
    assert.deepEqual(sameChoice, value);
  }
  const before = { plans: { B: { shortName: "放鬆派", groups: { g0: original } } } };
  const after = { plans: { B: { shortName: "放鬆派", groups: { g0: stored } } } };
  const vote = { u: { planId: "B", displayName: "同事", updatedAt: 1 } };
  const detail = { u: { planId: "B", preferences: { g0: "c0" }, updatedAt: 1 } };
  assert.deepEqual(catalogImpacts(before, after, vote, detail), []);
  assert.deepEqual(cleanPreferences(after.plans.B, detail.u.preferences), { g0: "c0" });
});
test("moving upward, deletion gaps and append preserve the displayed sequence", () => {
  const current = group();
  moveChoice(current, 2, 0);
  delete current.choices.c0;
  appendChoice(current, "item-next", choice("新療程"));
  assert.deepEqual(ids(current), ["c2", "c1", "item-next"]);
  moveChoice(current, 2, 0);
  assert.deepEqual(ids(current), ["item-next", "c2", "c1"]);
});
test("schedule move keeps complete stops together and invalid destinations are no-ops", () => {
  const stops = [0, 1, 2].map(n => ({ time: n + ":00", title: "站" + n, description: "說明" + n }));
  assert.deepEqual(moveItem(stops, 0, 2), [stops[1], stops[2], stops[0]]);
  assert.deepEqual(moveItem(stops, 2, 0), [stops[2], stops[0], stops[1]]);
  assert.deepEqual(stops.map(stop => stop.time), ["0:00", "1:00", "2:00"]);
  for (const [from, to] of [[0, 0], [-1, 1], [0, 3], [1, -1], [0, 1.5]]) assert.equal(moveItem(stops, from, to), stops);
  const current = group(); moveChoice(current, 0, 3);
  assert.deepEqual(current, group());
});
