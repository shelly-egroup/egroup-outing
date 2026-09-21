import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const compiled = await readFile(new URL("../.tools/vote-tests/trips.js", import.meta.url), "utf8");
const { prepareVoteDetails, voteDraftFromDetails, emptyDraft, getVoteChange } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
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

const savedVote = { planId: "B", preferences: { massage: "gentle" }, note: "按摩輕一點", familyCount: 2, familyNote: "需要兒童椅", updatedAt: 20 };
test("an unchanged saved selection does not enable another submission", () => {
  const draft = voteDraftFromDetails(savedVote);
  assert.equal(getVoteChange(plan, draft, "B", savedVote), "unchanged");
  assert.equal(getVoteChange(plan, { ...draft, note: "  按摩輕一點  ", familyNote: " 需要兒童椅 " }, "B", savedVote), "unchanged");
  assert.equal(getVoteChange(plan, { ...draft, preferences: { removed: "stale", massage: "gentle" } }, "B", savedVote), "unchanged");
});
test("switching camp is a vote change and returning to the saved camp cancels it", () => {
  const draft = voteDraftFromDetails(savedVote);
  assert.equal(getVoteChange(plan, { ...draft, planId: "A" }, "B", savedVote), "switch");
  assert.equal(getVoteChange(plan, draft, "B", savedVote), "unchanged");
});
test("preferences, notes and family changes update details without switching camps", () => {
  const draft = voteDraftFromDetails(savedVote);
  for (const patch of [{ preferences: {} }, { note: "新的備註" }, { familyCount: 3 }, { familyNote: "新的家眷備註" }, { bringingFamily: false }])
    assert.equal(getVoteChange(plan, { ...draft, ...patch }, "B", savedVote), "details");
});
test("solo voters' hidden family fields and preference key order are not changes", () => {
  const withTwoChoices = { groups: { ...plan.groups, lunch: { choices: { a: { label: "餐點" } } } } };
  const saved = { ...savedVote, preferences: { lunch: "a", massage: "gentle" }, familyCount: 0, familyNote: "" };
  const draft = { ...voteDraftFromDetails(saved), familyCount: 3, familyNote: "hidden old value", preferences: { massage: "gentle", lunch: "a" } };
  assert.equal(getVoteChange(withTwoChoices, draft, "B", saved), "unchanged");
});
test("new votes and missing legacy details still allow completing a selection", () => {
  const draft = voteDraftFromDetails(savedVote);
  assert.equal(getVoteChange(plan, draft, null, null), "new");
  assert.equal(getVoteChange(plan, draft, "B", null), "details");
  assert.equal(getVoteChange(plan, { ...draft, familyCount: 0 }, "B", savedVote), "details");
});


const reminderCompiled = await readFile(new URL("../.tools/vote-tests/vote-reminder.js", import.meta.url), "utf8");
const { voteReminder } = await import("data:text/javascript;base64," + Buffer.from(reminderCompiled).toString("base64"));
const walkReminderPlan = { code: "A", shortName: "走讀派", color: "yellow" };
const chillReminderPlan = { code: "B", shortName: "放鬆派", color: "coral" };

test("header keeps the saved B vote while an unsaved A draft is selected", () => {
  const state = voteReminder({ ready: true, hasVoted: true, savedPlan: chillReminderPlan, draftPlan: walkReminderPlan, hasChanges: true });
  assert.equal(state.label, "放鬆派");
  assert.equal(state.code, "B");
  assert.equal(state.tone, "coral");
  assert.equal(state.status, "變更未儲存");
  assert.equal(state.pending, true);
  assert.match(state.message, /已投給 B/);
  assert.match(state.message, /新選擇還沒送出/);
});

test("choosing a plan without submitting is never displayed as a saved vote", () => {
  const state = voteReminder({ ready: true, hasVoted: false, draftPlan: walkReminderPlan, hasChanges: true });
  assert.equal(state.label, "尚未投票");
  assert.equal(state.status, "已選 A・待送出");
  assert.match(state.message, /記得送出/);
  assert.equal(state.target, "#selection");
});

test("saved and loading vote reminders do not show misleading pending changes", () => {
  const saved = voteReminder({ ready: true, hasVoted: true, savedPlan: walkReminderPlan, draftPlan: walkReminderPlan, hasChanges: false });
  assert.equal(saved.label, "走讀派");
  assert.equal(saved.status, "已投票");
  assert.equal(saved.pending, false);
  const loading = voteReminder({ ready: false, hasVoted: false, hasChanges: false });
  assert.equal(loading.label, "同步中");
  assert.equal(loading.pending, false);
  const empty = voteReminder({ ready: true, hasVoted: false, hasChanges: false });
  assert.equal(empty.target, "#plans");
  assert.equal(empty.status, "選個陣營吧");
});

test("editing only meal or family preferences also reminds users to save", () => {
  const state = voteReminder({ ready: true, hasVoted: true, savedPlan: chillReminderPlan, draftPlan: chillReminderPlan, hasChanges: true });
  assert.equal(state.label, "放鬆派");
  assert.equal(state.status, "變更未儲存");
  assert.equal(state.target, "#selection");
});
