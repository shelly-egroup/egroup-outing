export type ScoreValue = { count: number; percent: number };
export function interpolateScore(from: ScoreValue, to: ScoreValue, progress: number): ScoreValue {
  const t = Math.max(0, Math.min(1, progress));
  const eased = 1 - Math.pow(1 - t, 3);
  return {
    count: Math.round(from.count + (to.count - from.count) * eased),
    percent: from.percent + (to.percent - from.percent) * eased,
  };
}
/** Initial loading and scrolling into view are reveals, never new votes. */
export function scoreDelta(previous: number | null, next: number, entering: boolean) {
  return previous === null || entering ? 0 : next - previous;
}
