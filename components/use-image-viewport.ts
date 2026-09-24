"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { constrainViewport, fittedViewport, zoomViewport, type ImagePoint, type ImageViewport } from "@/lib/image-viewport";

type Gesture = { origin: ImagePoint; view: ImageViewport; distance: number; pinched: boolean };
export function useImageViewport(open: boolean, onTurn: (direction: -1 | 1) => void, onInteract: () => void) {
  const stageRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLSpanElement>(null);
  const current = useRef<ImageViewport>({ ...fittedViewport });
  const [view, setView] = useState<ImageViewport>(current.current);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, ImagePoint>());
  const gesture = useRef<Gesture | null>(null);
  const hadPinch = useRef(false);
  const callbacks = useRef({ onTurn, onInteract });
  useLayoutEffect(() => { callbacks.current = { onTurn, onInteract }; }, [onTurn, onInteract]);
  const bounds = useCallback(() => ({ width: stageRef.current?.clientWidth || 0, height: stageRef.current?.clientHeight || 0, imageWidth: sheetRef.current?.offsetWidth || 0, imageHeight: sheetRef.current?.offsetHeight || 0 }), []);
  const commit = useCallback((next: ImageViewport) => {
    current.current = constrainViewport(next, bounds());
    setView(current.current);
  }, [bounds]);
  const reset = useCallback(() => {
    pointers.current.clear(); gesture.current = null; hadPinch.current = false;
    setDragging(false); current.current = { ...fittedViewport }; setView(current.current);
  }, []);
  const localPoint = useCallback((clientX: number, clientY: number) => {
    const rect = stageRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }, []);
  const zoomAt = useCallback((scale: number, point: ImagePoint = { x: 0, y: 0 }) => {
    callbacks.current.onInteract();
    commit(zoomViewport(current.current, scale, point, point, bounds()));
  }, [bounds, commit]);

  useEffect(() => {
    if (!open) { reset(); return; }
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => commit(current.current));
    observer.observe(stage);
    function wheel(event: WheelEvent) {
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage!.clientHeight : 1;
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const delta = Math.max(-150, Math.min(150, event.deltaY * unit));
        zoomAt(current.current.scale * Math.exp(-delta * .005), localPoint(event.clientX, event.clientY));
      } else if (current.current.scale > 1) {
        event.preventDefault();
        const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
        const dy = event.shiftKey && !event.deltaX ? 0 : event.deltaY;
        commit({ ...current.current, x: current.current.x - dx * unit, y: current.current.y - dy * unit });
      }
    }
    stage.addEventListener("wheel", wheel, { passive: false });
    return () => { observer.disconnect(); stage.removeEventListener("wheel", wheel); };
  }, [open, reset, commit, zoomAt, localPoint]);

  function rebase() {
    const points = [...pointers.current.values()];
    if (!points.length) { gesture.current = null; hadPinch.current = false; setDragging(false); return; }
    const pinched = points.length >= 2;
    if (pinched) hadPinch.current = true;
    gesture.current = {
      origin: pinched ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : points[0],
      distance: pinched ? Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)) : 0,
      view: { ...current.current }, pinched,
    };
    setDragging(current.current.scale > 1 || pinched);
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    callbacks.current.onInteract();
    stageRef.current?.focus({ preventScroll: true });
    pointers.current.set(event.pointerId, localPoint(event.clientX, event.clientY));
    event.currentTarget.setPointerCapture(event.pointerId);
    rebase();
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, localPoint(event.clientX, event.clientY));
    const points = [...pointers.current.values()], start = gesture.current;
    if (points.length >= 2 && start.pinched) {
      const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      commit(zoomViewport(start.view, start.view.scale * distance / start.distance, start.origin, midpoint, bounds()));
    } else if (start.view.scale > 1) {
      commit({ ...start.view, x: start.view.x + points[0].x - start.origin.x, y: start.view.y + points[0].y - start.origin.y });
    }
  }
  function pointerEnd(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    if (!pointers.current.has(event.pointerId)) return;
    const start = gesture.current;
    let direction: -1 | 1 | null = null;
    if (!cancelled && pointers.current.size === 1 && start && !hadPinch.current && start.view.scale === 1 && current.current.scale === 1) {
      const end = localPoint(event.clientX, event.clientY), dx = end.x - start.origin.x, dy = end.y - start.origin.y;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.25) direction = dx < 0 ? 1 : -1;
    }
    pointers.current.delete(event.pointerId); rebase();
    if (direction) callbacks.current.onTurn(direction);
  }
  function keyDown(event: KeyboardEvent) {
    if (!open || event.altKey) return false;
    if (event.ctrlKey || event.metaKey) {
      const plus = event.key === "+" || event.key === "=" || event.code === "NumpadAdd";
      const minus = event.key === "-" || event.code === "NumpadSubtract";
      if (!plus && !minus && event.key !== "0") return false;
      event.preventDefault(); event.stopPropagation();
      if (event.key === "0") reset(); else zoomAt(current.current.scale * (plus ? 1.25 : .8));
      return true;
    }
    if (current.current.scale > 1 && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      commit({ ...current.current, x: current.current.x + (event.key === "ArrowLeft" ? 48 : event.key === "ArrowRight" ? -48 : 0), y: current.current.y + (event.key === "ArrowUp" ? 48 : event.key === "ArrowDown" ? -48 : 0) });
      return true;
    }
    return false;
  }
  return {
    stageRef, sheetRef, scale: view.scale, zoomed: view.scale > 1, dragging, reset, keyDown,
    toggle: () => { callbacks.current.onInteract(); if (current.current.scale > 1) reset(); else zoomAt(2.5); },
    style: { "--image-scale": view.scale, "--image-x": view.x + "px", "--image-y": view.y + "px" } as CSSProperties,
    handlers: {
      onPointerDown: pointerDown, onPointerMove: pointerMove,
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => pointerEnd(event),
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) => pointerEnd(event, true),
      onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => pointerEnd(event, true),
      onDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => { if (current.current.scale > 1) reset(); else zoomAt(2.5, localPoint(event.clientX, event.clientY)); },
    },
  };
}
