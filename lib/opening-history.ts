/** Bump the version whenever the trailer changes: a new key means every device counts as not having seen it, so the new
 *  cut plays once for everyone again (the old key is simply left behind). */
const OPENING_VERSION = "mission-score-4";
export const OPENING_SEEN_KEY = "egroup-outing:opening-seen:" + OPENING_VERSION;
type OpeningStorage = Pick<Storage, "getItem" | "setItem">;

/** Browser-local history survives sign-out; memory is a fallback if storage is blocked. */
export function createOpeningHistory(getStorage: () => OpeningStorage | null) {
  let seen = false;
  return {
    hasSeen() {
      try { seen ||= getStorage()?.getItem(OPENING_SEEN_KEY) === "1"; } catch { /* Storage may be unavailable. */ }
      return seen;
    },
    markSeen() {
      seen = true;
      try { getStorage()?.setItem(OPENING_SEEN_KEY, "1"); } catch { /* Keep the current visit usable. */ }
    },
  };
}
export const openingHistory = createOpeningHistory(() => typeof window === "undefined" ? null : window.localStorage);
