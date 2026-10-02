"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TripPlan } from "@/lib/trips";
import { useScrollReveal } from "./use-scroll-reveal";

// Revealed by scrolling up, so it never sits over the itinerary while reading down.
const REVEAL_IDLE_MS = 2500;

type Props = {
  plans: [string, TripPlan][];
  selectedId: string;
  active: boolean;
  disabled: boolean;
  onChoose: (id: string) => void;
};

export default function PlanSwitchDock({ plans, selectedId, active, disabled, onChoose }: Props) {
  const [visible, setVisible] = useState(false);
  const dock = useRef<HTMLElement>(null);
  const [revealed, wake] = useScrollReveal(active && visible, REVEAL_IDLE_MS,
    () => !!dock.current?.contains(document.activeElement) && document.activeElement?.matches(":focus-visible") === true);
  const collapsed = !revealed;

  useEffect(() => {
    if (!active) return;
    const content = document.getElementById("selection-content");
    const picker = document.querySelector("#selection .quick-plan-options");
    const results = document.getElementById("results");
    if (!content || !picker) return;
    let frame = 0;
    const sync = () => {
      const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--outing-header-offset")) || 130;
      const editing = window.matchMedia("(pointer: coarse)").matches &&
        document.activeElement?.matches('textarea, select, input:not([type="radio"]):not([type="checkbox"]), [contenteditable="true"]');
      const viewportBottom = window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : window.innerHeight;
      const beforeResults = (results?.getBoundingClientRect().top ?? content.getBoundingClientRect().bottom) > viewportBottom;
      setVisible(!editing && picker.getBoundingClientRect().bottom <= top && beforeResults);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; sync(); }); };
    const size = new ResizeObserver(schedule);
    size.observe(content); size.observe(picker);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    sync();
    return () => {
      size.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
    };
  }, [active, selectedId]);

  return <nav ref={dock} className={"plan-switch-dock" + (collapsed ? " is-collapsed" : "")} aria-label="切換偏好方案" hidden={!active || !visible} aria-hidden={collapsed || undefined} onPointerDown={wake} onFocus={wake}>
    <div className="plan-switch-caption"><b>切換方案</b><span>已選偏好會保留</span></div>
    <PlanSwitchOptions plans={plans} selectedId={selectedId} disabled={disabled} onChoose={onChoose} onPress={wake} />
  </nav>;
}

/** A/B buttons shared by the phone dock and the desktop YOUR VOTE card; switching returns to the top of the new plan. */
export function PlanSwitchOptions({ plans, selectedId, disabled, onChoose, onPress }: Omit<Props, "active"> & { onPress?: () => void }) {
  const pendingPlan = useRef("");

  useLayoutEffect(() => {
    if (!pendingPlan.current || pendingPlan.current !== selectedId) return;
    pendingPlan.current = "";
    const frame = requestAnimationFrame(() => {
      document.getElementById("selected-plan-title")?.focus({ preventScroll: true });
      document.getElementById("selection-content")?.scrollIntoView({
        block: "start", behavior: "instant",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId]);

  return <div className="plan-switch-options">
    {plans.map(([id, plan]) => <button type="button" key={id} className="plan-switch-option" data-tone={plan.color}
      disabled={disabled} aria-pressed={id === selectedId} aria-controls="selection-content"
      aria-label={plan.code + "・" + plan.shortName + (id === selectedId ? "，目前選擇" : "，切換方案")}
      title={plan.title} onClick={() => {
        onPress?.();
        if (id === selectedId) return;
        pendingPlan.current = id;
        onChoose(id);
      }}>
      <b aria-hidden="true">{plan.code}</b><span>{plan.shortName}</span><span className="plan-switch-check" aria-hidden="true">{id === selectedId ? "✓" : ""}</span>
    </button>)}
  </div>;
}
