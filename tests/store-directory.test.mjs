import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const uri = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const compiled = file => readFile(new URL("../.tools/store-tests/" + file, import.meta.url), "utf8");
let source = await compiled("store-directory.js");
for (const name of ["store-references", "store-reviews"]) {
  source = source.replace(JSON.stringify("./" + name), JSON.stringify(uri(await compiled(name + ".js"))));
}
source = source.replace('"./restaurant-review-snapshots.json"', JSON.stringify(uri("export default " + await compiled("restaurant-review-snapshots.json"))));
const { defaultStoreDirectory, parseStoreInfo, parseReviewSnapshot, parseStoreDirectory, mergeStoreDirectory, nextReviewRecord, seedMissingStores } = await import(uri(source));
const record = () => structuredClone(defaultStoreDirectory["hpw-changan"]);
const newer = snapshot => ({ ...structuredClone(snapshot), capturedAt: new Date(Date.parse(snapshot.capturedAt) + 1000).toISOString() });
const { refreshStoresSequentially } = await import(uri(await compiled("store-refresh.js")));
const { reviewTimeFromNow } = await import(uri(await compiled("review-time.js")));

test("bulk refresh waits for each store's save, continues after a failure, and reports truthful counts", async () => {
  const operations = [], progress = [];
  await refreshStoresSequentially(["first", "failed", "last"], async id => {
    operations.push("start:" + id);
    await new Promise(resolve => setImmediate(resolve));
    if (id === "failed") throw new Error("Google 驗證失敗，已保留上一版。");
    operations.push("saved:" + id);
  }, value => progress.push(value));
  assert.deepEqual(operations, ["start:first", "saved:first", "start:failed", "start:last", "saved:last"]);
  assert.deepEqual(progress.at(-1).results.map(row => row.success), [true, false, true]);
  assert.match(progress.at(-1).results[1].message, /Google 驗證/);
  assert.equal(progress[0].results.length, 0);
  assert.equal(progress.at(-1).currentId, undefined);
});

test("stopping a batch finishes the current save and skips every remaining store", async () => {
  let stopped = false;
  const visited = [];
  const result = await refreshStoresSequentially(["first", "second"], async id => {
    visited.push(id); stopped = true;
  }, () => {}, () => stopped);
  assert.deepEqual(visited, ["first"]);
  assert.equal(result.length, 1);
  assert.equal(result[0].success, true);
});

test("review ages advance from capture time to now and preserve edited versus published semantics", () => {
  const capturedAt = "2026-09-24T06:00:00Z", captured = Date.parse(capturedAt), day = 86_400_000;
  assert.equal(reviewTimeFromNow("2 天前", capturedAt, captured + 3 * day), "約 5 天前發表");
  assert.equal(reviewTimeFromNow("14 小時前", capturedAt, captured + day), "約 1 天前發表");
  assert.equal(reviewTimeFromNow("上次編輯：23 小時前", capturedAt, captured + 2 * 3_600_000), "約 1 天前更新");
  assert.equal(reviewTimeFromNow("1 週前", capturedAt, captured + day), "約 8 天前發表");
  assert.equal(reviewTimeFromNow("1 個月前", capturedAt, captured + 30 * day), "約 2 個月前發表");
  assert.equal(reviewTimeFromNow("1 年前", capturedAt, captured + 365 * day), "約 2 年前發表");
  assert.equal(reviewTimeFromNow("剛剛", capturedAt, captured + 120_000), "約 2 分鐘前發表");
  assert.equal(reviewTimeFromNow("unknown", capturedAt, captured), "評論時間未提供");
  assert.equal(reviewTimeFromNow("2 天前", "invalid", captured), "評論時間未提供");
});

test("all seven captured stores have five valid reviews, including rating-only and critical reviews", () => {
  assert.equal(Object.keys(defaultStoreDirectory).length, 7);
  for (const [id, entry] of Object.entries(defaultStoreDirectory)) {
    assert.deepEqual(parseStoreInfo(id, entry.info), entry.info);
    assert.deepEqual(parseReviewSnapshot(entry.reviews), entry.reviews, id);
  }
  assert.equal(record().reviews.reviews.filter(row => !row.text).length, 4);
  assert.ok(defaultStoreDirectory.kitchen12.reviews.reviews.some(row => row.rating === 1));
});

