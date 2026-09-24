"use client";
import HighlightedText from "./highlighted-text";
import { useRef, type ReactNode } from "react";
import { sortedChoices, type ChoiceGroup } from "@/lib/trips";
import { useLightDraw } from "./use-light-draw";
import StoreLinks from "./store-links";
import StoreReviews from "./store-reviews";
import { useOuting } from "./outing-provider";
import { choiceStore } from "@/lib/store-references";

type Props = {
  children?: ReactNode;
  tone?: "yellow" | "coral";
  groupId: string;
  individual?: boolean;
  group: ChoiceGroup;
  selectedId: string;
  disabled: boolean;
  onChoose: (id: string) => void;
};
export default function PreferenceGroup({ groupId, group, selectedId, disabled, onChoose, individual = false, children, tone }: Props) {
  const { stores } = useOuting();
  const choices = sortedChoices(group);
  const rows = useRef<Record<string, HTMLLabelElement | null>>({});
  const { rolling, litId, resultId, soundUnavailable, choose, draw } = useLightDraw(
    choices.map(([id]) => id), selectedId, disabled,
    id => {
      onChoose(id);
      requestAnimationFrame(() => rows.current[id]?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      }));
    },
  );
  const result = resultId === selectedId ? group.choices?.[resultId] : undefined;
  return <fieldset className={"preference-group" + (choices.some(([, choice]) => choice.ingredients) ? " recipe-preferences" : "")}>
    <legend>{group.label}<small>{individual ? "每人各選一種；也可留白交給主辦安排" : "可先留白，交給主辦安排"}</small></legend>
    {children}
    {choices.length > 1 && <div className="preference-draw">
      <div><b>選擇困難？</b><p role="status" aria-live="polite">{rolling ? "跑燈中…快要選好了！" : result ? "幫你選到：" + result.label : "讓跑燈幫你選一個。"}</p>{soundUnavailable && <small className="draw-sound-note">音效暫時無法播放，抽選結果不受影響。</small>}</div>
      <button type="button" className="button button-white" disabled={disabled || rolling} onClick={draw}>{rolling ? "抽選中…" : result ? "再選一次" : "幫我選"}</button>
    </div>}
    <div className="preference-choices">
      {choices.map(([id, choice]) => {
        const reference = choiceStore(choice.label);
        const record = reference ? stores[reference.id] : undefined;
        const store = record?.info || reference;
        return <div key={id} className={"preference-choice-card" + (store ? " has-store-links" : "")}><label
        ref={node => { rows.current[id] = node; }}
        className={"preference-choice" + (choice.ingredients ? " recipe-choice" : "") + (selectedId === id ? " checked" : "") + (rolling && litId === id ? " is-drawing" : "") + (!rolling && resultId === id && selectedId === id ? " is-draw-winner" : "")}>
        <span className="plan-draw-lights" aria-hidden="true"><i /><i /><i /><i /></span>
        <input type="radio" disabled={disabled} name={groupId} value={id} checked={selectedId === id} onChange={() => choose(id)} />
        <span className="preference-choice-copy"><span className="choice-title-line"><b>{choice.label}</b>{choice.subtitle && <span className="choice-subtitle">{choice.subtitle}</span>}</span>
          {choice.description && <small className="choice-description"><HighlightedText text={choice.description} highlights={choice.descriptionHighlights} /></small>}
          {choice.ingredients && <small className="choice-ingredients">{choice.ingredients.split("、").map((ingredient, index, ingredients) =>
            <span className="choice-ingredient" key={index}>{ingredient}{index < ingredients.length - 1 ? "、" : ""}</span>,
          )}</small>}
        </span>
        {choice.price && <strong>{choice.price}</strong>}
      </label>{store && <StoreLinks store={store} compact />}{record?.reviews && <StoreReviews snapshot={record.reviews} tone={tone} compact />}</div>;
      })}
      <label className={"preference-choice arrange-choice" + (!selectedId ? " checked" : "")}>
        <input type="radio" disabled={disabled} name={groupId} checked={!selectedId} onChange={() => choose("")} />
        <span>請主辦安排</span>
      </label>
    </div>
  </fieldset>;
}
