import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../.tools/summary-tests/trips.js", import.meta.url), "utf8");
const { isAcceptOpen } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const deadline = Date.parse("2026-10-27T10:00:00Z");
const catalog = (acceptClosesAt) => ({ settings: { title: "秋遊", eventDate: "2026-10-29", expectedVoters: 12, votingOpen: true, closesAt: 0, acceptClosesAt }, plans: {}, updatedAt: 1 });

test("no deadline, or an unset one, never closes accepting", () => {
  for (const value of [undefined, 0, -1, NaN]) assert.equal(isAcceptOpen(catalog(value), deadline + 86_400_000), true);
});

test("accepting stays open until the exact deadline and closes from it", () => {
  assert.equal(isAcceptOpen(catalog(deadline), deadline - 1), true);
  assert.equal(isAcceptOpen(catalog(deadline), deadline), false);
  assert.equal(isAcceptOpen(catalog(deadline), deadline + 60_000), false);
});
