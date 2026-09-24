export type HighlightRange = { start: number; end: number };

export function normalizeHighlights(text: string, ranges: readonly HighlightRange[] = []): HighlightRange[] {
  const sorted = (Array.isArray(ranges) ? ranges : []).filter(range => range && Number.isInteger(range.start) && Number.isInteger(range.end))
    .map(({ start, end }) => ({ start: Math.max(0, start), end: Math.min(text.length, end) }))
    .filter(range => range.end > range.start).sort((a, b) => a.start - b.start);
  const merged: HighlightRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

export function isHighlighted(text: string, ranges: readonly HighlightRange[], start: number, end: number) {
  return end > start && normalizeHighlights(text, ranges).some(range => range.start <= start && range.end >= end);
}

export function toggleHighlight(text: string, ranges: readonly HighlightRange[], start: number, end: number) {
  const current = normalizeHighlights(text, ranges);
  const selection = normalizeHighlights(text, [{ start, end }])[0];
  if (!selection) return current;
  if (!isHighlighted(text, current, selection.start, selection.end)) return normalizeHighlights(text, [...current, selection]);
  return current.flatMap(range => {
    if (range.end <= selection.start || range.start >= selection.end) return [range];
    return [
      { start: range.start, end: selection.start },
      { start: selection.end, end: range.end },
    ].filter(part => part.end > part.start);
  });
}

/** Textarea selection offsets use UTF-16, just like String.slice. Keep marks attached to edited text. */
export function remapHighlights(before: string, after: string, ranges: readonly HighlightRange[]) {
  if (before === after) return normalizeHighlights(after, ranges);
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let oldEnd = before.length, newEnd = after.length;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
  const delta = newEnd - oldEnd;
  const mapped = normalizeHighlights(before, ranges).flatMap(range => {
    if (range.end <= start) return [range];
    if (range.start >= oldEnd) return [{ start: range.start + delta, end: range.end + delta }];
    const parts: HighlightRange[] = [];
    if (range.start < start) parts.push({ start: range.start, end: start });
    if (range.end > oldEnd) parts.push({ start: newEnd, end: range.end + delta });
    if (newEnd > start && range.start <= start && range.end >= oldEnd) parts.push({ start, end: newEnd });
    return parts;
  });
  return normalizeHighlights(after, mapped);
}

export function highlightedParts(text: string, ranges: readonly HighlightRange[] = []) {
  const parts: { text: string; highlighted: boolean }[] = [];
  let offset = 0;
  for (const range of normalizeHighlights(text, ranges)) {
    if (range.start > offset) parts.push({ text: text.slice(offset, range.start), highlighted: false });
    parts.push({ text: text.slice(range.start, range.end), highlighted: true });
    offset = range.end;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), highlighted: false });
  return parts;
}
