"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "./account-menu";
import type { ChoiceSupporter } from "@/lib/vote-summary";
export default function ChoiceAvatarPile({ people, total = people.length, label }: { people: ChoiceSupporter[]; total?: number; label: string }) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const pileRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const shown = people.slice(0, 5);
  const remaining = people.length - shown.length;
  function close(restoreFocus = false) {
    setOpen(false); setPosition(null);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current, panel = panelRef.current, pile = pileRef.current;
    if (!trigger || !panel || !pile) { setOpen(false); return; }
    function place() {
      const rect = trigger!.getBoundingClientRect();
      const width = Math.min(400, window.innerWidth - 32);
      const height = Math.min(panel!.scrollHeight, 460, window.innerHeight - 32);
      const left = Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16));
      const below = rect.bottom + 10;
      const top = below + height <= window.innerHeight - 16 ? below : Math.max(16, Math.min(rect.top - height - 10, window.innerHeight - height - 16));
      const theme = getComputedStyle(pile!);
      setPosition({ top, left, width, visibility: "visible", "--portrait-accent": theme.getPropertyValue("--rank-accent").trim() || "#9fb6ff", "--portrait-panel": theme.getPropertyValue("--rank-panel").trim() || "#172238", color: theme.color } as CSSProperties);
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, people.length]);
  useEffect(() => {
    if (open && position) closeRef.current?.focus({ preventScroll: true });
  }, [open, !!position]);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) close();
    }
    function escape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close(true); }
    }
    function scroll(event: Event) {
      if (!(event.target instanceof Node) || !panelRef.current?.contains(event.target)) close();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", scroll, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); window.removeEventListener("scroll", scroll, true); };
  }, [open]);
  if (!people.length) return null;
  return <>
    <span ref={pileRef} className="choice-avatar-pile" role="group" aria-label={label + "，" + total + " 人"}>
      {shown.map((person, index) => <button type="button" className="choice-supporter" key={person.photoURL + person.displayName + index} aria-label={person.displayName} aria-describedby={tooltipId + index} onClick={event => event.currentTarget.focus()}>
        <Avatar name={person.displayName} src={person.photoURL} />
        <span className="choice-supporter-name" id={tooltipId + index} role="tooltip">{person.displayName}</span>
      </button>)}
      {remaining > 0 && <button ref={triggerRef} type="button" className="choice-supporters-more" title={"查看全部 " + people.length + " 位隊友"} aria-label={"還有 " + remaining + " 人，查看全部 " + people.length + " 位隊友"} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? tooltipId + "-all" : undefined} onClick={() => open ? close(true) : setOpen(true)}>+{remaining}</button>}
    </span>
    {open && createPortal(<div ref={panelRef} id={tooltipId + "-all"} role="dialog" aria-modal="false" aria-labelledby={tooltipId + "-title"} aria-describedby={tooltipId + "-label"} className="choice-people-popover" style={position || { visibility: "hidden" }} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== triggerRef.current) close(); }}>
      <div className="choice-people-heading"><div><span>THE CREW</span><h3 id={tooltipId + "-title"}>全部隊友 <small>{people.length} 人</small></h3></div><button ref={closeRef} type="button" aria-label="關閉名單" onClick={() => close(true)}>×</button></div>
      <p id={tooltipId + "-label"} className="choice-people-label">{label}</p>
      <ul className="choice-people-list" tabIndex={0} aria-label="全部頭像與姓名">{people.map((person,index) => <li key={person.photoURL + person.displayName + index}><Avatar name={person.displayName} src={person.photoURL} /><span>{person.displayName}</span></li>)}</ul>
    </div>, document.body)}
  </>;
}
