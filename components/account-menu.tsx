"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LoadingIndicator from "./loading-indicator";
import AgentHat from "./agent-hat";
import { useOuting } from "./outing-provider";
import { votingAccessLabels } from "@/lib/voting-access";
import { initials } from "@/lib/trips";
/** `hat`: the agent's fedora on top (the photo sits in a wrapper so the hat is not clipped by the round frame). */
export function Avatar({ name, src, hat = false }: { name: string; src: string; hat?: boolean }) {
  if (hat) return <span className="hat-wrap is-round"><Avatar name={name} src={src} /><AgentHat /></span>;
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
/** `organizerInMenu` tucks the organizer link into the account popover, for headers short on room. `agent` dresses it for the
 *  mission page: an agent sign-in with a fingerprint, and — once the mission is accepted — the photo wearing a fedora. */
export default function AccountMenu({ organizerInMenu = false, agent = false }: { organizerInMenu?: boolean; agent?: boolean }) {
  const { user, authReady, signingIn, isAdmin, votingAccess, votes, login, logout } = useOuting();
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
      {isAdmin && !organizerInMenu && (
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
          <summary className="account-trigger" aria-label={(user.displayName || "探員") + "的帳號選單"}>
            <Avatar name={user.displayName || "探員"} src={user.photoURL || ""} hat={agent && !!votes[user.uid]} />
            <span className="account-name">{user.displayName || "我的帳號"}</span>
            <svg className="account-menu-dots" aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><circle cx="3" cy="9" r="1.5" /><circle cx="9" cy="9" r="1.5" /><circle cx="15" cy="9" r="1.5" /></svg>
          </summary>
          <div className="account-popover">
            <div className="account-profile"><span className="account-role">{isAdmin ? "主辦人" : "秋遊探員"}</span><strong>{user.displayName || "探員"}</strong><small>{user.email}</small>{votingAccess && !isAdmin && <span className={"account-access status-" + votingAccess}>{votingAccessLabels[votingAccess]}</span>}</div>
            {isAdmin && organizerInMenu && <Link className="account-organizer" href="/admin">
              主辦後台
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>}
            <button type="button" className="account-logout" onClick={signOut} disabled={signingOut}>
              {signingOut ? <LoadingIndicator label="登出中" compact /> : "登出帳號"}
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 4H4v16h5M13 8l4 4-4 4M8 12h13" /></svg>
            </button>
            {logoutError && <p className="account-error" role="alert">{logoutError}</p>}
          </div>
        </details>
      ) : (
        <button
          className={agent ? "agent-signin" : "button button-white"}
          onClick={login}
          disabled={signingIn}
        >
          {signingIn ? <LoadingIndicator label="登入中" compact /> : agent ? <><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7.2 19.5C5.8 17.7 5 15.4 5 13a7 7 0 0 1 14 0" /><path d="M9.5 21c-1.2-2-1.9-4.4-1.9-7a4.4 4.4 0 0 1 8.8 0c0 1.3-.2 2.6-.5 3.8" /><path d="M12 14c0 2.7.6 5.2 1.7 7.4" /><path d="M4.6 8.7A9 9 0 0 1 19.4 8.7" /></svg><span>探員登入</span></> : "Google 登入"}
        </button>
      )}
    </div>
  );
}
