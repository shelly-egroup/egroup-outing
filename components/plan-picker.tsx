"use client";
import { useLightDraw } from "./use-light-draw";
import type { TripPlan } from "@/lib/trips";

type Props = {
  plans: [string, TripPlan][];
  selectedId: string;
  disabled: boolean;
  onChoose: (id: string) => void;
};

export default function PlanPicker({ plans, selectedId, disabled, onChoose }: Props) {
  const { rolling, litId, resultId, soundUnavailable, choose, draw } = useLightDraw(plans.map(([id]) => id), selectedId, disabled, onChoose);

  const result = resultId === selectedId ? plans.find(([id]) => id === resultId)?.[1] : undefined;
  return <fieldset className="quick-plan-picker" disabled={disabled}>
    <legend>在這裡也能直接選，隨時切換陣營</legend>
    <div className="quick-plan-options">
      {plans.map(([id, plan]) => <button key={id} type="button"
        className={"quick-plan-option tone-" + plan.color + (selectedId === id ? " picked" : "") + (rolling && litId === id ? " is-drawing" : "") + (!rolling && result && resultId === id ? " is-draw-winner" : "")}
        aria-pressed={selectedId === id} aria-controls="selection-content"
        aria-label={plan.code + "・" + plan.shortName + "，" + plan.title + (selectedId === id ? "，已選擇" : "")}
        onClick={() => choose(id)}>
        <span className="plan-draw-lights" aria-hidden="true"><i /><i /><i /><i /></span>
        <span className="quick-plan-code" aria-hidden="true">{plan.code}</span>
        <span><b>{plan.shortName}</b><small>{plan.title}</small></span>
        <span className="quick-plan-check" aria-hidden="true">{selectedId === id ? "✓" : "＋"}</span>
      </button>)}
    </div>
    {plans.length > 1 && <div className="plan-draw-panel">
      <div className="plan-draw-copy"><span className="draw-icon" aria-hidden="true">?</span><div><b>選擇困難？幫你選一派</b><p role="status" aria-live="polite">{rolling ? "跑燈中…看看會停在哪一派！" : result ? "幫你選到 " + result.code + "・" + result.shortName + "，看好偏好再投票。" : "讓跑燈幫忙決定，最後一票還是由你確認。"}</p>{soundUnavailable && <small className="draw-sound-note">音效暫時無法播放，抽選結果不受影響。</small>}</div></div>
      <button type="button" className="button button-dark draw-button" disabled={rolling} onClick={draw}>{rolling ? "抽選中…" : result ? "再幫我選一次" : "幫我選一派"}</button>
    </div>}
  </fieldset>;
}
