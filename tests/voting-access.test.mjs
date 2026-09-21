import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const compiled = await readFile(new URL("../.tools/admin-tests/voting-access.js", import.meta.url), "utf8");
const { getVotingAccess, isCompanyAccount, isVotingAllowed } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const review = { email: "guest@gmail.com", status: "approved", reviewedBy: "organizer", reviewedAt: 12 };
test("exact local-part prefix is eligible, with normalized case and whitespace", () => {
  for (const email of ["egroup.shelly@gmail.com", " EGroup.Carol@gmail.com ", "egroup.name@company.test"]) {
    assert.equal(isCompanyAccount(email), true);
    assert.equal(getVotingAccess(email), "automatic");
    assert.equal(isVotingAllowed(getVotingAccess(email)), true);
  }
});
test("similar prefixes, company domains alone and absent emails require review", () => {
  for (const email of ["shelly@egroup.com.tw", "notegroup.shelly@gmail.com", "egroup@gmail.com", "egroup.@gmail.com", "egroup name@gmail.com", "egroup.x", "egroup.x@@gmail.com", "", null, undefined]) {
    assert.equal(isCompanyAccount(email), false);
    assert.equal(getVotingAccess(email), "pending");
    assert.equal(isVotingAllowed(getVotingAccess(email)), false);
  }
});
test("approval and rejection persist when the same account returns", () => {
  assert.equal(getVotingAccess(" GUEST@gmail.com ", review), "approved");
  assert.equal(isVotingAllowed(getVotingAccess("guest@gmail.com", review)), true);
  assert.equal(getVotingAccess("guest@gmail.com", { ...review, status: "rejected" }), "rejected");
  assert.equal(isVotingAllowed("rejected"), false);
});
test("review for a former email cannot authorize a different email", () => {
  assert.equal(getVotingAccess("different@gmail.com", review), "pending");
  assert.equal(getVotingAccess("guest@gmail.com", { ...review, status: "unknown" }), "pending");
  assert.equal(getVotingAccess("guest@gmail.com", { status: "approved" }), "pending");
});
test("company prefix follows the auto-approval policy even with an old review", () => {
  assert.equal(getVotingAccess("egroup.guest@gmail.com", { ...review, status: "rejected" }), "automatic");
});
