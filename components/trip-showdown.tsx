"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import AccountMenu from "./account-menu";
import ImageLightbox from "./image-lightbox";
import LiveResults from "./live-results";
import LoadingIndicator from "./loading-indicator";
import VersusBadge from "./versus-badge";
import PlanPicker from "./plan-picker";
import PreferenceGroup from "./preference-group";
import OpeningAnimation from "./opening-animation";
import { useOuting } from "./outing-provider";
import { defaultCatalog } from "@/lib/default-catalog";
import {
  cleanPreferences,
  deadlineLabel,
  emptyDraft,
  voteDraftFromDetails,
  isVotingOpen,
  sortedPlans,
  type VoteDraft,
} from "@/lib/trips";

export default function TripShowdown() {
  const context = useOuting();
  const {
    catalog: remoteCatalog,
    catalogStatus,
    user,
    authReady,
    signingIn,
    myDetails,
    detailsReady,
    votes,
    connected,
    error,
    now,
    login,
    submitVote,
  } = context;
  const catalog = remoteCatalog || defaultCatalog;
  const plans = sortedPlans(catalog).filter(([, plan]) => plan.active);
  const [intro, setIntro] = useState(true);
  const finishIntro = useCallback(() => setIntro(false), []);
  const [draft, setDraft] = useState<VoteDraft>(emptyDraft);
  const [review, setReview] = useState(false),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(""),
    [success, setSuccess] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dirty = useRef(false),
    previousUid = useRef<string | null>(null);
  const planDrafts = useRef<Record<string, Pick<VoteDraft, "preferences" | "note">>>({});
  const selected = catalog.plans[draft.planId];
  const actualVote = user ? votes[user.uid] : null;
  const votingOpen = isVotingOpen(catalog, now);
  const ready = catalogStatus === "ready";

  useEffect(() => {
    if (!authReady) return;
    if (previousUid.current && previousUid.current !== user?.uid) {
      setDraft(emptyDraft);
      dirty.current = false;
      planDrafts.current = {};
      setReview(false);
      setSuccess(false);
    }
    previousUid.current = user?.uid || null;
    if (user && detailsReady && myDetails && !dirty.current) {
      setDraft(voteDraftFromDetails(myDetails));
    }
  }, [user, authReady, myDetails, detailsReady]);
  useEffect(() => {
    if (!review) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
    };
  }, [review]);
  function edit(patch: Partial<VoteDraft>) {
    dirty.current = true;
    setSuccess(false);
    setCopyStatus("");
    setDraft((current) => ({ ...current, ...patch }));
  }
  function choose(id: string, scroll = true) {
    if (id !== draft.planId) {
      if (draft.planId) planDrafts.current[draft.planId] = { preferences: draft.preferences, note: draft.note };
      edit({ planId: id, preferences: planDrafts.current[id]?.preferences || {}, note: planDrafts.current[id]?.note || "" });
    }
    setSaveError("");
    if (scroll) requestAnimationFrame(() =>
      document
        .getElementById("selection")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  const preferences = selected
    ? cleanPreferences(selected, draft.preferences)
    : {};
  const preferenceSummary = selected
    ? Object.entries(selected.groups || {}).map(([id, group]) => ({
        label: group.label,
        value: group.choices[preferences[id]]?.label || "請主辦安排",
      }))
    : [];
  const familyCountValid = !draft.bringingFamily || (Number.isSafeInteger(draft.familyCount) && draft.familyCount > 0);
  const familySummary = draft.bringingFamily ? (familyCountValid ? "帶 " + draft.familyCount + " 位家眷，共 " + (draft.familyCount + 1) + " 人同行" : "請填家眷人數") : "自己參加";
  const planNoteLabel = "備註";
  const summary = [
    "姓名：" + (user?.displayName || ""),
    "主方案：" + (selected?.title || ""),
    ...preferenceSummary.map((item) => item.label + "：" + item.value),
    planNoteLabel + "：" + (draft.note.trim() || "無"),
    "家眷：" + familySummary,
    ...(draft.bringingFamily && draft.familyNote.trim() ? ["家眷備註：" + draft.familyNote.trim()] : []),
  ].join("\n");
  async function save() {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await submitVote(draft);
      dirty.current = false;
      setSuccess(true);
      setReview(false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "投票未完成，請稍後再試。",
      );
    } finally {
      setSaving(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopyStatus("已複製摘要");
    } catch {
      setCopyStatus("無法自動複製，請選取摘要文字複製。");
    }
  }
  return (
    <>
      {intro && (
        <OpeningAnimation
          onFinish={finishIntro}
          plans={[
            plans[0]?.[1].shortName || "走讀派",
            plans[1]?.[1].shortName || "放鬆派",
          ]}
        />
      )}
      <div hidden={intro} className="outing-page">
        <div className="ticker">
          <span>
            10/29 秋季員旅・雙方案對決・你的一票決定全員行程　　10/29
            秋季員旅・雙方案對決・你的一票決定全員行程　　
          </span>
        </div>
        <div className="topbar wrap">
          <Link href="/" className="brand">
            揪是要對決<span>2026</span>
          </Link>
          <AccountMenu />
        </div>
        <header className="outing-hero wrap">
          <div className="hero-copy">
            <span className="eyebrow">THE AUTUMN SHOWDOWN</span>
            <p className="event-meta">
              {catalog.settings.eventDate.replaceAll("-", ".")} · 預計{" "}
              {catalog.settings.expectedVoters} 人
            </p>
            <h1>
              秋遊去哪？
              <br />
              <em>揪 差你一票</em>
            </h1>
            <p>
              走讀老街，還是好好放鬆？
              <br />
              看完行程，選一個你最想去的方案。
            </p>
            <p className="hero-joke"><span>這次不吃</span> 牛肉麵！</p>
            <div className="hero-actions">
              <a href="#plans" className="button button-dark">
                看方案，選陣營
              </a>
              <button className="button button-white" onClick={() => setIntro(true)}>
                重播開場
              </button>
              <a href="#results" className="button button-white">看即時戰況</a>
            </div>
          </div>
          <div className="hero-art">
            <img
              src="/assets/jo-showdown-hero-v3.png"
              alt="揪是要對決：大稻埕走讀與按摩下午茶"
            />
            <div className="hero-art-badge">
              秋遊
              <br />
              <b>對決中</b>
            </div>
            <div className="hero-art-caption">
              {plans.map(([, plan]) => plan.shortName).join("  VS  ")}
            </div>
          </div>
        </header>
        <main className="wrap">
          <ol className="journey" aria-label="投票步驟">
            <li className="current">
              <b>01</b> 看方案
            </li>
            <li className={draft.planId ? "current" : ""}>
              <b>02</b> 選偏好
            </li>
            <li className={actualVote ? "current" : ""}>
              <b>03</b> 登入投票
            </li>
          </ol>
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          {!ready && (
            <div className="notice" role="status">
              {catalogStatus === "loading"
                ? <LoadingIndicator label="正在載入最新方案" compact />
                : catalogStatus === "error"
                  ? "目前無法連上投票服務。你可以先看行程，稍後再試。"
                  : "主辦人正在準備投票，先看看這次的行程。"}
              {context.isAdmin && <Link href="/admin" className="button button-white organizer-button">主辦入口</Link>}
            </div>
          )}
          {ready && !votingOpen && (
            <p className="notice">本次投票已截止，可以查看方案與最終戰況。</p>
          )}
          <section id="plans" className="plans-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">CHOOSE YOUR SIDE</span>
                <h2>你是哪一派？</h2>
              </div>
              <p>
                {catalog.settings.closesAt
                  ? deadlineLabel(catalog.settings.closesAt) + " 截止"
                  : "每人一票，截止前都能改票"}
              </p>
            </div>
            <div className="plan-grid" data-duel={plans.length === 2}>
              {plans.length === 2 && <VersusBadge />}
              {plans.map(([id, plan]) => (
                <article
                  key={id}
                  className={
                    "plan-card tone-" +
                    plan.color +
                    (draft.planId === id ? " is-selected" : "")
                  }
                >
                  <div className="plan-card-top">
                    <span className="plan-code" aria-hidden="true">{plan.code}</span>
                    <span className="eyebrow">{plan.category}</span>
                    {actualVote?.planId === id && (
                      <span className="your-vote">你的這一票 ✓</span>
                    )}
                  </div>
                  <h3>{(plan.title === "大稻埕人文慢旅" ? ["大稻埕", "人文慢旅"] : plan.title.includes("＋") ? [plan.title.slice(0, plan.title.indexOf("＋")), plan.title.slice(plan.title.indexOf("＋"))] : [plan.title]).map((line, index) => <span key={index}>{line}</span>)}</h3>
                  <p className="plan-description">{plan.description}</p>
                  <div className="pill-row">
                    {(plan.tags || []).map((tag) => (
                      <span key={tag} className="pill">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="plan-itinerary" aria-label={plan.shortName + "完整行程"}>
                    <ol>
                      {(plan.schedule || []).map((stop, index) => (
                        <li key={index}>
                          <time>{stop.time}</time>
                          <div>
                            <strong>{stop.title}</strong>
                            <p>{stop.description}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <p className="compare-price">{plan.priceNote}</p>
                  <button
                    className={"button choose-button " + (plan.color === "yellow" || draft.planId === id ? "button-dark" : "button-white")}
                    disabled={saving}
                    aria-pressed={draft.planId === id}
                    onClick={() => choose(id)}
                  >
                    {draft.planId === id
                      ? "已選擇 " + plan.shortName + " ✓"
                      : "我偏好" + plan.shortName}
                  </button>
                </article>
              ))}
            </div>
            {plans.length === 0 && (
              <p className="state-box">目前沒有開放中的方案。</p>
            )}
          </section>
          <section id="selection" className="selection-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">MAKE IT YOUR TRIP</span>
                <h2>{success ? "你的一票，已收到！" : "選好偏好，再投一票"}</h2>
              </div>
              {selected && (
                <button
                  className="button button-white"
                  onClick={() =>
                    document
                      .getElementById("plans")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  比較完整行程
                </button>
              )}
            </div>
            <PlanPicker plans={plans} selectedId={draft.planId} disabled={saving || intro} onChoose={id => choose(id, false)} />
            <div id="selection-content">
            {!selected ? (
              <p className="selection-hint">選好陣營，就能接著挑午餐、按摩或下午茶。先選偏好，最後再登入投票。</p>
            ) : (
              <div className="selection-layout" data-team-tone={selected.color}>
                <div className="preference-panel">
                  <div className={"selected-banner tone-" + selected.color}>
                    <span>
                      {selected.code} · {selected.shortName}
                    </span>
                    <h3>{selected.title}</h3>
                  </div>
                  {Object.entries(selected.groups || {}).map(([groupId, group]) => (
                    <PreferenceGroup key={draft.planId + ":" + groupId} groupId={groupId} group={group}
                      selectedId={preferences[groupId] || ""} disabled={saving || !selected.active || !votingOpen || intro}
                      onChoose={choiceId => {
                        const next = { ...draft.preferences };
                        if (choiceId) next[groupId] = choiceId; else delete next[groupId];
                        edit({ preferences: next });
                      }} />
                  ))}
                  {draft.planId === "B" && (
                    <details className="menu-details">
                      <summary>看完整店家價目表（點圖可放大）</summary>
                      <div className="menu-images">
                        <ImageLightbox
                          src="/assets/massage-menu-1.jpg"
                          alt="不老松腳底按摩與全身指壓價目表"
                        />
                        <ImageLightbox
                          src="/assets/massage-menu-2.jpg"
                          alt="不老松筋膜刀與養身套餐價目表"
                        />
                      </div>
                    </details>
                  )}
                  <label className="note-field">
                    {planNoteLabel}（選填）
                    <small>沒有特別需求可以留白，只有你與主辦人看得到。</small>
                    <textarea
                      maxLength={1000}
                      rows={3}
                      value={draft.note}
                      disabled={saving || !votingOpen}
                      placeholder={draft.planId === "B" ? "例如：按摩力道輕一點、需避開肩頸，或其他需要協助的事…" : "例如：素食、不吃牛肉、走路需要多休息、手作注意事項…"}
                      onChange={(event) => edit({ note: event.target.value })}
                    />
                    <span>{draft.note.length} / 1000</span>
                  </label>
                  <fieldset className="family-fieldset" disabled={saving || !votingOpen}>
                    <legend>會帶家眷一起來嗎？</legend>
                    <p className="quiet">一起安排座位和餐點，填家眷人數就好，不包含你自己。</p>
                    <div className="family-toggle">
                      <label className={"preference-choice" + (!draft.bringingFamily ? " checked" : "")}><input type="radio" name="bringing-family" checked={!draft.bringingFamily} onChange={() => edit({ bringingFamily: false })} /><span>自己參加</span></label>
                      <label className={"preference-choice" + (draft.bringingFamily ? " checked" : "")}><input type="radio" name="bringing-family" checked={draft.bringingFamily} onChange={() => edit({ bringingFamily: true, familyCount: Math.max(1, draft.familyCount) })} /><span>帶家眷一起</span></label>
                    </div>
                    {draft.bringingFamily && <div className="family-fields">
                      <label className="family-count-label" htmlFor="family-count">家眷總人數<span className="family-count-input"><input id="family-count" type="number" min={1} step={1} inputMode="numeric" required value={draft.familyCount || ""} aria-invalid={!familyCountValid} aria-describedby="family-count-help" onChange={event => edit({ familyCount: Number(event.target.value) || 0 })} /><span>位</span></span></label>
                      <p id="family-count-help" className={familyCountValid ? "quiet" : "notice-error"}>{familyCountValid ? "加上你，這次共 " + (draft.familyCount + 1) + " 人一起出發。" : "請填至少 1 位，不包含你自己。"}</p>
                      <label className="note-field family-note">家眷備註（選填）<small>例如小朋友同行、兒童椅、餐點或行動需求，只給你與主辦看。</small><textarea maxLength={1000} rows={3} value={draft.familyNote} placeholder="有什麼需要主辦幫忙安排的，都可以寫在這裡。" onChange={event => edit({ familyNote: event.target.value })} /><span>{draft.familyNote.length} / 1000</span></label>
                    </div>}
                  </fieldset>
                </div>
                <aside className="vote-review" aria-label="投票摘要">
                  <span className="eyebrow">YOUR VOTE</span>
                  <h3>{actualVote ? "你的選擇" : "準備好站這一邊？"}</h3>
                  <div className="review-plan"><span className="team-label">{selected.code} · {selected.shortName}</span><strong>{selected.title}</strong></div>
                  <dl>
                    {preferenceSummary.map((item) => (
                      <div key={item.label}>
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                    {draft.note.trim() && <div><dt>{planNoteLabel}</dt><dd className="private-note-text">{draft.note}</dd></div>}
                    <div><dt>同行安排</dt><dd>{familySummary}</dd></div>
                    {draft.bringingFamily && draft.familyNote.trim() && <div><dt>家眷備註</dt><dd className="private-note-text">{draft.familyNote}</dd></div>}
                  </dl>
                  {actualVote && (
                    <p className="saved-vote">
                      已投給：
                      {catalog.plans[actualVote.planId]?.title || "已下架方案"}
                    </p>
                  )}
                  {success && (
                    <p role="status" className="success-message">
                      ✓ 投票已成功儲存，戰況同步更新。
                    </p>
                  )}
                  {saveError && !review && (
                    <p className="notice-error" role="alert">
                      {saveError}
                    </p>
                  )}
                  {!selected.active ? (
                    <p>這個方案已下架，請回上方選擇其他方案。</p>
                  ) : !votingOpen ? (
                    <p className="closed-label">投票已截止</p>
                  ) : !authReady ? (
                    <LoadingIndicator label="確認登入狀態中" />
                  ) : !user ? (
                    <>
                      <button
                        className="button button-dark"
                        disabled={signingIn}
                        onClick={login}
                      >
                        {signingIn ? <LoadingIndicator label="正在登入" compact /> : "Google 登入，繼續投票"}
                      </button>
                      <p className="quiet">
                        登入後再確認送出，剛才的選擇會保留。
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="signed-as">
                        以 {user.displayName || user.email} 投票
                      </p>
                      <button
                        className="button button-dark"
                        disabled={
                          saving || !connected || !ready || !detailsReady || !familyCountValid
                        }
                        onClick={() => {
                          setSaveError("");
                          setReview(true);
                        }}
                      >
                        {saving
                          ? <LoadingIndicator label="儲存中" compact />
                          : actualVote
                            ? "確認改票"
                            : "確認並投票"}
                      </button>
                      <p className="quiet">
                        {!connected
                          ? "連線恢復後才能送出。"
                          : "截止前可修改，每個 Google 帳號只計一票。"}
                      </p>
                    </>
                  )}
                  {success && (
                    <>
                      <button className="text-button" onClick={copy}>
                        複製我的選擇
                      </button>
                      <span className="quiet" role="status">
                        {copyStatus}
                      </span>
                    </>
                  )}
                  <p className="privacy-note">
                    送出後，姓名、Google 頭像與所選方案會顯示於公開戰況；備註與家眷資料只顯示給你與主辦人。
                  </p>
                </aside>
              </div>
            )}
            </div>
          </section>
          <LiveResults catalog={catalog} motionEnabled={!intro} />
        </main>
        <footer className="site-footer">
          <div className="wrap">
            <span>{catalog.settings.title} · 兩個方案皆自行前往</span>
            {context.isAdmin && <Link className="button button-white organizer-button" href="/admin">主辦入口</Link>}
          </div>
        </footer>
      </div>
      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        data-team-tone={selected?.color}
        aria-labelledby="confirm-vote-title"
        onCancel={(event) => {
          if (saving) event.preventDefault();
          else setReview(false);
        }}
        onClose={() => {
          if (!saving) setReview(false);
        }}
      >
        <div className="confirm-content">
          <span className="eyebrow">ONE LAST LOOK</span>
          <h2 id="confirm-vote-title">
            {actualVote ? "確認更新這一票？" : "這一票，就投這裡！"}
          </h2>
          <p>{user?.displayName} 的選擇</p>
          <div className="confirm-plan"><span className="team-label">{selected?.code} · {selected?.shortName}</span><strong>{selected?.title}</strong></div>
          <dl>
            {preferenceSummary.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
            <div><dt>同行安排</dt><dd>{familySummary}</dd></div>
            {draft.bringingFamily && draft.familyNote.trim() && <div><dt>家眷備註</dt><dd className="private-note-text">{draft.familyNote}</dd></div>}
          </dl>
          {draft.note && <p className="confirm-note">{planNoteLabel}：{draft.note}</p>}
          <p className="quiet">截止前可以改票；更新後仍只計一票。</p>
          {saveError && (
            <p className="notice-error" role="alert">
              {saveError}
            </p>
          )}
          <div className="confirm-actions">
            <button
              className="button button-white"
              disabled={saving}
              onClick={() => setReview(false)}
            >
              返回修改
            </button>
            <button
              className="button button-dark"
              disabled={saving || !votingOpen || !connected || !familyCountValid}
              onClick={save}
            >
              {saving ? <LoadingIndicator label="正在儲存" compact /> : !votingOpen ? "投票已截止" : "確定送出 ✓"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
