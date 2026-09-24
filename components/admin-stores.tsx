"use client";
import { useEffect, useRef, useState } from "react";
import { useOuting } from "./outing-provider";
import StoreReviews from "./store-reviews";
import StoreLinks from "./store-links";
import type { StoreRecord } from "@/lib/store-directory";
import type { StoreInfo } from "@/lib/store-references";
import { refreshStoresSequentially, type StoreRefreshProgress, type StoreRefreshResult } from "@/lib/store-refresh";

function StoreEditor({ record, saved, busy, result, refreshing, run }: { record: StoreRecord; saved: boolean; busy: string; result?: StoreRefreshResult; refreshing: boolean; run: (key: string, action: () => Promise<void>, success: string) => Promise<void> }) {
  const { saveStore, refreshStoreReviews } = useOuting();
  const [draft, setDraft] = useState(record.info);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setDraft(record.info); }, [record.info, dirty]);
  function edit(key: keyof StoreInfo, value: string) { setDraft(previous => ({ ...previous, [key]: value })); setDirty(true); }
  return <details className="admin-store-card">
    <summary><strong>{record.info.name}</strong><span>{saved ? "已存資料庫" : "等待自動同步"}{dirty && "・連結未儲存"}</span>{(refreshing || result) && <span className={"store-refresh-state" + (refreshing ? "" : result?.success ? " is-success" : " is-failed")}>{refreshing ? "擷取中…" : result?.success ? "更新成功" : "更新未完成・保留原資料"}</span>}</summary>
    <div className="admin-store-body">
      <StoreLinks store={record.info} />
      {record.reviews && <StoreReviews snapshot={record.reviews} tone={["hpw-changan", "malaya", "rice-dihua"].includes(record.info.id) ? "yellow" : "coral"} />}
      <form onSubmit={event => { event.preventDefault(); void run(draft.id + ":save", async () => { await saveStore(draft); setDirty(false); }, "店家連結已儲存，評論保持原樣。"); }}>
        <fieldset disabled={!!busy} className="admin-store-fields">
          <label>店家名稱<input required maxLength={120} value={draft.name} onChange={e => edit("name", e.target.value)} /></label>
          <label>分店標示<input maxLength={80} value={draft.branch || ""} onChange={e => edit("branch", e.target.value)} /></label>
          <label>地圖搜尋名稱<input required maxLength={200} value={draft.mapsQuery} onChange={e => edit("mapsQuery", e.target.value)} /></label>
          {([['mapsUrl', '地圖連結（選填，留白時使用搜尋名稱）'], ['website', '官方網站'], ['facebook', 'Facebook'], ['line', 'LINE']] as const).map(([key, label]) => <label key={key}>{label}<input type="url" pattern="https://.*" placeholder="https://" maxLength={2048} value={draft[key] || ""} onChange={e => edit(key, e.target.value)} /></label>)}
        </fieldset>
        <div className="admin-store-actions"><button type="submit" className="button button-white" disabled={!!busy}>{busy === draft.id + ":save" ? "儲存中…" : "儲存店家連結"}</button><button type="button" className="button button-yellow" disabled={!!busy} onClick={() => void run(draft.id + ":refresh", () => refreshStoreReviews(draft.id), "最新五則評論已擷取並存入資料庫。")}>
          {busy === draft.id + ":refresh" ? "擷取中，請稍候…" : "重新擷取評論"}
        </button></div>
      </form>
      {(refreshing || result) && <p className={"store-refresh-message" + (!refreshing && result?.success ? " is-success" : !refreshing ? " is-failed" : "")} role="status">{refreshing ? "正在取得最新五則評論，請稍候…" : result?.message}</p>}
      <p className="quiet">只在成功取得完整評分與五則評論後更新。失敗時保留上一版，店家連結不受影響。</p>
    </div>
  </details>;
}
export default function AdminStores() {
  const { stores, storedStores, storesError, storesReady, seedStores, refreshStoreReviews, connected, isAdmin } = useOuting();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState<StoreRefreshProgress | null>(null);
  const [results, setResults] = useState<Record<string, StoreRefreshResult>>({});
  const [stopping, setStopping] = useState(false);
  const [seedFailed, setSeedFailed] = useState(false);
  const active = useRef(false);
  const stop = useRef(false);
  const importAttempted = useRef(false);
  useEffect(() => () => { stop.current = true; }, []);
  useEffect(() => {
    if (!isAdmin || !connected || !storesReady || busy || active.current || importAttempted.current) return;
    importAttempted.current = true;
    if (Object.keys(stores).some(id => !storedStores[id]?.reviews)) {
      void run("seed", seedStores, "已將先前取得的店家資料自動存入 Firebase，既有資料已保留。");
    }
  }, [isAdmin, connected, storesReady, busy, stores, storedStores, seedStores]);
  async function run(key: string, action: () => Promise<void>, success: string) {
    if (active.current) return;
    active.current = true;
    setBusy(key); setMessage(""); setFailed(false);
    if (key === "seed") setSeedFailed(false);
    const id = key.endsWith(":refresh") ? key.slice(0, -8) : undefined;
    if (id) { setProgress(null); setResults(previous => { const next = { ...previous }; delete next[id]; return next; }); }
    try {
      await action(); setMessage(success);
      if (id) setResults(previous => ({ ...previous, [id]: { id, success: true, message: success } }));
    } catch (error) {
      const explanation = error instanceof Error ? error.message : "操作失敗，原有資料保持不變。";
      setFailed(true); setMessage(explanation);
      if (key === "seed") setSeedFailed(true);
      if (id) setResults(previous => ({ ...previous, [id]: { id, success: false, message: explanation } }));
    } finally { setBusy(""); active.current = false; }
  }
  async function refreshAll() {
    if (active.current) return;
    active.current = true; stop.current = false;
    setBusy("all"); setMessage(""); setFailed(false); setResults({}); setStopping(false);
    const ids = Object.keys(stores);
    setProgress({ total: ids.length, results: [] });
    try {
      const finished = await refreshStoresSequentially(ids, refreshStoreReviews, next => {
        setProgress(next);
        setResults(Object.fromEntries(next.results.map(result => [result.id, result])));
      }, () => stop.current);
      const succeeded = finished.filter(result => result.success).length;
      const failures = finished.length - succeeded;
      const skipped = ids.length - finished.length;
      setFailed(failures > 0);
      setMessage(`${skipped ? "已停止後續擷取" : "全部處理完成"}：成功 ${succeeded} 家、失敗 ${failures} 家${skipped ? `、未處理 ${skipped} 家` : ""}。${failures ? "未更新的店家保留原資料，原因列在各店下方。" : ""}`);
    } finally { setBusy(""); active.current = false; }
  }
  return <section className="admin-store-section" aria-label="店家與評論管理">
    <div className="section-heading"><div><h2>店家連結與 Google 評論</h2><p className="quiet">{Object.values(storedStores).filter(record => record.reviews).length} / {Object.keys(stores).length} 家店的評論已存入資料庫。成功擷取後會自動儲存。</p></div></div>
    <div className="admin-store-toolbar">
      <div><button type="button" className="button button-yellow" disabled={!!busy || !connected} onClick={() => void refreshAll()}>{busy === "all" ? "全部擷取中…" : "全部重新擷取評論"}</button><p>逐家抓取最新五則並儲存；失敗的店保留上一版。</p></div>
    </div>
    {busy === "seed" && <p className="notice" role="status">正在將先前取得的店家資料自動存入 Firebase…</p>}
    {seedFailed && <button type="button" className="button button-white" disabled={!!busy || !connected} onClick={() => void run("seed", seedStores, "店家資料已成功同步至 Firebase，既有資料已保留。")}>重試資料庫同步</button>}
    {progress && <div className="admin-store-progress"><div role="status"><strong>{progress.currentId ? `正在擷取 ${stores[progress.currentId].info.name}（第 ${progress.results.length + 1} / ${progress.total} 家）` : `已處理 ${progress.results.length} / ${progress.total} 家`}</strong><span>成功 {progress.results.filter(result => result.success).length} 家・失敗 {progress.results.filter(result => !result.success).length} 家</span></div><progress max={progress.total} value={progress.results.length} aria-label="全部評論擷取進度" />{busy === "all" && <button type="button" className="button button-white" disabled={stopping} onClick={() => { stop.current = true; setStopping(true); }}>{stopping ? "這家完成後停止" : "停止後續擷取"}</button>}</div>}
    {storesError && <p className="notice notice-error" role="alert">{storesError}</p>}
    {message && <p className={"notice" + (failed ? " notice-error" : "")} role={failed ? "alert" : "status"}>{message}</p>}
    {Object.entries(stores).map(([id, record]) => <StoreEditor key={id} record={record} saved={!!storedStores[id]} busy={busy || (!connected ? "offline" : "")} result={results[id]} refreshing={busy === id + ":refresh" || (busy === "all" && progress?.currentId === id)} run={run} />)}
  </section>;
}
