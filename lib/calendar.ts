/** Calendar math uses UTC; form values and saved deadlines use Asia/Taipei. */
export function parseCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 1900 || year > 9999) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}
export function calendarDate(date: Date) { return date.toISOString().slice(0, 10); }
export function shiftCalendarDate(value: string, days: number) {
  const date = parseCalendarDate(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + days);
  const next = calendarDate(date);
  return parseCalendarDate(next) ? next : value;
}
export function shiftCalendarMonth(value: string, months: number) {
  const date = parseCalendarDate(value);
  if (!date) return value;
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  const next = calendarDate(target);
  return parseCalendarDate(next) ? next : value;
}
export function calendarDays(month: string) {
  const first = parseCalendarDate(month.slice(0, 7) + "-01");
  if (!first) return [];
  first.setUTCDate(first.getUTCDate() - first.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => calendarDate(new Date(first.getTime() + index * 86400000)));
}
export function taipeiToday(now = Date.now()) { return new Date(now + 8 * 3600000).toISOString().slice(0, 10); }
export function taipeiDeadline(value: string) {
  if (!value) return 0;
  if (!parseCalendarDate(value.slice(0, 10)) || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
  return new Date(value + ":00+08:00").getTime();
}
