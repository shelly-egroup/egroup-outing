"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import AccountMenu from "./account-menu";
import LoadingIndicator from "./loading-indicator";
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
  const [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState("");
  const [details, setDetails] = useState<Record<string, VoteDetails>>({}),
    [detailsError, setDetailsError] = useState("");
  useEffect(() => {
    if (catalog && !dirty) {
      setDraft(structuredClone(catalog));
      setVersion(catalog.updatedAt);
    }
  }, [catalog, dirty]);
  useEffect(() => {
    if (!isAdmin) {
      setDetails({});
      return;
    }
    return onValue(
      ref(getFirebase().database, "outing/voteDetails"),
      (snap) => {
        setDetails(snap.val() || {});
        setDetailsError("");
      },
      () => setDetailsError("無法讀取投票明細，請確認管理員權限。"),
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
  async function save(event?: React.FormEvent) {
    event?.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setFailed("");
    setMessage("");
    try {
      const cleaned = structuredClone(draft);
      for (const plan of Object.values(cleaned.plans)) {
        plan.tags = plan.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 10);
        if (!plan.tags.length) plan.tags = [plan.shortName];
      }
      await saveCatalog(cleaned, version);
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
    <div className="state-box"><LoadingIndicator label="確認登入狀態中" /></div>
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
      <div className="topbar wrap">
        <Link className="brand" href="/">
          ← 回秋遊首頁
        </Link>
        <AccountMenu />
      </div>
      <main className="wrap admin-main">
        {access || (
          <>
            <div className="section-heading">
              <div>
                <span className="eyebrow">ORGANIZER DESK</span>
                <h1>方案管理</h1>
              </div>
              <span className="live-state">
                {connected ? "已連線" : "連線中斷"}
              </span>
            </div>
            <p className="quiet">
              編輯後按「儲存變更」，同事的頁面會即時更新。已有人投票的方案建議下架，保留原有票數。
            </p>
            {catalogStatus === "loading" && <LoadingIndicator label="載入方案中" />}
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
                  {saving ? "建立中…" : "匯入目前兩個方案"}
                </button>
              </div>
            )}
            {draft && (
              <form onSubmit={save} onInvalidCapture={(event) => {
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
                    <label>
                      活動日期
                      <input
                        type="date"
                        required
                        value={draft.settings.eventDate}
                        onChange={(e) =>
                          edit((d) => {
                            d.settings.eventDate = e.target.value;
                          })
                        }
                      />
                    </label>
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
                    <label>
                      投票截止時間（台北時間，可留白）
                      <input
                        type="datetime-local"
                        value={localDeadline(draft.settings.closesAt)}
                        onChange={(e) =>
                          edit((d) => {
                            d.settings.closesAt = e.target.value
                              ? new Date(e.target.value + ":00+08:00").getTime()
                              : 0;
                          })
                        }
                      />
                    </label>
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
                  <h2>方案清單</h2>
                  <button
                    className="button button-white"
                    type="button"
                    disabled={saving || Object.keys(draft.plans).length >= 8}
                    onClick={() =>
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
                      })
                    }
                  >
                    ＋ 新增方案
                  </button>
                </div>
                {sortedPlans(draft).map(([id, plan]) => (
                  <details className="admin-plan" key={id}>
                    <summary>
                      <span className={"plan-code tone-" + plan.color}>
                        {plan.code}
                      </span>
                      <strong>{plan.title}</strong>
                      <span>
                        {plan.active ? "上架中" : "已下架"} ·{" "}
                        {
                          Object.values(votes).filter((v) => v.planId === id)
                            .length
                        }{" "}
                        票
                      </span>
                    </summary>
                    <fieldset disabled={saving} className="admin-plan-body">
                      <div className="admin-fields">
                        {(
                          [
                            "code",
                            "title",
                            "shortName",
                            "category",
                            "priceNote",
                          ] as const
                        ).map((field, index) => (
                          <label key={field}>
                            {
                              [
                                "方案代號",
                                "方案名稱",
                                "陣營名稱",
                                "方案分類",
                                "費用說明",
                              ][index]
                            }
                            <input
                              required
                              maxLength={field === "code" ? 8 : 150}
                              value={plan[field]}
                              onChange={(e) =>
                                editPlan(id, (p) => {
                                  p[field] = e.target.value;
                                })
                              }
                            />
                          </label>
                        ))}
                        <label>
                          配色
                          <select
                            value={plan.color}
                            onChange={(e) =>
                              editPlan(id, (p) => {
                                p.color = e.target.value as TripPlan["color"];
                              })
                            }
                          >
                            <option value="yellow">走讀黃</option>
                            <option value="coral">放鬆紅</option>
                          </select>
                        </label>
                        <label>
                          排序
                          <input
                            type="number"
                            min={0}
                            max={99}
                            required
                            value={plan.order}
                            onChange={(e) =>
                              editPlan(id, (p) => {
                                p.order = Number(e.target.value);
                              })
                            }
                          />
                        </label>
                      </div>
                      <label>
                        方案介紹
                        <textarea
                          required
                          maxLength={1200}
                          rows={3}
                          value={plan.description}
                          onChange={(e) =>
                            editPlan(id, (p) => {
                              p.description = e.target.value;
                            })
                          }
                        />
                      </label>
                      <label>
                        特色標籤（用逗號分隔）
                        <input
                          maxLength={250}
                          value={(plan.tags || []).join("，")}
                          onChange={(e) =>
                            editPlan(id, (p) => {
                              p.tags = e.target.value
                                .split(/[,，]/)
                                .map((t) => t.trim());
                            })
                          }
                        />
                      </label>
                      <label className="toggle-label">
                        <input
                          type="checkbox"
                          checked={plan.active}
                          onChange={(e) =>
                            editPlan(id, (p) => {
                              p.active = e.target.checked;
                            })
                          }
                        />
                        方案上架
                      </label>
                      <div className="editor-section">
                        <h3>行程</h3>
                        {(plan.schedule || []).map((stop, index) => (
                          <div className="schedule-editor" key={index}>
                            <label>
                              時間
                              <input
                                required
                                value={stop.time}
                                maxLength={30}
                                onChange={(e) =>
                                  editPlan(id, (p) => {
                                    p.schedule[index].time = e.target.value;
                                  })
                                }
                              />
                            </label>
                            <label>
                              行程名稱
                              <input
                                required
                                value={stop.title}
                                maxLength={100}
                                onChange={(e) =>
                                  editPlan(id, (p) => {
                                    p.schedule[index].title = e.target.value;
                                  })
                                }
                              />
                            </label>
                            <label>
                              說明
                              <input
                                value={stop.description}
                                maxLength={500}
                                onChange={(e) =>
                                  editPlan(id, (p) => {
                                    p.schedule[index].description =
                                      e.target.value;
                                  })
                                }
                              />
                            </label>
                            <button
                              className="text-button"
                              type="button"
                              disabled={plan.schedule.length <= 1}
                              onClick={() =>
                                editPlan(id, (p) => {
                                  p.schedule.splice(index, 1);
                                })
                              }
                            >
                              移除
                            </button>
                          </div>
                        ))}
                        <button
                          className="text-button"
                          type="button"
                          disabled={plan.schedule.length >= 12}
                          onClick={() =>
                            editPlan(id, (p) => {
                              p.schedule.push({
                                time: "午後",
                                title: "新行程",
                                description: "",
                              });
                            })
                          }
                        >
                          ＋ 新增行程
                        </button>
                      </div>
                      <div className="editor-section">
                        <h3>選配項目</h3>
                        {Object.entries(plan.groups || {}).map(
                          ([groupId, group]) => (
                            <div className="group-editor" key={groupId}>
                              <div className="group-editor-title">
                                <label>
                                  選配問題
                                  <input
                                    required
                                    maxLength={100}
                                    value={group.label}
                                    onChange={(e) =>
                                      editPlan(id, (p) => {
                                        p.groups![groupId].label =
                                          e.target.value;
                                      })
                                    }
                                  />
                                </label>
                                <button
                                  className="text-button"
                                  type="button"
                                  onClick={() =>
                                    editPlan(id, (p) => {
                                      delete p.groups![groupId];
                                    })
                                  }
                                >
                                  移除此組
                                </button>
                              </div>
                              {Object.entries(group.choices || {}).map(
                                ([choiceId, choice]) => (
                                  <div className="choice-editor" key={choiceId}>
                                    <label>
                                      名稱
                                      <input
                                        required
                                        maxLength={100}
                                        value={choice.label}
                                        onChange={(e) =>
                                          editPlan(id, (p) => {
                                            p.groups![groupId].choices[
                                              choiceId
                                            ].label = e.target.value;
                                          })
                                        }
                                      />
                                    </label>
                                    <label>
                                      說明
                                      <input
                                        maxLength={250}
                                        value={choice.description}
                                        onChange={(e) =>
                                          editPlan(id, (p) => {
                                            p.groups![groupId].choices[
                                              choiceId
                                            ].description = e.target.value;
                                          })
                                        }
                                      />
                                    </label>
                                    <label>
                                      價格
                                      <input
                                        maxLength={50}
                                        value={choice.price}
                                        onChange={(e) =>
                                          editPlan(id, (p) => {
                                            p.groups![groupId].choices[
                                              choiceId
                                            ].price = e.target.value;
                                          })
                                        }
                                      />
                                    </label>
                                    <button
                                      className="text-button"
                                      type="button"
                                      disabled={
                                        Object.keys(group.choices).length <= 1
                                      }
                                      onClick={() =>
                                        editPlan(id, (p) => {
                                          delete p.groups![groupId].choices[
                                            choiceId
                                          ];
                                        })
                                      }
                                    >
                                      移除
                                    </button>
                                  </div>
                                ),
                              )}
                              <button
                                className="text-button"
                                type="button"
                                disabled={
                                  Object.keys(group.choices).length >= 20
                                }
                                onClick={() =>
                                  editPlan(id, (p) => {
                                    p.groups![groupId].choices[
                                      nextKey(
                                        p.groups![groupId].choices,
                                        "c",
                                        20,
                                      )
                                    ] = {
                                      label: "新選項",
                                      description: "",
                                      price: "",
                                    };
                                  })
                                }
                              >
                                ＋ 新增選項
                              </button>
                            </div>
                          ),
                        )}
                        <button
                          className="button button-white"
                          type="button"
                          disabled={Object.keys(plan.groups || {}).length >= 6}
                          onClick={() =>
                            editPlan(id, (p) => {
                              p.groups ||= {};
                              p.groups[nextKey(p.groups, "g", 6)] = {
                                label: "新的選配問題",
                                choices: {
                                  c0: {
                                    label: "新選項",
                                    description: "",
                                    price: "",
                                  },
                                },
                              };
                            })
                          }
                        >
                          ＋ 新增選配問題
                        </button>
                      </div>
                    </fieldset>
                  </details>
                ))}
                {dirty && catalog && catalog.updatedAt !== version && (
                  <div className="notice notice-error">
                    另一位管理員剛更新了方案。請先重新載入，避免覆蓋對方的修改。
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setDirty(false);
                        setFailed("");
                      }}
                    >
                      放棄本機修改並載入
                    </button>
                  </div>
                )}
                <div className="admin-savebar">
                  <span>{dirty ? "有尚未儲存的變更" : "所有變更已儲存"}</span>
                  <button
                    className="button button-yellow"
                    disabled={saving || !dirty || !connected}
                    type="submit"
                  >
                    {saving ? <LoadingIndicator label="儲存中" compact /> : "儲存變更 ✓"}
                  </button>
                </div>
              </form>
            )}
            <section className="admin-voters">
              <div className="section-heading">
                <h2>投票明細</h2>
                <span>
                  {votesReady
                    ? Object.keys(votes).length + " 人已投票"
                    : votesError ? "暫時無法讀取" : <LoadingIndicator label="讀取中" compact />}
                </span>
              </div>
              {(detailsError || votesError) && <p role="alert">{detailsError || votesError}</p>}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>同事</th>
                      <th>方案</th>
                      <th>選配偏好</th>
                      <th>備註（僅管理員）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(votes).map(([uid, vote]) => {
                      const detail = details[uid];
                      const plan = catalog?.plans[vote.planId];
                      return (
                        <tr key={uid}>
                          <td>{vote.displayName}</td>
                          <td>{plan?.title || "已下架方案"}</td>
                          <td>
                            {Object.entries(detail?.preferences || {})
                              .map(
                                ([group, choice]) =>
                                  plan?.groups?.[group]?.choices?.[choice]
                                    ?.label || "已移除選項",
                              )
                              .join("、") || "請主辦安排"}
                          </td>
                          <td>{detail?.note || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {votesReady && Object.keys(votes).length === 0 && (
                  <p className="state-box">還沒有人投票。</p>
                )}
              </div>
            </section>
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
    </div>
  );
}
