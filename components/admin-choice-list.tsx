"use client";
import { moveChoice, sortedChoices, type ChoiceGroup } from "@/lib/trips";
import type { EditPlan } from "./plan-card";
import HighlightEditField from "./highlight-edit-field";
import InlineEditField from "./inline-edit-field";
import { ReorderGrip, useReorder } from "./use-reorder";

export default function AdminChoiceList({ groupId, group, edit, saving, selectedChoices, choicesReady }: {
  groupId: string; group: ChoiceGroup; edit: EditPlan; saving: boolean; selectedChoices: Record<string, number>; choicesReady: boolean;
}) {
  const choices = sortedChoices(group);
  const reorder = useReorder(choices.map(([id, choice]) => ({ id, label: choice.label })),
    (from, to) => edit(plan => moveChoice(plan.groups![groupId], from, to)), saving);
  function editStore(choiceId: string, field: "mapsQuery" | "mapsUrl" | "website", value: string) {
    edit(plan => {
      const choice = plan.groups![groupId].choices[choiceId];
      choice.store ||= {};
      if (value) choice.store[field] = value;
      else {
        delete choice.store[field];
        if (!Object.keys(choice.store).length) delete choice.store;
      }
    });
  }
  return <>
    <p className="editor-sort-hint">拖曳左側把手調整順序，也可使用上移／下移。</p>
    {reorder.feedback}
    <div className="preference-choices reorder-list" ref={reorder.listRef} aria-label={group.label + "選項排序"}>
      {choices.map(([choiceId, choice], index) => <div key={choiceId} className="visual-choice-editor" {...reorder.rowProps(index)}>
        <button {...reorder.handleProps(index)}><ReorderGrip /></button>
        <div className="visual-choice-copy">
          {!choicesReady ? <span className="choice-edit-usage">正在確認已選人數…</span> : !!selectedChoices[choiceId] && <span className="choice-edit-usage">{selectedChoices[choiceId]} 人已選 · 修改前請留意</span>}
          <InlineEditField label="選項名稱" value={choice.label} maxLength={100} multiline onChange={value => edit(p => { p.groups![groupId].choices[choiceId].label = value; })} />
          {choice.subtitle !== undefined && <InlineEditField className="choice-subtitle-editor" label="選項小標" value={choice.subtitle} required={false} maxLength={100} onChange={value => edit(p => { p.groups![groupId].choices[choiceId].subtitle = value; })} />}
          <HighlightEditField value={choice.description} highlights={choice.descriptionHighlights} onChange={(value, highlights) => edit(p => {
            const option = p.groups![groupId].choices[choiceId];
            option.description = value;
            if (highlights.length) option.descriptionHighlights = highlights;
            else delete option.descriptionHighlights;
          })} />
          {choice.ingredients !== undefined && <InlineEditField className="choice-ingredients-editor" label="湯底材料" value={choice.ingredients} required={false} maxLength={250} multiline onChange={value => edit(p => { p.groups![groupId].choices[choiceId].ingredients = value; })} />}
          <details className="choice-store-editor">
            <summary>店家地圖與官網連結（選填）</summary>
            <label>地圖搜尋詞<input type="text" maxLength={200} placeholder="店名、分店與地址" value={choice.store?.mapsQuery || ""} onChange={event => editStore(choiceId, "mapsQuery", event.target.value)} /></label>
            <label>精確 Google 地圖連結<input type="url" pattern="https://.*" maxLength={2048} placeholder="https://www.google.com/maps/..." value={choice.store?.mapsUrl || ""} onChange={event => editStore(choiceId, "mapsUrl", event.target.value)} /></label>
            <label>店家官網<input type="url" pattern="https://.*" maxLength={2048} placeholder="https://..." value={choice.store?.website || ""} onChange={event => editStore(choiceId, "website", event.target.value)} /></label>
            <small className="quiet">新店只會顯示有填寫的連結；既有店家留白會沿用原設定。</small>
          </details>
        </div>
        <div className="visual-choice-price"><InlineEditField label="選項價格" value={choice.price} placeholder="價格（選填）" required={false} maxLength={50} onChange={value => edit(p => { p.groups![groupId].choices[choiceId].price = value; })} /></div>
        <div className="inline-row-tools visual-choice-tools" aria-label={"調整選項「" + choice.label + "」"}>
          <button type="button" disabled={saving || index === 0} onClick={() => reorder.move(index, index - 1)}>上移</button>
          <button type="button" disabled={saving || index === choices.length - 1} onClick={() => reorder.move(index, index + 1)}>下移</button>
          <button type="button" disabled={!choicesReady || choices.length <= 1 || !!selectedChoices[choiceId]} title={selectedChoices[choiceId] ? "已有投票，請保留此選項" : undefined} onClick={() => edit(p => { delete p.groups![groupId].choices[choiceId]; })}>移除</button>
        </div>
      </div>)}
    </div>
  </>;
}
