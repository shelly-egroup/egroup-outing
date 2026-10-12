"use client";
import { useEffect, useRef } from "react";
import LoadingIndicator from "./loading-indicator";
export default function LoginDialog({ open, busy, error, onClose, onContinue }: { open: boolean; busy: boolean; error: string; onClose: () => void; onContinue: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    element.showModal();
    element.focus({ preventScroll: true });
    return () => element.close();
  }, [open]);
  return <dialog ref={dialog} className="confirm-dialog login-dialog" tabIndex={-1} aria-labelledby="login-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <div className="confirm-content">
      <span className="eyebrow">AGENT VERIFICATION</span>
      <h2 id="login-title">出示探員證件</h2>
      <p>請出示總部核發的證件：Email 以 <strong>egroup.</strong> 開頭的 Google 帳號，驗證後就能接受任務。</p>
      <div className="login-email-example"><span>例如</span><strong>egroup.xxx@gmail.com</strong></div>
      <p className="quiet">其他 Google 帳號也能驗證，但要等主辦人審核通過才能接受任務。驗證後，主辦人可在探員名單看到你的姓名與 Email。</p>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <div className="confirm-actions">
        <button type="button" className="button button-white" onClick={onClose} disabled={busy}>先看看</button>
        <button type="button" className="button button-dark" onClick={onContinue} disabled={busy}>{busy ? <LoadingIndicator label="驗證中" compact /> : "出示證件 →"}</button>
      </div>
    </div>
  </dialog>;
}
