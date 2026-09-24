"use client";
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties } from "react";

type Item = { id: string; label: string };
type Drag = { from: number; to: number; pointer: number; startY: number; startScroll: number; y: number; offset: number; moved: boolean; handle: HTMLButtonElement };

/** Pointer handles support mouse/touch; arrow keys and visible buttons remain available. */
export function useReorder(items: Item[], onMove: (from: number, to: number) => void, disabled = false) {
  const list = useRef<HTMLElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const frame = useRef(0);
  const [visual, setVisual] = useState<{ from: number; to: number; offset: number } | null>(null);
  const [message, setMessage] = useState("");
  const helpId = useId();
  const signature = items.map(item => item.id).join("|");

  function stop() {
    cancelAnimationFrame(frame.current);
    const current = drag.current;
    drag.current = null;
    if (current?.handle.hasPointerCapture(current.pointer)) current.handle.releasePointerCapture(current.pointer);
    setVisual(null);
  }
  useEffect(() => {
    stop();
    return () => { cancelAnimationFrame(frame.current); drag.current = null; };
  }, [disabled, signature]);

  function move(from: number, to: number) {
    if (disabled || from === to || to < 0 || to >= items.length) return;
    onMove(from, to);
    setMessage("已將「" + items[from].label + "」移至第 " + (to + 1) + " 項，共 " + items.length + " 項。");
    requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>('[data-reorder-index="' + to + '"] .reorder-handle')?.focus({ preventScroll: true }));
  }
  function update() {
    const current = drag.current;
    if (!current?.moved || !list.current) return;
    const rows = Array.from(list.current.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node.hasAttribute("data-reorder-index"));
    current.to = rows.filter(row => Number(row.dataset.reorderIndex) !== current.from && current.y > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2).length;
    current.offset = current.y - current.startY + window.scrollY - current.startScroll;
    setVisual({ from: current.from, to: current.to, offset: current.offset });
  }
  function autoScroll() {
    const current = drag.current;
    if (!current) return;
    if (current.moved) {
      const edge = 88;
      const delta = current.y < edge ? -Math.min(14, (edge - current.y) / 4) : current.y > window.innerHeight - edge ? Math.min(14, (current.y - window.innerHeight + edge) / 4) : 0;
      if (delta) { window.scrollBy({ top: delta, behavior: "instant" }); update(); }
    }
    frame.current = requestAnimationFrame(autoScroll);
  }
  function handleProps(index: number): ButtonHTMLAttributes<HTMLButtonElement> {
    return {
      type: "button", className: "reorder-handle", disabled: disabled || items.length < 2,
      "aria-label": "拖曳排序：" + items[index].label, "aria-describedby": helpId,
      title: "拖曳調整順序，也可使用鍵盤上下方向鍵", "aria-keyshortcuts": "ArrowUp ArrowDown Home End",
      onPointerDown: event => {
        if (disabled || items.length < 2 || !event.isPrimary || event.button !== 0 || event.currentTarget.matches(":disabled")) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { from: index, to: index, pointer: event.pointerId, startY: event.clientY, startScroll: window.scrollY, y: event.clientY, offset: 0, moved: false, handle: event.currentTarget };
        setMessage("正在移動「" + items[index].label + "」，放開即可放置，按 Escape 取消。");
        frame.current = requestAnimationFrame(autoScroll);
      },
      onPointerMove: event => {
        const current = drag.current;
        if (!current || current.pointer !== event.pointerId) return;
        current.y = event.clientY;
        if (Math.abs(current.y - current.startY) > 5) current.moved = true;
        update();
      },
      onPointerUp: event => {
        const current = drag.current;
        if (!current || current.pointer !== event.pointerId) return;
        const { from, to, moved } = current;
        stop();
        if (moved && !event.currentTarget.matches(":disabled")) move(from, to);
        else setMessage("");
      },
      onPointerCancel: () => { stop(); setMessage("已取消移動。"); },
      onLostPointerCapture: () => { if (drag.current) { stop(); setMessage("已取消移動。"); } },
      onKeyDown: event => {
        if (event.key === "Escape" && drag.current) { event.preventDefault(); stop(); setMessage("已取消移動。"); return; }
        const target = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
        if (target !== null && !drag.current) { event.preventDefault(); move(index, target); }
      },
      onClick: event => event.preventDefault(),
    };
  }
  function rowProps(index: number) {
    return {
      "data-reorder-index": index,
      "data-reorder-state": visual?.from === index ? "dragging" : visual?.to === index && visual.from !== index ? (visual.to < visual.from ? "before" : "after") : undefined,
      style: visual?.from === index ? { "--reorder-offset": visual.offset + "px" } as CSSProperties : undefined,
    };
  }
  return { listRef: (node: HTMLElement | null) => { list.current = node; }, handleProps, rowProps, move,
    feedback: <><span id={helpId} className="sr-only">拖曳把手來排序，或聚焦把手後按上下方向鍵；拖曳時可按 Escape 取消。</span><span className="sr-only" role="status" aria-live="polite">{message}</span></> };
}

export function ReorderGrip() {
  return <svg aria-hidden="true" width="16" height="20" viewBox="0 0 16 20" fill="currentColor"><circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" /><circle cx="5" cy="10" r="1.5" /><circle cx="11" cy="10" r="1.5" /><circle cx="5" cy="16" r="1.5" /><circle cx="11" cy="16" r="1.5" /></svg>;
}
