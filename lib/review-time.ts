const minute = 60_000;
const day = 24 * 60 * minute;

/** Google supplies rounded ages, so advancing them must remain explicitly approximate. */
export function reviewTimeFromNow(original: string, capturedAt: string, now = Date.now()): string {
  const captured = Date.parse(capturedAt);
  if (!Number.isFinite(captured) || !Number.isFinite(now)) return "評論時間未提供";
  const text = original.normalize("NFKC");
  const match = text.match(/(\d+)\s*(分鐘|小時|天|日|週|周|星期|個月|月|年)\s*前/);
  const units: Record<string, number> = { 分鐘: minute, 小時: 60 * minute, 天: day, 日: day, 週: 7 * day, 周: 7 * day, 星期: 7 * day, 個月: 30 * day, 月: 30 * day, 年: 365 * day };
  if (!match && !/剛剛|剛才/.test(text)) return "評論時間未提供";
  const ageAtCapture = match ? Number(match[1]) * units[match[2]] : 0;
  const age = ageAtCapture + Math.max(0, now - captured);
  const label = age < minute ? "剛剛" : age < 60 * minute ? `${Math.floor(age / minute)} 分鐘前` : age < day ? `${Math.floor(age / (60 * minute))} 小時前` : age < 30 * day ? `${Math.floor(age / day)} 天前` : age < 365 * day ? `${Math.floor(age / (30 * day))} 個月前` : `${Math.floor(age / (365 * day))} 年前`;
  return /編輯/.test(text) ? `約 ${label}更新` : `約 ${label}發表`;
}
