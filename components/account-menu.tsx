"use client";
import Link from "next/link";
import LoadingIndicator from "./loading-indicator";
import { useOuting } from "./outing-provider";
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
  const { user, authReady, signingIn, isAdmin, login, logout } = useOuting();
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
        <>
          <Avatar name={user.displayName || "同事"} src={user.photoURL || ""} />
          <span className="account-name">{user.displayName}</span>
          <button className="text-button" onClick={logout}>
            登出
          </button>
        </>
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
