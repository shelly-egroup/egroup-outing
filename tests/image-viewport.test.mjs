import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source=await readFile(new URL("../.tools/image-tests/image-viewport.js",import.meta.url),"utf8");
const {constrainViewport,zoomViewport}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const bounds={width:400,height:600,imageWidth:400,imageHeight:533};

test("zoom keeps the point under the user's fingers stationary",()=>{
 const origin={x:40,y:70},start={scale:1,x:0,y:0};
 const zoomed=zoomViewport(start,2,origin,origin,bounds);
 assert.deepEqual(zoomed,{scale:2,x:-40,y:-70});
 assert.deepEqual(zoomViewport(zoomed,1,origin,origin,bounds),start);
});
test("pinch can also move its midpoint without losing the image anchor",()=>{
 const next=zoomViewport({scale:2,x:20,y:-40},3,{x:50,y:10},{x:90,y:50},bounds);
 assert.equal((90-next.x)/next.scale,(50-20)/2);
 assert.equal((50-next.y)/next.scale,(10+40)/2);
});
test("panning is bounded, and an image smaller than the stage remains centered",()=>{
 assert.deepEqual(constrainViewport({scale:2,x:1000,y:-1000},bounds),{scale:2,x:200,y:-233});
 assert.equal(constrainViewport({scale:1.2,x:100,y:100},{...bounds,width:800}).x,0);
});
test("zoom limits reset to fit and never zoom beyond five times",()=>{
 assert.deepEqual(constrainViewport({scale:.5,x:20,y:30},bounds),{scale:1,x:0,y:0});
 assert.deepEqual(constrainViewport({scale:1.001,x:20,y:30},bounds),{scale:1,x:0,y:0});
 assert.equal(zoomViewport({scale:1,x:0,y:0},99,{x:0,y:0},{x:0,y:0},bounds).scale,5);
});