test("partial, duplicate, or malformed captures cannot replace the previous snapshot", () => {
  const current = record(), before = structuredClone(current);
  const mutations = [
    value => value.reviews.pop(),
    value => value.reviews.push(value.reviews[0]),
    value => { value.reviews[1] = value.reviews[0]; },
    value => { value.rating = NaN; },
    value => { value.reviews[0].rating = 0; },
    value => { value.reviews[0].rating = 4.5; },
    value => { value.reviews[0].text = undefined; },
    value => { value.reviews[0].authorUrl = "https://example.com/profile"; },
    value => { value.sourceUrl = "https://www.google.com.evil.test/search"; },
    value => { value.capturedAt = "invalid"; },
  ];
  for (const mutate of mutations) {
    const candidate = newer(current.reviews); mutate(candidate);
    assert.equal(parseReviewSnapshot(candidate), undefined);
    assert.throws(() => nextReviewRecord(current, candidate), /已保留上一版/);
    assert.deepEqual(current, before);
  }
});

test("a complete newer capture replaces reviews without changing edited links", () => {
  const current = record();
  current.info.website = "https://example.com/changed";
  current.info.facebook = "https://www.facebook.com/custom";
  current.info.line = "https://lin.ee/custom";
  const before = structuredClone(current), candidate = newer(current.reviews);
  candidate.rating = 4.2;
  const next = nextReviewRecord(current, candidate);
  assert.deepEqual(next.info, before.info);
  assert.equal(next.reviews.rating, 4.2);
  assert.deepEqual(current, before);
});

test("a slow older response cannot overwrite another admin's newer snapshot", () => {
  const current = record(), latest = nextReviewRecord(current, newer(current.reviews));
  assert.equal(nextReviewRecord(latest, current.reviews), latest);
  assert.equal(nextReviewRecord(latest, latest.reviews), latest);
});

test("import fills missing stores but retains existing links, reviews, and other data", () => {
  const edited = record(); edited.info.name = "主辦已修改的店名";
  delete edited.info.website;
  edited.reviews = newer(edited.reviews);
  const current = { "hpw-changan": edited, "malaya": { info: defaultStoreDirectory.malaya.info }, unknown: { retained: true } };
  const before = structuredClone(current), next = seedMissingStores(current);
  assert.deepEqual(next["hpw-changan"], edited);
  assert.deepEqual(next.malaya.info, current.malaya.info);
  assert.deepEqual(next.malaya.reviews, defaultStoreDirectory.malaya.reviews);
  assert.deepEqual(next.unknown, current.unknown);
  assert.deepEqual(seedMissingStores(next), next);
  assert.deepEqual(current, before);
  assert.deepEqual(seedMissingStores(null), defaultStoreDirectory);
});

test("store settings reject unsafe URLs and unknown IDs; blank optional links remain removed", () => {
  const info = record().info;
  for (const website of ["javascript:alert(1)", "http://example.com", "https://user:pass@example.com", "not a URL"]) {
    assert.equal(parseStoreInfo(info.id, { ...info, website }), undefined);
  }
  assert.equal(parseStoreInfo("unregistered", { ...info, id: "unregistered" }), undefined);
  assert.equal(parseStoreInfo(info.id, { ...info, website: "" }).website, undefined);
});

test("database data wins over bundled defaults and missing/invalid reviews keep a usable fallback", () => {
  const saved = record(); saved.info.website = "https://example.com/saved";
  saved.reviews = newer(saved.reviews);
  const parsed = parseStoreDirectory({ "hpw-changan": saved, malaya: { info: defaultStoreDirectory.malaya.info, reviews: {} } });
  const merged = mergeStoreDirectory(parsed);
  assert.deepEqual(merged["hpw-changan"], saved);
  assert.deepEqual(merged.malaya.reviews, defaultStoreDirectory.malaya.reviews);
  assert.equal(Object.keys(merged).length, 7);
  assert.deepEqual(parseStoreDirectory(null), {});
});
