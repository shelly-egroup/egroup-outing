export const OPENING_SEEN_KEY = "egroup-outing:opening-seen";
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
