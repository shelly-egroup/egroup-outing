"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TripPlan } from "@/lib/trips";

const COLLAPSE_DELAY_MS = 1000;

type Props = {
  plans: [string, TripPlan][];
  selectedId: string;
  active: boolean;
  disabled: boolean;
  onChoose: (id: string) => void;
};

export default function PlanSwitchDock({ plans, selectedId, active, disabled, onChoose }: Props) {
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pendingPlan = useRef("");
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wake = useCallback(() => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = null;
    setCollapsed(false);
    if (active && visible) {
      collapseTimer.current = setTimeout(() => {
        collapseTimer.current = null;
        setCollapsed(true);
      }, COLLAPSE_DELAY_MS);
    }
  }, [active, visible]);

  useEffect(() => {
    if (!active || !visible) {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
      setCollapsed(false);
      return;
    }
    wake();
    window.addEventListener("scroll", wake, { passive: true });
    return () => {
      window.removeEventListener("scroll", wake);
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    };
  }, [active, visible, wake]);

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
      const book = content.querySelector(".menu-details[open] .menu-book")?.getBoundingClientRect();
      const viewingBook = book && book.bottom > top && book.top < viewportBottom;
      setVisible(!editing && !viewingBook && picker.getBoundingClientRect().bottom <= top && beforeResults);
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

  return <nav className={"plan-switch-dock" + (collapsed ? " is-collapsed" : "")} aria-label="切換偏好方案" hidden={!active || !visible} aria-hidden={collapsed || undefined} onPointerDown={wake} onFocus={wake}>
    <div className="plan-switch-caption"><b>切換方案</b><span>已選偏好會保留</span></div>
    <div className="plan-switch-options">
      {plans.map(([id, plan]) => <button type="button" key={id} className="plan-switch-option" data-tone={plan.color}
        disabled={disabled} aria-pressed={id === selectedId} aria-controls="selection-content"
        aria-label={plan.code + "・" + plan.shortName + (id === selectedId ? "，目前選擇" : "，切換方案")}
        title={plan.title} onClick={() => {
          wake();
          if (id === selectedId) return;
          pendingPlan.current = id;
          onChoose(id);
        }}>
        <b aria-hidden="true">{plan.code}</b><span>{plan.shortName}</span><span className="plan-switch-check" aria-hidden="true">{id === selectedId ? "✓" : ""}</span>
      </button>)}
    </div>
  </nav>;
}
