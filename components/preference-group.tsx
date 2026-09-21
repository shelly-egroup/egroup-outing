"use client";
import { useRef } from "react";
import type { ChoiceGroup } from "@/lib/trips";
import { useLightDraw } from "./use-light-draw";

type Props = {
  groupId: string;
  individual?: boolean;
  group: ChoiceGroup;
  selectedId: string;
  disabled: boolean;
  onChoose: (id: string) => void;
};
export default function PreferenceGroup({ groupId, group, selectedId, disabled, onChoose, individual = false }: Props) {
  const choices = Object.entries(group.choices || {});
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
  return <fieldset className="preference-group" disabled={disabled}>
    <legend>{group.label}<small>{individual ? "每個人都能按自己選的；也可留白交給主辦安排" : "可先留白，交給主辦安排"}</small></legend>
    {choices.length > 1 && <div className="preference-draw">
      <div><b>選擇困難？</b><p role="status" aria-live="polite">{rolling ? "跑燈中…快要選好了！" : result ? "幫你選到：" + result.label : "讓跑燈幫你選一個。"}</p>{soundUnavailable && <small className="draw-sound-note">音效暫時無法播放，抽選結果不受影響。</small>}</div>
      <button type="button" className="button button-white" disabled={rolling} onClick={draw}>{rolling ? "抽選中…" : result ? "再選一次" : "幫我選"}</button>
    </div>}
    <div className="preference-choices">
      {choices.map(([id, choice]) => <label
        key={id} ref={node => { rows.current[id] = node; }}
        className={"preference-choice" + (selectedId === id ? " checked" : "") + (rolling && litId === id ? " is-drawing" : "") + (!rolling && resultId === id && selectedId === id ? " is-draw-winner" : "")}>
        <span className="plan-draw-lights" aria-hidden="true"><i /><i /><i /><i /></span>
        <input type="radio" name={groupId} value={id} checked={selectedId === id} onChange={() => choose(id)} />
        <span><b>{choice.label}</b>{choice.description && <small>{choice.description}</small>}</span>
        {choice.price && <strong>{choice.price}</strong>}
      </label>)}
      <label className={"preference-choice arrange-choice" + (!selectedId ? " checked" : "")}>
        <input type="radio" name={groupId} checked={!selectedId} onChange={() => choose("")} />
        <span>請主辦安排</span>
      </label>
    </div>
  </fieldset>;
}
