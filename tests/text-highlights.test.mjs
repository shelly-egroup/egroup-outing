import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../.tools/admin-tests/text-highlights.js", import.meta.url), "utf8");
const { normalizeHighlights, toggleHighlight, remapHighlights, highlightedParts } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

test("selection formatting merges overlaps and can remove just part of an underline", () => {
 const text="贈養生甜湯／花茶然茶禮盒 12 入組";
 const first=toggleHighlight(text,[],1,5);
 assert.deepEqual(first,[{start:1,end:5}]);
 assert.deepEqual(toggleHighlight(text,first,3,8),[{start:1,end:8}]);
 assert.deepEqual(toggleHighlight(text,[{start:1,end:8}],3,5),[{start:1,end:3},{start:5,end:8}]);
 assert.deepEqual(toggleHighlight(text,first,1,5),[]);
});

test("edits before a marked phrase shift it without marking unrelated text", () => {
 const before="按摩，贈養生甜湯，再喝茶";
 const mark=[{start:3,end:8}];
 const after="腳底"+before;
 const next=remapHighlights(before,after,mark);
 assert.equal(after.slice(next[0].start,next[0].end),"贈養生甜湯");
 assert.deepEqual(remapHighlights(after,before,next),mark);
 assert.deepEqual(remapHighlights(before,"按摩，再喝茶",mark),[]);
});

test("typing inside a highlight keeps the new words marked, while boundaries do not expand", () => {
 const before="ABCDEF", range=[{start:1,end:4}];
 assert.deepEqual(remapHighlights(before,"ABxxCDEF",range),[{start:1,end:6}]);
 assert.deepEqual(remapHighlights(before,"AxxBCDEF",range),[{start:3,end:6}]);
 assert.deepEqual(remapHighlights(before,"ABCDxxEF",range),range);
 assert.deepEqual(remapHighlights(before,"ABZEF",range),[{start:1,end:3}]);
});

test("old data, multiline selections, emoji and invalid stored ranges render as plain text parts", () => {
 const text="腳底 SPA 🧖\n贈甜湯＋禮盒";
 assert.deepEqual(highlightedParts(text),[{text,highlighted:false}]);
 const start=text.indexOf("贈"), ranges=[{start,end:text.length}];
 assert.equal(highlightedParts(text,ranges).map(p=>p.text).join(""),text);
 assert.equal(highlightedParts(text,ranges).find(p=>p.highlighted).text,"贈甜湯＋禮盒");
 assert.deepEqual(normalizeHighlights("abc",[{start:-4,end:2},{start:1,end:99},{start:NaN,end:2},{start:3,end:1}]),[{start:0,end:3}]);
 assert.deepEqual(remapHighlights(text,"",ranges),[]);
});
