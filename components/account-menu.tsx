"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LoadingIndicator from "./loading-indicator";
import { useOuting } from "./outing-provider";
import { votingAccessLabels } from "@/lib/voting-access";
import { initials } from "@/lib/trips";
export function Avatar({ name, src }: { name: string; src: string }) {
  return (
    <span className="avatar" title={name}>
      {src ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <span aria-hidden="true">{initials(name)}</span>
    </span>
  );
}
export default function AccountMenu() {
  const { user, authReady, signingIn, isAdmin, votingAccess, login, logout } = useOuting();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    menu.open = false;
    function outside(event: PointerEvent) { if (event.target instanceof Node && !menu!.contains(event.target)) menu!.open = false; }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && menu!.open) { menu!.open = false; menu!.querySelector("summary")?.focus(); }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [user?.uid]);
  async function signOut() {
    setSigningOut(true); setLogoutError("");
    try { await logout(); } catch { setLogoutError("暫時無法登出，請再試一次。"); }
    finally { setSigningOut(false); }
  }
  return (
    <div className="account-menu">
      {isAdmin && (
        <Link className="button button-white organizer-button" href="/admin">
          主辦入口
        </Link>
      )}
      {!authReady ? (
        <LoadingIndicator label="確認登入中" compact />
      ) : user ? (
        <details className="account-dropdown" ref={menuRef} onBlur={event => {
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) event.currentTarget.open = false;
        }}>
          <summary className="account-trigger" aria-label={(user.displayName || "同事") + "的帳號選單"}>
            <Avatar name={user.displayName || "同事"} src={user.photoURL || ""} />
            <span className="account-name">{user.displayName || "我的帳號"}</span>
            <svg className="account-menu-dots" aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><circle cx="3" cy="9" r="1.5" /><circle cx="9" cy="9" r="1.5" /><circle cx="15" cy="9" r="1.5" /></svg>
          </summary>
          <div className="account-popover">
            <div className="account-profile"><span className="account-role">{isAdmin ? "主辦人" : "秋遊隊友"}</span><strong>{user.displayName || "同事"}</strong><small>{user.email}</small>{votingAccess && !isAdmin && <span className={"account-access status-" + votingAccess}>{votingAccessLabels[votingAccess]}</span>}</div>
            <button type="button" className="account-logout" onClick={signOut} disabled={signingOut}>
              {signingOut ? <LoadingIndicator label="登出中" compact /> : "登出帳號"}
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 4H4v16h5M13 8l4 4-4 4M8 12h13" /></svg>
            </button>
            {logoutError && <p className="account-error" role="alert">{logoutError}</p>}
          </div>
        </details>
      ) : (
        <button
          className="button button-white"
          onClick={login}
          disabled={signingIn}
        >
          {signingIn ? <LoadingIndicator label="登入中" compact /> : "Google 登入"}
        </button>
      )}
    </div>
  );
}
