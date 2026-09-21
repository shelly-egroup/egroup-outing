import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const compiled = await readFile(new URL("../.tools/audio-tests/opening-history.js", import.meta.url), "utf8");
const { createOpeningHistory, OPENING_SEEN_KEY, openingHistory } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
function storage() {
  const data = new Map();
  return { data, getItem(key) { return data.get(key) ?? null; }, setItem(key, value) { data.set(key, value); } };
}

test("a new visitor still gets the opening and reading history does not mark it seen", () => {
  const saved = storage(), history = createOpeningHistory(() => saved);
  assert.equal(history.hasSeen(), false);
  assert.equal(history.hasSeen(), false);
  assert.equal(saved.data.size, 0);
});

test("playing or explicitly skipping remembers the opening across fresh page instances", () => {
  const saved = storage(), firstVisit = createOpeningHistory(() => saved);
  saved.setItem("unrelated", "keep");
  firstVisit.markSeen();
  assert.equal(saved.getItem(OPENING_SEEN_KEY), "1");
  const nextVisit = createOpeningHistory(() => saved);
  assert.equal(nextVisit.hasSeen(), true);
  nextVisit.markSeen();
  assert.equal(saved.getItem("unrelated"), "keep");
  assert.equal(saved.data.size, 2);
});

test("seen history does not depend on an authenticated user or session", () => {
  const saved = storage(), signedInVisit = createOpeningHistory(() => saved);
  signedInVisit.markSeen();
  const signedOutVisit = createOpeningHistory(() => saved);
  assert.equal(signedOutVisit.hasSeen(), true);
});

test("blocked browser storage does not crash or replay on later in-app visits", () => {
  const history = createOpeningHistory(() => { throw new Error("SecurityError"); });
  assert.equal(history.hasSeen(), false);
  assert.doesNotThrow(() => history.markSeen());
  assert.equal(history.hasSeen(), true);
  const deniedWrite = createOpeningHistory(() => ({ getItem() { return null; }, setItem() { throw new Error("QuotaExceededError"); } }));
  assert.doesNotThrow(() => deniedWrite.markSeen());
  assert.equal(deniedWrite.hasSeen(), true);
});

test("another tab's seen flag is recognized on the next history check", () => {
  const saved = storage(), first = createOpeningHistory(() => saved), other = createOpeningHistory(() => saved);
  assert.equal(first.hasSeen(), false);
  other.markSeen();
  assert.equal(first.hasSeen(), true);
});

test("server-side history access does not need window or localStorage", () => {
  assert.equal(openingHistory.hasSeen(), false);
});
