"use client";
import type { TripPlan } from "@/lib/trips";
import InlineEditField from "./inline-edit-field";

export type EditPlan = (change: (plan: TripPlan) => void) => void;
type Props = {
  plan: TripPlan;
  selected?: boolean;
  hasVoted?: boolean;
  disabled?: boolean;
  onChoose?: () => void;
  edit?: EditPlan;
};
function titleLines(title: string) {
  if (title.includes("\n")) return title.split("\n");
  if (title === "大稻埕人文慢旅") return ["大稻埕", "人文慢旅"];
  const plus = title.indexOf("＋");
  return plus < 0 ? [title] : [title.slice(0, plus), title.slice(plus)];
}
export default function PlanCard({ plan, selected = false, hasVoted = false, disabled = false, onChoose, edit }: Props) {
  function field(key: "category" | "title" | "description" | "priceNote" | "shortName", label: string, maxLength: number, multiline = false) {
    return <InlineEditField label={label} value={key === "title" ? titleLines(plan.title).join("\n") : plan[key]} maxLength={maxLength} multiline={multiline}
      onChange={value => edit?.(p => { p[key] = value; })} />;
  }
  return <article className={"plan-card tone-" + plan.color + (selected ? " is-selected" : "") + (edit ? " plan-card-editable" : "")}>
    <div className="plan-card-top">
      <span className="plan-code" aria-hidden="true">{plan.code}</span>
      <span className="eyebrow">{edit ? field("category", "方案分類", 150) : plan.category}</span>
      {hasVoted && <span className="your-vote">你的這一票 ✓</span>}
    </div>
    <h3>{edit ? field("title", "方案名稱", 150, true) : titleLines(plan.title).map((line, index) => <span key={index}>{line}</span>)}</h3>
    <div className="plan-description">{edit ? field("description", "方案介紹", 1200, true) : plan.description}</div>
    <div className="pill-row">
      {(plan.tags || []).map((tag, index) => edit ? <span key={index} className="pill editable-pill">
        <InlineEditField label={"特色標籤 " + (index + 1)} value={tag} maxLength={40} required={false} onChange={value => edit(p => { p.tags[index] = value; })} />
        <button type="button" className="tag-remove" aria-label={"移除標籤 " + (tag || index + 1)} onClick={() => edit(p => { p.tags.splice(index, 1); })}>×</button>
      </span> : <span key={index} className="pill">{tag}</span>)}
      {edit && plan.tags.length < 10 && <button className="editor-add-tag" type="button" onClick={() => edit(p => { p.tags.push("新特色"); })}>＋ 特色</button>}
    </div>
    <div className="plan-itinerary" aria-label={plan.shortName + "完整行程"}>
      <ol>{(plan.schedule || []).map((stop, index) => <li key={index}>
        <time>{edit ? <InlineEditField label={"行程 " + (index + 1) + " 時間"} value={stop.time} maxLength={30} onChange={value => edit(p => { p.schedule[index].time = value; })} /> : stop.time}</time>
        <div>
          <strong>{edit ? <InlineEditField label={"行程 " + (index + 1) + " 名稱"} value={stop.title} maxLength={100} multiline onChange={value => edit(p => { p.schedule[index].title = value; })} /> : stop.title}</strong>
          <div className="itinerary-description">{edit ? <InlineEditField label={"行程 " + (index + 1) + " 說明"} value={stop.description} required={false} maxLength={500} multiline onChange={value => edit(p => { p.schedule[index].description = value; })} /> : stop.description}</div>
          {edit && <div className="inline-row-tools" aria-label={"調整行程 " + (index + 1)}>
            <button type="button" disabled={index === 0} onClick={() => edit(p => { [p.schedule[index - 1], p.schedule[index]] = [p.schedule[index], p.schedule[index - 1]]; })}>上移</button>
            <button type="button" disabled={index === plan.schedule.length - 1} onClick={() => edit(p => { [p.schedule[index + 1], p.schedule[index]] = [p.schedule[index], p.schedule[index + 1]]; })}>下移</button>
            <button type="button" disabled={plan.schedule.length <= 1} onClick={() => edit(p => { p.schedule.splice(index, 1); })}>移除</button>
          </div>}
        </div>
      </li>)}</ol>
      {edit && <button className="editor-add-row" type="button" disabled={plan.schedule.length >= 12} onClick={() => edit(p => { p.schedule.push({ time: "午後", title: "新行程", description: "" }); })}>＋ 加一段行程</button>}
    </div>
    <div className="compare-price">{edit ? field("priceNote", "費用說明", 150, true) : plan.priceNote}</div>
    {edit ? <div className={"button choose-button editable-choose " + (plan.color === "yellow" ? "button-dark" : "button-white")}>
      <span>我偏好</span>{field("shortName", "陣營名稱", 150)}
    </div> : <button type="button" className={"button choose-button " + (plan.color === "yellow" || selected ? "button-dark" : "button-white")} disabled={disabled} aria-pressed={selected} onClick={onChoose}>
      {selected ? "已選擇 " + plan.shortName + " ✓" : "我偏好" + plan.shortName}
    </button>}
  </article>;
}
