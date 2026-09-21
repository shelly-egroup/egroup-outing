"use client";
import { useEffect, useRef } from "react";
import type { CatalogImpact } from "@/lib/catalog-impact";
import LoadingIndicator from "./loading-indicator";
export default function CatalogImpactDialog({ open, impacts, busy, error, onClose, onConfirm }: { open: boolean; impacts: CatalogImpact[]; busy: boolean; error: string; onClose: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current!; element.showModal();
    return () => element.close();
  }, [open]);
  const blocked = impacts.some(item => item.removed);
  const peopleCount = new Set(impacts.flatMap(item => item.people.map(person => person.uid))).size;
  return <dialog ref={dialog} className="confirm-dialog catalog-impact-dialog" aria-labelledby="catalog-impact-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="confirm-content"><span className="eyebrow">BEFORE YOU SAVE</span><h2 id="catalog-impact-title">這些選項已有人選擇</h2>
      <p>這次變更會影響 <strong>{peopleCount} 位</strong>隊友。儲存後，他們的投票會直接顯示修改後的內容。</p>
      <p className="catalog-impact-tip">如果是換餐廳、換療程或更改時長，建議保留原選項並新增，讓大家重新選擇。</p>
      <ul className="catalog-impact-list">{impacts.map(item => <li key={item.planId + "/" + item.groupId + "/" + item.choiceId}><small>{item.plan} · {item.group}</small><strong>{item.choice}<span>{item.people.length} 人已選</span></strong>
        {item.removed ? <p className="notice-error">已有投票，無法移除此選項；請返回保留原項目。</p> : <dl>{item.changes.map(change => <div key={change.field}><dt>{change.field}</dt><dd><span>{change.before}</span><b aria-label="改為">→</b><strong>{change.after}</strong></dd></div>)}</dl>}
        <p className="catalog-impact-people">{item.people.map(person => person.name).join("、")}</p>
      </li>)}</ul>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <div className="confirm-actions"><button type="button" className="button button-white" disabled={busy} onClick={onClose}>返回修改</button><button type="button" className="button button-yellow" disabled={busy || blocked} onClick={onConfirm}>{busy ? <LoadingIndicator label="儲存中" compact /> : "確認變更並儲存"}</button></div>
    </div>
  </dialog>;
}
