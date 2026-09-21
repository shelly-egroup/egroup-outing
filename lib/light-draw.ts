export type DrawBeat = { id: string; at: number };

/** Rejection sampling keeps every choice equally likely, including groups of 3/5/etc. */
export function randomChoiceIndex(count: number, sample = () => crypto.getRandomValues(new Uint32Array(1))[0]) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 4294967296) throw new Error("Invalid choice count");
  const limit = 4294967296 - (4294967296 % count);
  let value: number;
  do { value = sample(); } while (value >= limit);
  return value % count;
}

/** A precomputed decreasing tempo: both sound and highlight consume these exact beats. */
export function createDrawTimeline(ids: string[], selectedId: string, winner: number): DrawBeat[] {
  if (!ids.length || winner < 0 || winner >= ids.length || !Number.isInteger(winner)) throw new Error("Invalid draw");
  if (ids.length === 1) return [{ id: ids[0], at: 0 }];
  const start = Math.max(0, ids.indexOf(selectedId));
  const minimum = Math.max(14, ids.length * 2);
  const turns = minimum + ((winner - start - minimum) % ids.length + ids.length) % ids.length;
  const weights = Array.from({ length: turns }, (_, index) => 85 + 580 * Math.pow(index / turns, 3));
  const duration = Math.min(5.2, 3.4 + (ids.length - 2) * .09);
  const unit = duration / weights.reduce((sum, weight) => sum + weight, 0);
  let time = 0;
  const beats: DrawBeat[] = [{ id: ids[start], at: 0 }];
  for (let step = 1; step <= turns; step++) {
    time += weights[step - 1] * unit;
    beats.push({ id: ids[(start + step) % ids.length], at: step === turns ? duration : time });
  }
  return beats;
}
