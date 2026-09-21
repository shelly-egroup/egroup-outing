import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const compiled = await readFile(new URL("../.tools/vote-tests/trips.js", import.meta.url), "utf8");
const { prepareVoteDetails, voteDraftFromDetails, emptyDraft } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const plan = { groups: { massage: { choices: { gentle: { label: "輕柔按摩" } } } } };

test("legacy votes load without inventing family members", () => {
  const draft = voteDraftFromDetails({ planId: "A", note: "不吃牛", updatedAt: 10 });
  assert.equal(draft.bringingFamily, false);
  assert.equal(draft.familyCount, 0);
  assert.equal(draft.familyNote, "");
  assert.deepEqual(draft.preferences, {});
  assert.equal(draft.note, "不吃牛");
});

test("family details survive save and reload with the selected plan", () => {
  const input = { ...emptyDraft, planId: "B", note: "  按摩輕一點  ", bringingFamily: true, familyCount: 3, familyNote: "  需要兒童椅  ", preferences: { massage: "gentle", removed: "unknown" } };
  const details = prepareVoteDetails(plan, input);
  assert.deepEqual(details, { planId: "B", note: "按摩輕一點", preferences: { massage: "gentle" }, familyCount: 3, familyNote: "需要兒童椅" });
  const restored = voteDraftFromDetails({ ...details, updatedAt: 20 });
  assert.equal(restored.bringingFamily, true);
  assert.equal(restored.familyCount, 3);
  assert.equal(restored.familyNote, "需要兒童椅");
  assert.equal(restored.planId, "B");
});

test("choosing solo removes stale hidden family details from the saved payload", () => {
  const details = prepareVoteDetails(plan, { ...emptyDraft, planId: "A", bringingFamily: false, familyCount: 4, familyNote: "previous family needs" });
  assert.equal(details.familyCount, 0);
  assert.equal(details.familyNote, "");
});

test("family count requires a positive whole number when bringing family", () => {
  for (const count of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => prepareVoteDetails(plan, { ...emptyDraft, bringingFamily: true, familyCount: count }), /家眷總人數/);
  }
});

test("plan and family note length are checked independently", () => {
  assert.throws(() => prepareVoteDetails(plan, { ...emptyDraft, note: "字".repeat(1001) }), /方案備註/);
  assert.throws(() => prepareVoteDetails(plan, { ...emptyDraft, bringingFamily: true, familyCount: 1, familyNote: "字".repeat(1001) }), /家眷備註/);
  assert.doesNotThrow(() => prepareVoteDetails(plan, { ...emptyDraft, bringingFamily: true, familyCount: 1, note: "字".repeat(1000), familyNote: "字".repeat(1000) }));
});

test("malformed historical family counts do not become real attendees", () => {
  for (const count of [-3, 1.5, NaN, Infinity]) {
    const draft = voteDraftFromDetails({ planId: "B", note: "", familyCount: count, familyNote: "stale", updatedAt: 20 });
    assert.equal(draft.bringingFamily, false);
    assert.equal(draft.familyCount, 0);
    assert.equal(draft.familyNote, "");
  }
});
