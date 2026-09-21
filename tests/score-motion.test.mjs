import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const uri = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const math = uri(await readFile(new URL("../.tools/score-tests/lib/score-motion.js",import.meta.url),"utf8"));
const source = (await readFile(new URL("../.tools/score-tests/components/use-score-motion.js",import.meta.url),"utf8")).replace(/import \{[^}]+\} from "react";/,'const {useEffect,useRef,useState} = globalThis.__scoreHooks;').replace('from "../lib/score-motion"','from "' + math + '"');
async function harness(t) {
 const slots=[];let index=0,setup,cleanup,clock=0,nextFrame=0;const frames=new Map();
 const originals={performance:globalThis.performance,window:globalThis.window,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
 globalThis.performance={now:()=>clock};globalThis.window={matchMedia:()=>({matches:false})};globalThis.requestAnimationFrame=callback=>{const id=++nextFrame;frames.set(id,callback);return id;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 globalThis.__scoreHooks={useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==="function"?value(slots[i]):value;}];},useRef(initial){const i=index++;if(!(i in slots))slots[i]={current:initial};return slots[i];},useEffect(callback){setup=callback;}};
 const {useScoreMotion}=await import(uri(source+'\n// '+Math.random()));
 t.after(()=>{cleanup?.();Object.assign(globalThis,originals);delete globalThis.__scoreHooks;});
 return {render(...args){index=0;return useScoreMotion(...args);},setup(){cleanup=setup();},cleanup(){cleanup?.();cleanup=undefined;},advance(ms){clock+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(clock));},frames,reduce(){globalThis.window.matchMedia=()=>({matches:true});}};
}
test("active mount survives setup-cleanup-setup without freezing at zero",async t=>{
 const h=await harness(t);h.render(1,100,true,true);h.setup();h.cleanup();h.setup();h.advance(1200);
 const value=h.render(1,100,true,true);assert.equal(value.count,1);assert.equal(value.percent,100);assert.equal(value.delta,0);
});
test("an interrupted update resumes toward the real score",async t=>{
 const h=await harness(t);h.render(1,50,true,true);h.setup();h.advance(1200);h.cleanup();h.render(3,75,true,true);h.setup();h.advance(100);h.cleanup();h.setup();h.advance(1200);
 const value=h.render(3,75,true,true);assert.equal(value.count,3);assert.equal(value.percent,75);
});
test("off-screen or reduced-motion scores always settle to actual values",async t=>{
 const h=await harness(t);h.render(2,40,false,true);h.setup();assert.equal(h.render(2,40,false,true).count,2);h.cleanup();h.reduce();h.render(4,80,true,true);h.setup();assert.equal(h.render(4,80,true,true).count,4);assert.equal(h.frames.size,0);
});
