import { massageStore, restaurantStores, type StoreInfo } from "./store-references";
import { massageReviews, type StoreReviewSnapshot } from "./store-reviews";
import restaurantReviews from "./restaurant-review-snapshots.json";

export type StoreRecord = { info: StoreInfo; reviews?: StoreReviewSnapshot; updatedAt?: number };
export type StoreDirectory = Record<string, StoreRecord>;
const seeds: Record<string, StoreReviewSnapshot> = { ...restaurantReviews, [massageStore.id]: massageReviews };
export const defaultStoreDirectory: StoreDirectory = Object.fromEntries(
  [...restaurantStores, massageStore].map(store => {
    const { id, name, mapsQuery, branch, website, facebook, line } = store;
    const info: StoreInfo = { id, name, mapsQuery };
    for (const [key, value] of Object.entries({ branch, website, facebook, line })) if (value) Object.assign(info, { [key]: value });
    return [id, { info, ...(seeds[id] ? { reviews: seeds[id] } : {}) }];
  }),
);
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown, max: number, empty = false): value is string { return typeof value === "string" && value.length <= max && (empty || value.trim().length > 0); }
export function isSafeStoreUrl(value: unknown): value is string {
  if (!text(value, 2048)) return false;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
function googleUrl(value: unknown, author = false): value is string {
  if (!isSafeStoreUrl(value)) return false;
  const url = new URL(value);
  return ["www.google.com", "maps.google.com"].includes(url.hostname) && (author ? url.pathname.startsWith("/maps/contrib/") : /^\/(search|maps)(\/|$)/.test(url.pathname));
}
export function parseStoreInfo(id: string, value: unknown): StoreInfo | undefined {
  if (!Object.hasOwn(defaultStoreDirectory, id) || !object(value) || value.id !== id || !text(value.name, 120) || !text(value.mapsQuery, 200)) return;
  const info: StoreInfo = { id, name: value.name.trim(), mapsQuery: value.mapsQuery.trim() };
  if (value.branch) { if (!text(value.branch, 80)) return; info.branch = value.branch.trim(); }
  for (const key of ["mapsUrl", "website", "facebook", "line"] as const) {
    if (!value[key]) continue;
    if (!isSafeStoreUrl(value[key])) return;
    info[key] = value[key].trim();
  }
  return info;
}
export function parseReviewSnapshot(value: unknown): StoreReviewSnapshot | undefined {
  if (!object(value) || !text(value.storeName, 160) || typeof value.rating !== "number" || !Number.isFinite(value.rating) || value.rating < 1 || value.rating > 5 || !Number.isSafeInteger(value.reviewCount) || (value.reviewCount as number) < 5 || !text(value.capturedAt, 40) || !Number.isFinite(Date.parse(value.capturedAt)) || !googleUrl(value.sourceUrl) || !Array.isArray(value.reviews) || value.reviews.length !== 5) return;
  const reviews: StoreReviewSnapshot["reviews"] = [];
  for (const row of value.reviews) {
    if (!object(row) || !text(row.author, 160) || !googleUrl(row.authorUrl, true) || !Number.isInteger(row.rating) || (row.rating as number) < 1 || (row.rating as number) > 5 || !text(row.relativeTimeAtCapture, 80) || !text(row.text, 1000, true)) return;
    reviews.push({ author: row.author, authorUrl: row.authorUrl, rating: row.rating as number, relativeTimeAtCapture: row.relativeTimeAtCapture, text: row.text, ...(row.translated === true ? { translated: true } : {}), ...(row.excerpt === true ? { excerpt: true } : {}) });
  }
  if (new Set(reviews.map(row => row.authorUrl)).size !== 5) return;
  return { storeName: value.storeName, rating: value.rating, reviewCount: value.reviewCount as number, capturedAt: value.capturedAt, sourceUrl: value.sourceUrl, reviews };
}
export function parseStoreDirectory(value: unknown): StoreDirectory {
  if (!object(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([id, row]) => {
    if (!object(row)) return [];
    const info = parseStoreInfo(id, row.info);
    if (!info) return [];
    const reviews = parseReviewSnapshot(row.reviews);
    return [[id, { info, ...(reviews ? { reviews } : {}), ...(typeof row.updatedAt === "number" ? { updatedAt: row.updatedAt } : {}) }]];
  }));
}
export function mergeStoreDirectory(stored: StoreDirectory): StoreDirectory {
  return Object.fromEntries(Object.entries(defaultStoreDirectory).map(([id, seed]) => [id, { ...seed, ...stored[id], reviews: stored[id]?.reviews || seed.reviews }]));
}
/** Only fill missing data; importing the bundled snapshot must not undo admin edits. */
export function seedMissingStores(current: unknown) {
  const next: Record<string, unknown> = object(current) ? { ...current } : {};
  for (const [id, seed] of Object.entries(defaultStoreDirectory)) {
    const existing = object(next[id]) ? next[id] : {};
    next[id] = { ...seed, ...existing, info: existing.info || seed.info, ...(existing.reviews || seed.reviews ? { reviews: existing.reviews || seed.reviews } : {}) };
  }
  return next;
}
/** A failed/partial scrape and an older concurrent response must never replace a good snapshot. */
export function nextReviewRecord(current: StoreRecord, candidate: unknown): StoreRecord {
  const reviews = parseReviewSnapshot(candidate);
  if (!reviews) throw new Error("評論資料不完整，已保留上一版。");
  if (current.reviews && Date.parse(current.reviews.capturedAt) >= Date.parse(reviews.capturedAt)) return current;
  return { ...current, reviews };
}
