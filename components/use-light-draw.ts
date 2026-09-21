"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createDrawTimeline, randomChoiceIndex } from "@/lib/light-draw";
import { startDrawSound } from "@/lib/light-draw-sound";

let stopActiveDraw: (() => void) | undefined;

export function useLightDraw(ids: string[], selectedId: string, disabled: boolean, onChoose: (id: string) => void) {
  const [rolling, setRolling] = useState(false), [litId, setLitId] = useState(""), [resultId, setResultId] = useState("");
  const [soundUnavailable, setSoundUnavailable] = useState(false);
  const running = useRef(false), mounted = useRef(false), sequence = useRef(0), frame = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const chooseRef = useRef(onChoose), initialSelection = useRef(selectedId);
  chooseRef.current = onChoose;
  const key = JSON.stringify(ids);
  const cancel = useCallback(() => {
    ++sequence.current;
    running.current = false;
    cancelAnimationFrame(frame.current);
    abort.current?.abort();
    abort.current = null;
    if (mounted.current) { setRolling(false); setLitId(""); }
    if (stopActiveDraw === cancel) stopActiveDraw = undefined;
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancel(); };
  }, [cancel]);
  useEffect(() => { cancel(); }, [key, disabled, cancel]);
  useEffect(() => {
    if (running.current && selectedId !== initialSelection.current) cancel();
  }, [selectedId, cancel]);
  useEffect(() => {
    const hide = () => { if (document.hidden) cancel(); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [cancel]);

  function choose(id: string) {
    cancel();
    setResultId("");
    chooseRef.current(id);
  }

  async function draw() {
    if (disabled || running.current || ids.length < 2) return;
    stopActiveDraw?.();
    cancel();
    stopActiveDraw = cancel;
    const token = ++sequence.current;
    const winner = randomChoiceIndex(ids.length);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const beats = reduced ? [{ id: ids[winner], at: 0 }] : createDrawTimeline(ids, selectedId, winner);
    initialSelection.current = selectedId;
    running.current = true;
    setRolling(true);
    setResultId("");
    setSoundUnavailable(false);
    const controller = new AbortController();
    abort.current = controller;
    const sound = await startDrawSound(beats, controller.signal);
    if (sequence.current !== token || !mounted.current) { sound?.stop(); return; }
    setSoundUnavailable(!sound);
    const started = performance.now();
    let shown = -1;
    const tick = () => {
      if (sequence.current !== token || !mounted.current) return;
      const time = sound ? sound.elapsed() : (performance.now() - started) / 1000;
      const current = beats.findLastIndex(beat => beat.at <= time);
      if (current >= 0 && current !== shown) { shown = current; setLitId(beats[current].id); }
      if (current === beats.length - 1) {
        running.current = false;
        setRolling(false);
        setResultId(ids[winner]);
        chooseRef.current(ids[winner]);
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }
  return { rolling, litId, resultId, soundUnavailable, choose, draw };
}
