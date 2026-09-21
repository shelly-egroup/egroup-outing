"use client";
import { useEffect, useRef } from "react";
import LoadingIndicator from "./loading-indicator";
export default function LoginDialog({ open, busy, error, onClose, onContinue }: { open: boolean; busy: boolean; error: string; onClose: () => void; onContinue: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, [open]);
  return <dialog ref={dialog} className="confirm-dialog login-dialog" aria-labelledby="login-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="confirm-content">
      <span className="eyebrow">JOIN THE OUTING</span>
      <h2 id="login-title">用公司 Google 帳號加入</h2>
      <p>請選擇 Email 以 <strong>egroup.</strong> 開頭的帳號，登入後就能投票。</p>
      <div className="login-email-example"><span>例如</span><strong>egroup.xxx@gmail.com</strong></div>
      <p className="quiet">其他 Google 帳號也能登入，需經主辦人審核後才能投票。登入後，主辦人可在帳號名單看到你的姓名與 Email。</p>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <div className="confirm-actions">
        <button type="button" className="button button-white" onClick={onClose} disabled={busy}>先看看</button>
        <button type="button" className="button button-dark" onClick={onContinue} disabled={busy}>{busy ? <LoadingIndicator label="登入中" compact /> : "選擇 Google 帳號 →"}</button>
      </div>
    </div>
  </dialog>;
}
