import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source=await readFile(new URL("../.tools/summary-tests/calendar.js",import.meta.url),"utf8");
const {parseCalendarDate,calendarDays,shiftCalendarDate,shiftCalendarMonth,taipeiToday,taipeiDeadline}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
test("calendar rejects impossible dates and preserves leap day",()=>{assert.ok(parseCalendarDate("2028-02-29"));for(const value of ["2026-02-29","2026-04-31","2026-13-01","2026-01-00","","2026-1-1"])assert.equal(parseCalendarDate(value),null);});
test("month changes clamp days and correctly cross years",()=>{assert.equal(shiftCalendarMonth("2026-01-31",1),"2026-02-28");assert.equal(shiftCalendarMonth("2028-01-31",1),"2028-02-29");assert.equal(shiftCalendarMonth("2026-01-31",-1),"2025-12-31");assert.equal(shiftCalendarDate("2026-12-31",1),"2027-01-01");});
test("calendar includes six full weeks starting on Sunday",()=>{const days=calendarDays("2026-10");assert.equal(days.length,42);assert.equal(days[0],"2026-09-27");assert.equal(days[41],"2026-11-07");assert.equal(new Set(days).size,42);assert.deepEqual(calendarDays("invalid"),[]);});
test("Taipei day and deadline are independent of host timezone and preserve minutes",()=>{assert.equal(taipeiToday(Date.parse("2026-09-21T17:30:00Z")),"2026-09-22");assert.equal(taipeiDeadline("2026-10-29T18:37"),Date.parse("2026-10-29T10:37:00Z"));assert.equal(taipeiDeadline(""),0);for(const value of ["2026-02-29T18:00","2026-10-29T24:00","2026-10-29T12:60"])assert.ok(Number.isNaN(taipeiDeadline(value)));});
