"use client";
import { choiceGroupMode, type TripPlan } from "@/lib/trips";
import PlanCard, { type EditPlan } from "./plan-card";
import InlineEditField from "./inline-edit-field";

// Never reuse a deleted choice ID: existing votes may still refer to it.
function freshKey() { return "item-" + crypto.randomUUID(); }
export default function AdminPlanEditor({ planId, plan, edit, saving, voteCount, selectedChoices, choicesReady }: { planId: string; plan: TripPlan; edit: EditPlan; saving: boolean; voteCount: number; selectedChoices: Record<string, Record<string, number>>; choicesReady: boolean }) {
  return <fieldset disabled={saving} className="visual-plan-editor" aria-label={plan.code + " 方案編輯"}>
    <legend className="sr-only">{plan.code} 方案編輯</legend>
    <div className="plan-editor-controls">
      <span className={"editor-plan-badge tone-" + plan.color}>{plan.code}</span>
      <label className="editor-active"><input type="checkbox" checked={plan.active} onChange={event => edit(p => { p.active = event.target.checked; })} />{plan.active ? "上架中" : "未上架"}</label>
      <span className="editor-vote-count">{voteCount} 票</span>
      <details className="plan-editor-settings"><summary>卡片設定</summary><div className="admin-fields">
        <label>方案代號<input required maxLength={8} value={plan.code} onChange={event => edit(p => { p.code = event.target.value; })} /></label>
        <label>排列順序<input type="number" required min={0} max={99} value={plan.order} onChange={event => edit(p => { p.order = Number(event.target.value); })} /></label>
        <label>卡片配色<select value={plan.color} onChange={event => edit(p => { p.color = event.target.value as TripPlan["color"]; })}><option value="yellow">走讀黃</option><option value="coral">放鬆粉</option></select></label>
      </div></details>
    </div>
    <PlanCard plan={plan} edit={edit} />
    <div className="editor-preferences" data-team-tone={plan.color}>
      <div className={"editor-preferences-heading tone-" + plan.color}><span className="eyebrow">接著選偏好</span><h3>{plan.shortName}的選項</h3><p>已有選擇的項目請保留。若換餐廳或按摩療程，請新增選項；修改原項目會同步影響既有投票。</p></div>
      {Object.entries(plan.groups || {}).map(([groupId, group]) => <section key={groupId} className="visual-group-editor">
        <div className="visual-group-title"><h4><InlineEditField label="選配問題" value={group.label} maxLength={100} multiline onChange={value => edit(p => { p.groups![groupId].label = value; })} /></h4>
          <button className="editor-small-button" type="button" disabled={!choicesReady || Object.values(selectedChoices[groupId] || {}).some(count => count > 0)} title={!choicesReady ? "正在確認既有投票" : "有人選擇的題目需保留"} onClick={() => edit(p => { delete p.groups![groupId]; })}>移除此題</button>
        </div>
        <label className="group-arrangement-mode">安排方式<select value={choiceGroupMode(planId, groupId, group)} onChange={event => edit(p => { p.groups![groupId].selectionMode = event.target.value as "group" | "individual"; })}><option value="group">共同安排 · 參考偏好票數</option><option value="individual">各自選擇 · 依各人選項安排</option></select></label>
        <div className="preference-choices">{Object.entries(group.choices || {}).map(([choiceId, choice]) => <div key={choiceId} className="visual-choice-editor">
          <span className="preview-radio" aria-hidden="true" />
          <div className="visual-choice-copy">{!choicesReady ? <span className="choice-edit-usage">正在確認已選人數…</span> : !!selectedChoices[groupId]?.[choiceId] && <span className="choice-edit-usage">{selectedChoices[groupId][choiceId]} 人已選 · 修改前請留意</span>}<InlineEditField label="選項名稱" value={choice.label} maxLength={100} multiline onChange={value => edit(p => { p.groups![groupId].choices[choiceId].label = value; })} />
            <InlineEditField label="選項補充說明" value={choice.description} placeholder="補充說明（選填）" required={false} maxLength={250} multiline onChange={value => edit(p => { p.groups![groupId].choices[choiceId].description = value; })} />
          </div>
          <div className="visual-choice-price"><InlineEditField label="選項價格" value={choice.price} placeholder="價格（選填）" required={false} maxLength={50} onChange={value => edit(p => { p.groups![groupId].choices[choiceId].price = value; })} />
            <button className="editor-small-button" type="button" disabled={!choicesReady || Object.keys(group.choices).length <= 1 || !!selectedChoices[groupId]?.[choiceId]} title={selectedChoices[groupId]?.[choiceId] ? "已有投票，請保留此選項" : undefined} onClick={() => edit(p => { delete p.groups![groupId].choices[choiceId]; })}>移除</button>
          </div>
        </div>)}</div>
        <button className="editor-add-row" type="button" disabled={Object.keys(group.choices).length >= 20} onClick={() => edit(p => {
          p.groups![groupId].choices[freshKey()] = { label: "新選項", description: "", price: "" };
        })}>＋ 加一個選項</button>
      </section>)}
      {!Object.keys(plan.groups || {}).length && <p className="editor-empty">這一派還沒有選配問題，可以加入午餐或體驗的選項。</p>}
      <button className="button button-white editor-add-group" type="button" disabled={Object.keys(plan.groups || {}).length >= 6} onClick={() => edit(p => {
        p.groups ||= {};
        p.groups[freshKey()] = { label: "想選哪一個？", choices: { [freshKey()]: { label: "新選項", description: "", price: "" } } };
      })}>＋ 新增選配問題</button>
    </div>
  </fieldset>;
}
