import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../.tools/summary-tests/vote-countdown.js", import.meta.url), "utf8");
const { getVoteCountdown } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const deadline = Date.parse("2026-10-14T10:00:00Z");

test("unset or invalid deadlines never display a timer", () => {
  for (const value of [0, -1, NaN, Infinity, Number.MAX_VALUE]) {
    assert.equal(getVoteCountdown(value, deadline, true), null);
  }
  assert.equal(getVoteCountdown(deadline, NaN, true), null);
});

test("countdown carries correctly across day, hour and minute boundaries", () => {
  assert.deepEqual(getVoteCountdown(deadline, deadline - 90_061_000, true), { state: "running", days: 1, hours: 1, minutes: 1, seconds: 1 });
  assert.deepEqual(getVoteCountdown(deadline, deadline - 86_400_001, true), { state: "running", days: 1, hours: 0, minutes: 0, seconds: 1 });
  assert.deepEqual(getVoteCountdown(deadline, deadline - 86_400_000, true), { state: "urgent", days: 1, hours: 0, minutes: 0, seconds: 0 });
  assert.deepEqual(getVoteCountdown(deadline, deadline - 3_599_000, true), { state: "urgent", days: 0, hours: 0, minutes: 59, seconds: 59 });
});

test("the final fraction of a second remains open until the exact deadline", () => {
  assert.deepEqual(getVoteCountdown(deadline, deadline - 1, true), { state: "urgent", days: 0, hours: 0, minutes: 0, seconds: 1 });
  for (const now of [deadline, deadline + 1]) {
    assert.deepEqual(getVoteCountdown(deadline, now, true), { state: "closed", days: 0, hours: 0, minutes: 0, seconds: 0 });
  }
});

test("manual closure stops the timer even before the scheduled deadline", () => {
  assert.equal(getVoteCountdown(deadline, deadline - 3_600_000, false).state, "closed");
  assert.equal(getVoteCountdown(0, deadline, false), null);
});
