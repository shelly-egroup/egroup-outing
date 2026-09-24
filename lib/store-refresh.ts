export type StoreRefreshResult = { id: string; success: boolean; message: string };
export type StoreRefreshProgress = { currentId?: string; total: number; results: StoreRefreshResult[] };

/** Each request gets its own server time limit. A failed store must not stop the others. */
export async function refreshStoresSequentially(
  ids: string[],
  refresh: (id: string) => Promise<void>,
  report: (progress: StoreRefreshProgress) => void,
  cancelled: () => boolean = () => false,
): Promise<StoreRefreshResult[]> {
  const results: StoreRefreshResult[] = [];
  for (const id of ids) {
    if (cancelled()) break;
    report({ currentId: id, total: ids.length, results: [...results] });
    try {
      await refresh(id);
      results.push({ id, success: true, message: "最新五則評論已擷取並存入資料庫。" });
    } catch (error) {
      results.push({ id, success: false, message: error instanceof Error ? error.message : "擷取失敗，已保留上一版評論。" });
    }
    report({ total: ids.length, results: [...results] });
  }
  return results;
}
