"use client";
import { useEffect, useRef, useState } from "react";
import LoadingIndicator from "./loading-indicator";
import { useOuting } from "./outing-provider";
import { createEmbers, createFilmBurn, type BurnSeed } from "@/lib/film-burn";
import { initials, type PublicVote } from "@/lib/trips";
import { TEAM_LABEL, TEAMS, type Team } from "@/lib/teams";

function Face({ vote, size }: { vote: PublicVote; size?: "lg" }) {
  const [broken, setBroken] = useState(false);
  return <span className={"agent-face" + (size ? " is-" + size : "")} aria-hidden="true">
    {vote.photoURL && !broken ? <img src={vote.photoURL} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} /> : initials(vote.displayName || "特務")}
  </span>;
}

/** A fingerprint, drawn in arcs. */
const PRINT = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true"><path d="M7.2 19.5C5.8 17.7 5 15.4 5 13a7 7 0 0 1 14 0" /><path d="M9.5 21c-1.2-2-1.9-4.4-1.9-7a4.4 4.4 0 0 1 8.8 0c0 1.3-.2 2.6-.5 3.8" /><path d="M12 14c0 2.7.6 5.2 1.7 7.4" /><path d="M17.8 19.6c.4-1.2.6-2.6.6-4" /><path d="M4.6 8.7A9 9 0 0 1 19.4 8.7" /><path d="M7.5 5.2A9.3 9.3 0 0 1 16.5 5.2" /></svg>;

/**
 * The fingerprint scanner. "tap" acts on the click itself (so a sign-in popup is allowed); "hold" wants the print held on
 * the pad until the ring closes — the keyboard (Enter or Space) confirms at once.
 */
function Scanner({ label, sub, mode, busy, disabled, onConfirm }: { label: string; sub?: string; mode: "tap" | "hold"; busy?: boolean; disabled?: boolean; onConfirm: () => void }) {
  const [hold, setHold] = useState(false), [done, setDone] = useState(false), timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const HOLD_MS = 900;
  useEffect(() => () => clearTimeout(timer.current), []);
  const confirm = () => { setDone(true); onConfirm(); setTimeout(() => setDone(false), 1400); };
  const start = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (mode !== "hold" || disabled || busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setHold(true);
    timer.current = setTimeout(() => { setHold(false); confirm(); }, HOLD_MS);
  };
  const stop = () => { if (mode !== "hold") return; clearTimeout(timer.current); setHold(false); };
  return <button type="button" className="scanner" data-mode={mode} data-hold={hold} data-done={done} disabled={disabled || busy} aria-busy={busy}
    onPointerDown={start} onPointerUp={stop} onPointerCancel={stop} onPointerLeave={stop} onContextMenu={event => event.preventDefault()}
    onClick={event => { if (mode === "tap") onConfirm(); else if (event.detail === 0) confirm(); }}>
    <span className="scanner-pad" aria-hidden="true">
      {PRINT}
      <svg className="scanner-ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" pathLength={1} /></svg>
      <i className="scanner-line" />
    </span>
    <span className="scanner-copy">
      <strong>{busy ? <LoadingIndicator label="傳送中" compact /> : done ? "身分確認" : label}</strong>
      {sub && <small>{sub}</small>}
    </span>
  </button>;
}

/** Greeting by the clock, as the tape would. */
const greeting = () => { const h = new Date().getHours(); return h < 11 && h >= 5 ? "早安" : h < 17 && h >= 11 ? "午安" : "晚安"; };
const SEEDS: BurnSeed[] = [{ x: .35, y: .6, delay: 0 }, { x: .82, y: .25, delay: .14 }, { x: .12, y: .2, delay: .26 }];

/**
 * The briefing on the tape: typed line by line when it comes on screen. Once the agent has accepted, it counts down and burns
 * away like the message in the films, leaving one line behind.
 */
