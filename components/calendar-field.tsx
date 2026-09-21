"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { calendarDays, parseCalendarDate, shiftCalendarDate, shiftCalendarMonth, taipeiToday } from "@/lib/calendar";
type Props = { label: string; value: string; onChange: (value: string) => void; withTime?: boolean; required?: boolean; defaultDate?: string };
const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
export default function CalendarField({ label, value, onChange, withTime = false, required = false, defaultDate = "" }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [cursor, setCursor] = useState("");
  const [today, setToday] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focusDay = useRef(false);
  const date = value.slice(0,10);
  const time = value.slice(11) || "18:00";
  function close(restore = true) { setOpen(false); if (restore) trigger.current?.focus(); }
  function show() {
    const now = taipeiToday();
    const first = parseCalendarDate(date) ? date : parseCalendarDate(defaultDate) ? defaultDate : now;
    setToday(now); setMonth(first.slice(0,7));setCursor(first);focusDay.current = true;setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("pointerdown",outside);
    return () => document.removeEventListener("pointerdown",outside);
  }, [open]);
  useEffect(() => {
    if (open && focusDay.current) { panel.current?.querySelector<HTMLButtonElement>('[data-date="' + cursor + '"]')?.focus();focusDay.current = false; }
  }, [open, month, cursor]);
  function select(next: string) {
    onChange(next + (withTime ? "T" + time : ""));setCursor(next);setMonth(next.slice(0,7));
    if (!withTime) close();
  }
  function move(next: string) { focusDay.current = true;setMonth(next.slice(0,7));setCursor(next); }
  function onDayKey(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    const weekday = parseCalendarDate(day)!.getUTCDay();
    const next = event.key === "ArrowLeft" ? shiftCalendarDate(day,-1) : event.key === "ArrowRight" ? shiftCalendarDate(day,1) : event.key === "ArrowUp" ? shiftCalendarDate(day,-7) : event.key === "ArrowDown" ? shiftCalendarDate(day,7) : event.key === "Home" ? shiftCalendarDate(day,-weekday) : event.key === "End" ? shiftCalendarDate(day,6-weekday) : event.key === "PageUp" ? shiftCalendarMonth(day,event.shiftKey ? -12 : -1) : event.key === "PageDown" ? shiftCalendarMonth(day,event.shiftKey ? 12 : 1) : null;
    if (next) { event.preventDefault();move(next); }
  }
  const labelText = value ? date.replaceAll("-", " / ") + (withTime ? "　" + time : "") : withTime ? "不設截止時間" : "選擇日期";
  return <div className="calendar-field" ref={root} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <span id={id + "-label"} className="calendar-field-label">{label}</span>
    <button type="button" className={"calendar-trigger" + (open ? " is-open" : "")} id={id + "-trigger"} ref={trigger} aria-labelledby={id + "-label " + id + "-value"} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? id + "-popup" : undefined} onClick={() => open ? close() : show()}>
      <span id={id + "-value"}>{labelText}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M7 2v6M17 2v6M3 10h18M7 14h3M14 14h3M7 17h3"/></svg>
    </button>
    {required && !parseCalendarDate(date) && <small className="calendar-required">請選擇活動日期</small>}
    {open && <div className="calendar-popover" ref={panel} id={id + "-popup"} role="dialog" aria-labelledby={id + "-label"} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault();event.stopPropagation();close(); } }}>
      <div className="calendar-kicker">{withTime ? "VOTING DEADLINE" : "SAVE THE DATE"}<span>{withTime ? "台北時間" : "秋遊日"}</span></div>
      <div className="calendar-month"><button type="button" aria-label="上一個月" disabled={month === "1900-01"} onClick={() => { const next = shiftCalendarMonth(cursor,-1);setMonth(next.slice(0,7));setCursor(next); }}>‹</button><b aria-live="polite">{month.slice(0,4)}<small>年</small> {Number(month.slice(5))}<small>月</small></b><button type="button" aria-label="下一個月" disabled={month === "9999-12"} onClick={() => { const next = shiftCalendarMonth(cursor,1);setMonth(next.slice(0,7));setCursor(next); }}>›</button></div>
      <div className="calendar-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid" role="group" aria-label="選擇日期">{calendarDays(month).map(day => <button key={day} type="button" data-date={day} className={(day.slice(0,7) !== month ? "other-month " : "") + (day === date ? "is-selected " : "") + (day === today ? "is-today" : "")} disabled={!parseCalendarDate(day)} tabIndex={day === cursor ? 0 : -1} aria-pressed={day === date} aria-current={day === today ? "date" : undefined} aria-label={day.replaceAll("-","/") + " 星期" + weekdays[parseCalendarDate(day)?.getUTCDay() || 0]} onClick={() => select(day)} onKeyDown={event => onDayKey(event,day)}>{Number(day.slice(8))}</button>)}</div>
      {withTime && <div className="calendar-time"><b>截止時間</b><div><select aria-label="截止小時" value={time.slice(0,2)} onChange={event => onChange((parseCalendarDate(date) ? date : cursor) + "T" + event.target.value + ":" + time.slice(3))}>{Array.from({length:24},(_,i)=>String(i).padStart(2,"0")).map(hour=><option key={hour}>{hour}</option>)}</select><span>:</span><select aria-label="截止分鐘" value={time.slice(3)} onChange={event => onChange((parseCalendarDate(date) ? date : cursor) + "T" + time.slice(0,2) + ":" + event.target.value)}>{Array.from({length:60},(_,i)=>String(i).padStart(2,"0")).map(minute=><option key={minute}>{minute}</option>)}</select></div></div>}
      <div className="calendar-footer"><button type="button" onClick={() => select(taipeiToday())}>今天</button>{!required && <button type="button" onClick={() => { onChange("");close(); }}>不設截止</button>}<button type="button" className="calendar-done" onClick={() => close()}>完成</button></div>
    </div>}
  </div>;
}
