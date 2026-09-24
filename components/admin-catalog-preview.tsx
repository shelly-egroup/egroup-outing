"use client";
import { sortedGroups } from "@/lib/trips";
import { useState } from "react";
import { choiceGroupMode, sortedPlans, type Catalog } from "../lib/trips";
import PlanCard from "./plan-card";
import PreferenceGroup from "./preference-group";
import VersusBadge from "./versus-badge";

/** A local draft preview. No auth, vote submission, or database writes. */
export default function AdminCatalogPreview({ catalog }: { catalog: Catalog }) {
  const [size, setSize] = useState<"desktop" | "mobile">("desktop");
  const [chosen, setChosen] = useState("");
  const [preferences, setPreferences] = useState<Record<string, Record<string, string>>>({});
  const plans = sortedPlans(catalog).filter(([, plan]) => plan.active);
  const selectedId = plans.some(([id]) => id === chosen) ? chosen : plans[0]?.[0];
  const selected = selectedId ? catalog.plans[selectedId] : null;
  const hiddenCount = Object.keys(catalog.plans).length - plans.length;
  return <section className="admin-preview-wrap" aria-label="草稿預覽">
    <div className="preview-toolbar"><div><b>同事會看到的樣子</b><p>這是目前的草稿，可試選方案與偏好，不會送出投票。</p></div>
      <div className="editor-view-switch" role="group" aria-label="預覽寬度">
        <button type="button" aria-pressed={size === "desktop"} onClick={() => setSize("desktop")}>電腦</button>
        <button type="button" aria-pressed={size === "mobile"} onClick={() => setSize("mobile")}>手機</button>
      </div>
    </div>
    {hiddenCount > 0 && <p className="quiet">{hiddenCount} 個未上架方案不會出現在首頁預覽中。</p>}
    <div className={"catalog-preview preview-" + size}>
      <div className="preview-event"><span className="eyebrow">THE AUTUMN OUTING</span><h2>{catalog.settings.title}</h2><p>{catalog.settings.eventDate} · 預計 {catalog.settings.expectedVoters} 人</p></div>
      <div className="section-heading"><h2>你是哪一派？</h2></div>
      <div className="plan-grid" data-duel={plans.length === 2}>
        {plans.length === 2 && <VersusBadge />}
        {plans.map(([id, plan]) => <PlanCard key={id} plan={plan} selected={id === selectedId} onChoose={() => setChosen(id)} />)}
      </div>
      {!plans.length && <p className="state-box">目前沒有上架的方案，回到編輯開啟「上架中」就能預覽。</p>}
      {selected && <section className="preview-selection" data-team-tone={selected.color}>
        <div className="section-heading"><h2>選好偏好，再投一票</h2></div>
        <div className="selection-layout">
          <div className="preference-panel">
            <div className={"selected-banner tone-" + selected.color}><span>{selected.code} · {selected.shortName}</span><h3>{selected.title}</h3></div>
            {sortedGroups(selected).map(([groupId, group]) => <PreferenceGroup key={selectedId + groupId} groupId={"preview-" + selectedId + "-" + groupId} group={group} tone={selected.color} individual={choiceGroupMode(selectedId, groupId, group) === "individual"}
              selectedId={preferences[selectedId]?.[groupId] || ""} disabled={false} onChoose={id => setPreferences(current => ({ ...current, [selectedId]: { ...current[selectedId], [groupId]: id } }))} />)}
            {!Object.keys(selected.groups || {}).length && <p className="state-box">這個方案沒有選配問題。</p>}
          </div>
          <aside className="vote-review"><span className="eyebrow">YOUR VOTE</span><h3>準備好站這一邊？</h3>
            <div className="review-plan"><span className="team-label">{selected.code} · {selected.shortName}</span><strong>{selected.title}</strong></div>
            <dl>{sortedGroups(selected).map(([id, group]) => <div key={id}><dt>{group.label}</dt><dd>{group.choices[preferences[selectedId]?.[id]]?.label || "請主辦安排"}</dd></div>)}</dl>
            <p className="preview-only-note">預覽模式 · 選擇只留在這裡</p>
          </aside>
        </div>
      </section>}
    </div>
  </section>;
}