function Briefing({ name, destroy, onDestroyed }: { name?: string; destroy: boolean; onDestroyed: () => void }) {
  const box = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDestroyed); done.current = onDestroyed;
  const lines = [
    `${greeting()}，${name ? name + " " : ""}特務。`,
    "你的任務，如果你選擇接受：",
    "10 月 29 日（四）中午 12:00 潛入六度空間 LazerTreks，",
    "與紅藍兩隊展開雷射對戰，戰後撤離至飯店下午茶補給。",
    "一如往常，若你被雷射擊中，主辦單位將否認知情。",
  ];
  const total = lines.join("").length;
  const [typed, setTyped] = useState(0), [run, setRun] = useState(false), [stage, setStage] = useState<"live" | "count" | "burn" | "gone">("live"), [secs, setSecs] = useState(3);
  useEffect(() => {
    const el = box.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setRun(true); setTyped(total); return; }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setRun(true); io.disconnect(); } }, { rootMargin: "0px 0px -15% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [total]);
  useEffect(() => { if (!run || typed >= total) return; const t = setTimeout(() => setTyped(n => n + 1), 38); return () => clearTimeout(t); }, [run, typed, total]);
  // accepted: three seconds, then the tape burns
  useEffect(() => { if (destroy && stage === "live") { setTyped(total); setSecs(3); setStage("count"); } }, [destroy, stage, total]);
  useEffect(() => {
    if (stage !== "count") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStage("gone"); done.current(); return; }
    const t = setTimeout(() => { if (secs > 1) setSecs(s => s - 1); else setStage("burn"); }, 1000);
    return () => clearTimeout(t);
  }, [stage, secs]);
  useEffect(() => {
    if (stage !== "burn") return;
    const c = canvas.current, el = box.current; if (!c || !el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = el.clientWidth, H = el.clientHeight;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const ctx = c.getContext("2d"); if (!ctx) return;
    const burn = createFilmBurn(W, H, SEEDS, 5), fire = createEmbers(W, H), BURN = 2200, t0 = performance.now();
    let frame = 0, last = t0;
    const tick = (now: number) => {
      const t = now - t0, dt = Math.min(.05, (now - last) / 1000); last = now;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
      const front = t < BURN ? burn.draw(ctx, .1 + .3 * t / 1000, { mode: "cover", backing: [11, 12, 15] }, t / 1000) : [];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (t < BURN) fire.spawn(front, 6, .25);
      fire.step(ctx, dt, .12);
      if (t < BURN + 1600 || fire.count) frame = requestAnimationFrame(tick);
      else { setStage("gone"); done.current(); }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stage]);

  let left = typed;
  return <div ref={box} className="tape" data-stage={stage}>
    <p className="sr-only">{lines.join("")}</p>
    {stage !== "gone" ? <div className="tape-lines" aria-hidden="true">
      {lines.map((line, i) => { const shown = line.slice(0, Math.max(0, left)); const caret = left > 0 && left <= line.length && typed < total; left -= line.length;
        return <p key={i} className={"tape-line" + (i === 0 ? " is-greet" : i === 1 ? " is-cue" : "")}>{shown}{caret && <i className="tape-caret" />}</p>; })}
      {stage === "count" && <p className="tape-line is-destruct">本訊息將在 <b key={secs}>{secs}</b> 秒後自動銷毀</p>}
    </div> : <p className="tape-gone">簡報已銷毀・祝任務順利</p>}
    <canvas ref={canvas} className="tape-burn" aria-hidden="true" />
  </div>;
}

/** Everyone who has accepted, as dossier photos — by team once the organisers have drawn them. */
function AgentRoster({ me }: { me?: string }) {
  const { votes, votesReady, votesError, catalogStatus, teams } = useOuting();
  const agents = Object.entries(votes).sort(([, a], [, b]) => (a.updatedAt || 0) - (b.updatedAt || 0));
  const drawn = agents.some(([uid]) => teams[uid]);
  const offline = !votesReady && (catalogStatus === "error" || !!votesError);
  const grid = (rows: [string, PublicVote][]) => <ul className="dossier-grid">
    {rows.map(([uid, vote]) => <li key={uid} className={uid === me ? "is-me" : undefined} data-team={teams[uid] || "open"}>
      <Face vote={vote} /><span>{vote.displayName || "同事"}</span>{uid === me && <b>你</b>}
    </li>)}
  </ul>;
  return <div className="roster" aria-live="polite">
    <p className="roster-head"><span>AGENTS ON MISSION</span><b>{votesReady ? agents.length : "—"}</b><small>位特務已接受任務</small></p>
    {offline ? <p className="roster-offline"><i />特務名單暫時無法連線，恢復後會自動顯示。</p>
      : !votesReady ? <LoadingIndicator label="讀取特務名單" compact />
      : !agents.length ? <p className="roster-empty">還沒有人接受任務，第一位就是你。</p>
      : !drawn ? grid(agents)
      : <div className="roster-teams">
          {TEAMS.map(team => { const rows = agents.filter(([uid]) => teams[uid] === team); return <div key={team} className="roster-team" data-team={team}>
            <p className="roster-team-name"><i />{TEAM_LABEL[team]}<span>{rows.length} 人</span></p>{grid(rows)}
          </div>; })}
          {agents.some(([uid]) => !teams[uid]) && <div className="roster-team" data-team="open"><p className="roster-team-name"><i />待分隊<span>{agents.filter(([uid]) => !teams[uid]).length} 人</span></p>{grid(agents.filter(([uid]) => !teams[uid]))}</div>}
        </div>}
  </div>;
}

/**
 * Accept the mission, Mission: Impossible style: a briefing tape addressed to the agent, a fingerprint scanner to sign in and
 * to accept, the agent's file (note, family), a MISSION ACCEPTED stamp — and the tape burns itself. No vote any more: the
 * trip is set; this is how the people who never voted join, and how everyone keeps their note and family up to date.
 */
export default function MissionAccept() {
  const { user, authReady, profileReady, signingIn, votingAccess, canVote, votes, myDetails, detailsReady, connected, teams, login, logout, acceptMission } = useOuting();
  const mine = user ? votes[user.uid] : undefined;
  const [editing, setEditing] = useState(false), [saving, setSaving] = useState(false), [failed, setFailed] = useState(""), [justAccepted, setJustAccepted] = useState(false), [burnt, setBurnt] = useState(false);
  const [note, setNote] = useState(""), [family, setFamily] = useState(false), [familyCount, setFamilyCount] = useState(1), [familyNote, setFamilyNote] = useState("");
  // the file opens on what was saved before
  useEffect(() => {
    if (!detailsReady) return;
    const count = myDetails?.familyCount || 0;
    setNote(myDetails?.note || ""); setFamily(count > 0); setFamilyCount(Math.max(1, count)); setFamilyNote(count > 0 ? myDetails?.familyNote || "" : "");
  }, [detailsReady, myDetails]);
  useEffect(() => { setEditing(false); setJustAccepted(false); setFailed(""); }, [user?.uid]);
  const countValid = !family || (Number.isSafeInteger(familyCount) && familyCount >= 1 && familyCount <= 20);
  const team: Team | undefined = user ? teams[user.uid] : undefined;
  async function accept() {
    if (saving || !countValid) return;
    setSaving(true); setFailed("");
    try {
      await acceptMission({ note: note.trim(), bringingFamily: family, familyCount: family ? familyCount : 0, familyNote: family ? familyNote.trim() : "" });
      setEditing(false); setJustAccepted(true);
    } catch (error) { setFailed(error instanceof Error ? error.message : "任務登記沒有送出，請稍後再試一次。"); }
    finally { setSaving(false); }
  }

  let panel: React.ReactNode;
  if (!authReady || (user && (!profileReady || !detailsReady))) panel = <LoadingIndicator label="確認特務身分" />;
  else if (!user) panel = <div className="accept-call">
    <Scanner mode="tap" label={signingIn ? "驗證中…" : "驗證身分，接受任務"} sub="以公司 Google 帳號（egroup. 開頭）登入" busy={signingIn} onConfirm={login} />
    <p className="accept-hint">登入後填上注意事項與同行家眷。已經投過票的同事也可以進來更新。</p>
  </div>;
  else if (!canVote) panel = <div className="accept-denied" role="status">
    <span className="ms-label">{votingAccess === "rejected" ? "ACCESS DENIED" : "CLEARANCE PENDING"}</span>
    <strong>{votingAccess === "rejected" ? "這個帳號沒有通過審核" : "等待主辦人確認身分"}</strong>
    <p>{votingAccess === "rejected" ? "請聯絡主辦人，或改用 egroup. 開頭的 Google 帳號。" : "主辦人確認後，這裡會自動開放接受任務。"}</p>
    <button type="button" className="accept-link" onClick={login}>改用公司 Google 帳號 →</button>
  </div>;
  else if (mine && !editing) panel = <div className={"agent-card" + (justAccepted ? " is-new" : "")}>
    <span className="agent-stamp" aria-hidden="true">MISSION ACCEPTED</span>
    <div className="agent-card-head"><Face vote={mine} size="lg" /><span><small>AGENT FILE</small><strong>{mine.displayName || user.displayName || "特務"}</strong><em>STATUS・ACTIVE</em></span></div>
    <dl className="accept-facts">
      <div><dt>隊伍</dt><dd data-team={team}>{team ? TEAM_LABEL[team] : "分隊公布後顯示在這裡"}</dd></div>
      <div><dt>同行</dt><dd>{myDetails?.familyCount ? "帶 " + myDetails.familyCount + " 位家眷" : "單獨行動"}</dd></div>
      <div><dt>備註</dt><dd>{myDetails?.note?.trim() || "無"}</dd></div>
    </dl>
    <p className="accept-actions"><button type="button" className="accept-link" onClick={() => { setEditing(true); setJustAccepted(false); }}>修改任務資料</button><button type="button" className="accept-link is-quiet" onClick={logout}>登出</button></p>
  </div>;
  else panel = <form className="accept-form" onSubmit={event => { event.preventDefault(); void accept(); }}>
    <p className="accept-who"><span className="ms-label">AGENT FILE</span>特務 <strong>{user.displayName || user.email}</strong><button type="button" className="accept-link is-quiet" onClick={logout}>不是你？登出</button></p>
    <label className="accept-field">
      <span>注意事項（選填）<small>健康狀況、飲食需求都可以寫，只有你和主辦看得到。</small></span>
      <textarea rows={2} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} placeholder="例如：膝蓋舊傷、不吃牛" />
    </label>
    <fieldset className="accept-field">
      <legend>行動編制</legend>
      <div className="accept-toggle" role="group">
        <button type="button" aria-pressed={!family} onClick={() => setFamily(false)}>單獨行動</button>
        <button type="button" aria-pressed={family} onClick={() => setFamily(true)}>攜帶家眷</button>
      </div>
      {family && <div className="accept-family">
        <label className="accept-count">家眷人數<span>
          <button type="button" aria-label="減少一位" disabled={familyCount <= 1} onClick={() => setFamilyCount(n => Math.max(1, n - 1))}>−</button>
          <input type="number" inputMode="numeric" min={1} max={20} value={familyCount} aria-invalid={!countValid} onChange={event => setFamilyCount(Number(event.target.value) || 0)} />
          <button type="button" aria-label="增加一位" disabled={familyCount >= 20} onClick={() => setFamilyCount(n => Math.min(20, n + 1))}>＋</button>
        </span><small>不含你自己，共 {countValid ? familyCount + 1 : "?"} 人出發</small></label>
        <label className="accept-field"><span>家眷備註（選填）</span><textarea rows={2} maxLength={1000} value={familyNote} onChange={event => setFamilyNote(event.target.value)} placeholder="例如：小朋友 8 歲、需要兒童椅" /></label>
      </div>}
    </fieldset>
    {failed && <p className="accept-error" role="alert">{failed}</p>}
    <div className="accept-actions">
      <Scanner mode="hold" label={mine ? "按住指紋，更新任務資料" : "按住指紋，接受任務"} sub={!connected ? "連線恢復後才能送出" : "按住直到圓環走完"} busy={saving} disabled={!connected || !countValid} onConfirm={() => void accept()} />
      {mine && <button type="button" className="accept-link is-quiet" onClick={() => setEditing(false)}>取消</button>}
    </div>
  </form>;

  return <div className="accept">
    <div className="dossier">
      <div className="dossier-head"><span>AGENT BRIEFING</span><b>FILE 10.29</b><i className="dossier-classified">機密・TOP SECRET</i></div>
      <Briefing name={user?.displayName || undefined} destroy={justAccepted && !burnt} onDestroyed={() => setBurnt(true)} />
      {panel}
    </div>
    <AgentRoster me={user?.uid} />
  </div>;
}
