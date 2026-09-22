"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import AccountMenu from "./account-menu";
import LoadingIndicator from "./loading-indicator";
import LoadingPanel from "./loading-panel";
import CatalogImpactDialog from "./catalog-impact-dialog";
import { catalogImpacts, catalogImpactKey, choiceSelectionCounts } from "@/lib/catalog-impact";
import AdminPlanEditor from "./admin-plan-editor";
import AdminCatalogPreview from "./admin-catalog-preview";
import CalendarField from "./calendar-field";
import { parseCalendarDate, taipeiDeadline } from "@/lib/calendar";
import AdminMembers from "./admin-members";
import { getVotingAccess, type RegisteredUser } from "@/lib/voting-access";
import AdminVoteOverview from "./admin-vote-overview";
import { useOuting } from "./outing-provider";
import { getFirebase } from "@/lib/firebase";
import { defaultCatalog } from "@/lib/default-catalog";
import {
  sortedPlans,
  type Catalog,
  type TripPlan,
  type VoteDetails,
} from "@/lib/trips";

function nextKey(existing: object, prefix: string, limit: number) {
  for (let i = 0; i < limit; i++) {
    const candidate = prefix ? prefix + i : String.fromCharCode(65 + i);
    if (!(candidate in existing)) return candidate;
  }
  throw new Error("已達數量上限");
}
function localDeadline(value: number) {
  return value
    ? new Date(value + 8 * 60 * 60 * 1000).toISOString().slice(0, 16)
    : "";
}
export default function AdminDashboard() {
  const {
    user,
    authReady,
    profileReady,
    isAdmin,
    login,
    signingIn,
    catalog,
    catalogStatus,
    votes,
    votesReady,
    votesError,
    saveCatalog,
    connected,
    error,
  } = useOuting();
  const [draft, setDraft] = useState<Catalog | null>(null),
    [version, setVersion] = useState<number | null>(null),
    [dirty, setDirty] = useState(false);
  const [view, setView] = useState<"overview" | "editor" | "members">("overview");
  const [reviewChanges, setReviewChanges] = useState(false);
  const editorForm = useRef<HTMLFormElement>(null);
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState("");
  const [details, setDetails] = useState<Record<string, VoteDetails>>({}),
    [detailsError, setDetailsError] = useState("");
  const [detailsReady, setDetailsReady] = useState(false);
  const impacts = catalog && draft ? catalogImpacts(catalog, draft, votes, details) : [];
  const impactsKey = catalogImpactKey(impacts);
  const [members, setMembers] = useState<Record<string, RegisteredUser>>({});
  const [membersReady, setMembersReady] = useState(false), [membersError, setMembersError] = useState("");
  const emails = Object.fromEntries(Object.entries(members).map(([uid, member]) => [uid, member.email || ""]));
  const pendingMembers = Object.values(members).filter(member => getVotingAccess(member.email, member.voteReview) === "pending").length;
  useEffect(() => {
    setMembers({}); setMembersReady(false); setMembersError("");
    if (!isAdmin) return;
    return onValue(ref(getFirebase().database, "users"), snapshot => {
      setMembers(snapshot.val() || {}); setMembersReady(true); setMembersError("");
    }, () => { setMembersReady(false); setMembersError("帳號名單讀取失敗，請重新整理後再試。"); });
  }, [isAdmin]);
  useEffect(() => {
    if (catalog && !dirty) {
      setDraft(structuredClone(catalog));
      setVersion(catalog.updatedAt);
    }
  }, [catalog, dirty]);
  useEffect(() => {
    setDetailsReady(false);
    if (!isAdmin) {
      setDetails({});
      return;
    }
    return onValue(
      ref(getFirebase().database, "outing/voteDetails"),
      (snap) => {
        setDetails(snap.val() || {});
        setDetailsReady(true);
        setDetailsError("");
      },
      () => { setDetailsReady(false); setDetailsError("無法讀取投票明細，請確認管理員權限。"); },
    );
  }, [isAdmin]);
  useEffect(() => {
    if (!dirty) return;
    function before(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  function edit(change: (next: Catalog) => void) {
    if (!draft) return;
    const next = structuredClone(draft);
    change(next);
    setDraft(next);
    setDirty(true);
    setMessage("");
  }
  function editPlan(id: string, change: (plan: TripPlan) => void) {
    edit((next) => change(next.plans[id]));
  }
  function cancelEdits() {
    if (saving || !catalog) return;
    setDraft(structuredClone(catalog));
    setVersion(catalog.updatedAt);
    setDirty(false);
    setReviewChanges(false);
    setFailed("");
    setMessage("已取消變更，恢復已儲存的版本。");
  }
  async function save(event?: React.FormEvent<HTMLFormElement>, acceptedImpacts?: string) {
    event?.preventDefault();
    if (!draft || saving) return;
    const form = event?.currentTarget || editorForm.current;
    if (form && !form.checkValidity()) {
      setEditorMode("edit");
      setFailed("還有欄位需要補齊，已回到編輯畫面。");
      requestAnimationFrame(() => form.reportValidity());
      return;
    }
    if (!parseCalendarDate(draft.settings.eventDate)) {
      setFailed("請選擇有效的活動日期。");
      return;
    }
    if (!votesReady || !detailsReady) { setFailed("正在確認既有投票，請等明細同步完成後再儲存。"); return; }
    if (impacts.length && (acceptedImpacts !== impactsKey || impacts.some(item => item.removed))) { setFailed(""); setReviewChanges(true); return; }
    setSaving(true);
    setFailed("");
    setMessage("");
    try {
      const cleaned = structuredClone(draft);
      for (const plan of Object.values(cleaned.plans)) {
        plan.tags = plan.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 10);
        if (!plan.tags.length) plan.tags = [plan.shortName];
      }
      await saveCatalog(cleaned, version, acceptedImpacts);
      setReviewChanges(false);
      setDirty(false);
      setMessage("已儲存，首頁已同步更新。");
    } catch (error) {
      setFailed(
        error instanceof Error
          ? error.message
          : "儲存失敗，請確認資料與權限後再試。",
      );
    } finally {
      setSaving(false);
    }
  }
  async function seed() {
    setSaving(true);
    setFailed("");
    try {
      await saveCatalog(defaultCatalog, null);
      setMessage("兩個秋遊方案已建立，可以開始投票。");
    } catch (error) {
      setFailed(
        error instanceof Error ? error.message : "建立失敗，請確認資料庫權限。",
      );
    } finally {
      setSaving(false);
    }
  }
  const access = !authReady || (user && !profileReady) ? (
    <LoadingPanel label="主辦控制室準備中" description="正在確認登入身分。" />
  ) : !user ? (
    <div className="access-card">
      <h1>主辦人的控制室</h1>
      <p>使用指定的 Google 管理員帳號登入。</p>
      <button
        className="button button-yellow"
        disabled={signingIn}
        onClick={login}
      >
        {signingIn ? <LoadingIndicator label="登入中" compact /> : "Google 登入"}
      </button>
    </div>
  ) : !isAdmin ? (
    <div className="access-card">
      <h1>這裡是主辦人後台</h1>
      <p>目前帳號沒有管理權限。你仍可在首頁查看方案及投票。</p>
      <Link className="button button-dark" href="/">
        回到秋遊投票 →
      </Link>
    </div>
  ) : null;
  return (
    <div className="admin-page">
      <div className="admin-header">
      <div className="topbar wrap">
        <Link className="brand" href="/">
          ← 回秋遊首頁
        </Link>
        <AccountMenu />
      </div>
      </div>
      <main className="wrap admin-main">
        {access || (
          <>
            <div className="section-heading">
              <div>
                <span className="eyebrow">ORGANIZER DESK</span>
                <h1>主辦控制室</h1>
              </div>
              <span className="live-state">
                {connected ? "已連線" : "連線中斷"}
              </span>
            </div>
            <p className="quiet">
              先看戰況與大家的偏好，再安排這次秋遊。方案內容也能直接在卡片上編輯。
            </p>
            {catalogStatus === "loading" && <LoadingPanel label="正在整理最新方案" description="活動設定與各組選項即將就緒。" />}
            {catalogStatus === "error" && (
              <p className="notice notice-error">
                無法讀取資料庫，請確認 Firebase 的規則設定。
              </p>
            )}
            {catalogStatus === "empty" && (
              <div className="access-card">
                <h2>建立這次的秋遊對決</h2>
                <p>
                  將現有的「大稻埕人文慢旅」與「按摩＋下午茶」放入資料庫，包含原本行程與選配項目。
                </p>
                <button
                  className="button button-yellow"
                  disabled={saving || !connected}
                  onClick={seed}
                >
                  {saving ? <LoadingIndicator label="建立中" compact /> : "匯入目前兩個方案"}
                </button>
              </div>
            )}
            <div className="organizer-view-tabs" role="group" aria-label="主辦功能">
              <button type="button" aria-pressed={view === "overview"} onClick={() => setView("overview")}>戰況與明細</button>
              <button type="button" className="member-review-tab" aria-pressed={view === "members"} onClick={() => setView("members")} title={membersReady && pendingMembers > 0 ? pendingMembers + " 個帳號待審核" : undefined}>帳號與審核{membersReady && <span>{pendingMembers ? pendingMembers + " 待審" : Object.keys(members).length + " 人"}</span>}{membersReady && pendingMembers > 0 && <i className="pending-review-dot" aria-hidden="true" />}</button>
              <button type="button" aria-pressed={view === "editor"} onClick={() => setView("editor")}>編輯方案{dirty && <span>未儲存</span>}</button>
            </div>
            {catalog && <div hidden={view !== "overview"}><AdminVoteOverview catalog={catalog} votes={votes} details={details} emails={emails} ready={votesReady && detailsReady && membersReady} error={votesError || detailsError || membersError} /></div>}
            <div hidden={view !== "members"}><AdminMembers members={members} ready={membersReady} error={membersError} votes={votes} votesReady={votesReady} catalog={catalog} /></div>
            {draft && (
              <form ref={editorForm} hidden={view !== "editor"} noValidate onSubmit={save} onInvalidCapture={(event) => {
                const detail = (event.target as HTMLElement).closest("details");
                if (detail) detail.open = true;
              }}>
                <fieldset className="admin-settings" disabled={saving}>
                  <legend>活動與投票</legend>
                  <div className="admin-fields">
                    <label>
                      活動名稱
                      <input
                        required
                        maxLength={100}
                        value={draft.settings.title}
                        onChange={(e) =>
                          edit((d) => {
                            d.settings.title = e.target.value;
                          })
                        }
                      />
                    </label>
                    <CalendarField label="活動日期" required value={draft.settings.eventDate} onChange={value => edit(d => { d.settings.eventDate = value; })} />
                    <label>
                      預計參加人數
                      <input
                        type="number"
                        required
                        min={1}
                        max={1000}
                        value={draft.settings.expectedVoters}
                        onChange={(e) =>
                          edit((d) => {
                            d.settings.expectedVoters = Number(e.target.value);
                          })
                        }
                      />
                    </label>
                    <CalendarField label="投票截止時間（台北時間，可留白）" withTime value={localDeadline(draft.settings.closesAt)} defaultDate={draft.settings.eventDate} onChange={value => edit(d => { d.settings.closesAt = taipeiDeadline(value); })} />
                  </div>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={draft.settings.votingOpen}
                      onChange={(e) =>
                        edit((d) => {
                          d.settings.votingOpen = e.target.checked;
                        })
                      }
                    />
                    開放投票與改票<span>關閉後可查看結果，不能再投票。</span>
                  </label>
                </fieldset>
                <div className="section-heading">
                  <div><h2>把方案排成你想要的樣子</h2><p className="quiet">上方是首頁卡片，下方是這一派的選配項目。</p></div>
                  <button
                    className="button button-white"
                    type="button"
                    disabled={saving || Object.keys(draft.plans).length >= 8}
                    onClick={() => {
                      setEditorMode("edit");
                      edit((d) => {
                        const id = nextKey(d.plans, "", 8);
                        d.plans[id] = {
                          code: String.fromCharCode(
                            65 + Object.keys(d.plans).length,
                          ),
                          title: "新方案",
                          shortName: "新陣營",
                          category: "秋遊方案",
                          description: "請填入方案介紹",
                          priceNote: "費用待確認",
                          color: "yellow",
                          tags: ["新方案"],
                          schedule: [
                            {
                              time: "10:00",
                              title: "集合",
                              description: "集合地點待確認",
                            },
                          ],
                          groups: {},
                          order: Object.keys(d.plans).length,
                          active: false,
                        };
                      });
                    }}
                  >
                    ＋ 新增方案
                  </button>
                </div>
                <div className="visual-editor-toolbar">
                  <div className="editor-view-switch" role="group" aria-label="編輯或預覽">
                    <button type="button" aria-pressed={editorMode === "edit"} onClick={() => setEditorMode("edit")}>直接編輯</button>
                    <button type="button" aria-pressed={editorMode === "preview"} onClick={() => setEditorMode("preview")}>預覽畫面</button>
                  </div>
                  <span>{editorMode === "edit" ? "虛線內的文字都能改 · 改完別忘了儲存" : "預覽包含尚未儲存的修改"}</span>
                </div>
                <div className="admin-editor-grid" hidden={editorMode !== "edit"}>
                  {sortedPlans(draft).map(([id, plan]) => <AdminPlanEditor key={id} planId={id} plan={plan} saving={saving}
                    voteCount={Object.values(votes).filter(vote => vote.planId === id).length}
                    selectedChoices={choiceSelectionCounts(id, votes, details)} choicesReady={votesReady && detailsReady}
                    edit={change => editPlan(id, change)} />)}
                </div>
                {editorMode === "preview" && <AdminCatalogPreview catalog={draft} />}
                {dirty && catalog && catalog.updatedAt !== version && (
                  <div className="notice notice-error">
                    另一位管理員剛更新了方案。請先重新載入，避免覆蓋對方的修改。
                    <button
                      type="button"
                      className="text-button"
                      onClick={cancelEdits}
                    >
                      放棄本機修改並載入
                    </button>
                  </div>
                )}
                {!!impacts.length && <p className="catalog-change-notice" role="status">這次修改涉及 {impacts.length} 個已有人選擇的項目，儲存前會列出內容與名單供你確認。</p>}
                <div className="admin-savebar">
                  <span role="status">{saving ? "正在同步到首頁…" : dirty ? "草稿已修改 · 尚未更新首頁" : "所有變更已儲存"}</span>
                  <div className="admin-save-actions">
                  <button type="button" className="button button-white" disabled={saving || !dirty || !catalog} onClick={cancelEdits}>取消變更</button>
                  <button
                    className="button button-yellow"
                    disabled={saving || !dirty || !connected || !votesReady || !detailsReady}
                    type="submit"
                  >
                    {saving ? <LoadingIndicator label="儲存中" compact /> : "儲存變更 ✓"}
                  </button>
                  </div>
                </div>
              </form>
            )}

          </>
        )}
        {(failed || error) && (
          <p className="notice notice-error" role="alert">
            {failed || error}
          </p>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </main>
      {isAdmin && <CatalogImpactDialog open={reviewChanges} impacts={impacts} busy={saving} error={failed} onClose={() => setReviewChanges(false)} onConfirm={() => save(undefined, impactsKey)} />}
    </div>
  );
}
