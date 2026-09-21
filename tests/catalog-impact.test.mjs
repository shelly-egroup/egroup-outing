import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const sourceUrl = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const trips = sourceUrl(await readFile(new URL("../.tools/admin-tests/trips.js", import.meta.url), "utf8"));
const compiled = (await readFile(new URL("../.tools/admin-tests/catalog-impact.js", import.meta.url), "utf8")).replace('"./trips"', JSON.stringify(trips));
const { catalogImpacts, catalogImpactKey, choiceSelectionCounts } = await import(sourceUrl(compiled));
const before = { plans: { B: { shortName: "放鬆派", groups: { g0: { label: "按摩想選哪一種？", choices: { c1: { label: "全身按摩 · 60 分鐘", description: "舒緩肩背", price: "1500" }, c2: { label: "足底按摩", description: "", price: "1000" } } } } } } };
const votes = { u1: { planId: "B", displayName: "Alice", updatedAt: 10 }, u2: { planId: "B", displayName: "Bob", updatedAt: 10 } };
const details = { u1: { planId: "B", preferences: { g0: "c1" }, updatedAt: 10 }, u2: { planId: "B", preferences: { g0: "c1" }, updatedAt: 10 } };
test("unchanged options and newly added options do not prompt", () => {
  const after = structuredClone(before);
  after.plans.B.groups.g0.choices.newId = { label: "新療程", description: "", price: "" };
  assert.deepEqual(catalogImpacts(before, after, votes, details), []);
});
test("massage duration, description and price changes identify all affected people", () => {
  const after = structuredClone(before);
  Object.assign(after.plans.B.groups.g0.choices.c1, { label: "全身按摩 · 90 分鐘", description: "改為精油", price: "2000" });
  const impacts = catalogImpacts(before, after, votes, details);
  assert.equal(impacts.length, 1);
  assert.equal(impacts[0].removed, false);
  assert.deepEqual(impacts[0].people.map(person => person.name), ["Alice", "Bob"]);
  assert.deepEqual(impacts[0].changes.map(change => change.field), ["名稱／時長", "補充說明", "價格"]);
});
test("deleting a selected choice, its question or its plan is protected", () => {
  for (const remove of [after => delete after.plans.B.groups.g0.choices.c1, after => delete after.plans.B.groups.g0, after => delete after.plans.B]) {
    const after = structuredClone(before); remove(after);
    const impacts = catalogImpacts(before, after, votes, details);
    assert.equal(impacts.length, 1);
    assert.equal(impacts[0].removed, true);
    assert.equal(impacts[0].people.length, 2);
  }
});
test("unselected options can be removed without impacting votes", () => {
  const after = structuredClone(before); delete after.plans.B.groups.g0.choices.c2;
  assert.deepEqual(catalogImpacts(before, after, votes, details), []);
});
test("question wording and individual-to-group mode changes also need review", () => {
  const after = structuredClone(before);
  after.plans.B.groups.g0.label = "改成共同選一家";
  after.plans.B.groups.g0.selectionMode = "group";
  assert.deepEqual(catalogImpacts(before, after, votes, details)[0].changes.map(change => change.field), ["題目", "安排方式"]);
});
test("changing camp does not attach old preferences to the new camp", () => {
  const other = { ...votes, u1: { ...votes.u1, planId: "A" } };
  const after = structuredClone(before); delete after.plans.B.groups.g0.choices.c1;
  assert.deepEqual(catalogImpacts(before, after, other, details)[0].people.map(person => person.uid), ["u2"]);
  assert.deepEqual(choiceSelectionCounts("B", other, details), { g0: { c1: 1 } });
});
test("timestamps mid-sync do not allow a referenced option to be deleted", () => {
  const syncing = structuredClone(details); syncing.u1.updatedAt = 9;
  const after = structuredClone(before); delete after.plans.B.groups.g0.choices.c1;
  assert.equal(catalogImpacts(before, after, votes, syncing)[0].people.length, 2);
});
test("a new voter or another content change invalidates the prior acknowledgement", () => {
  const after = structuredClone(before); after.plans.B.groups.g0.choices.c1.price = "1600";
  const first = catalogImpactKey(catalogImpacts(before, after, votes, details));
  const moreVotes = { ...votes, u3: { ...votes.u1, displayName: "Carol" } };
  const moreDetails = { ...details, u3: { ...details.u1 } };
  assert.notEqual(catalogImpactKey(catalogImpacts(before, after, moreVotes, moreDetails)), first);
  after.plans.B.groups.g0.choices.c1.price = "1800";
  assert.notEqual(catalogImpactKey(catalogImpacts(before, after, votes, details)), first);
});
