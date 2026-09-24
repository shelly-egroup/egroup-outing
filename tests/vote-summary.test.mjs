import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const uri = text => "data:text/javascript;base64," + Buffer.from(text).toString("base64");
const trips = uri(await readFile(new URL("../.tools/summary-tests/trips.js",import.meta.url),"utf8"));
const source = (await readFile(new URL("../.tools/summary-tests/vote-summary.js",import.meta.url),"utf8")).replace('from "./trips"', 'from "' + trips + '"');
const { choiceSupporterLists, preferenceTallies, organizerSnapshot, anonymousChoiceSummary, publicChoiceResults, choiceSourceVersion, matchesRosterSearch, organizerSummaryText } = await import(uri(source));
const { choiceGroupMode } = await import(trips);
const choice = label => ({label,description:"",price:""});
const groups = { g0:{label:"午餐",choices:{ c0:choice("餐廳甲"), c1:choice("餐廳乙"), c2:choice("餐廳丙") }} };
const plan = (code,group=groups) => ({code,title:code+"方案",shortName:code+"派",category:"",description:"",priceNote:"",color:code==="A"?"yellow":"coral",tags:[],schedule:[],groups:group,order:code==="A"?0:1,active:true});
const catalog = {settings:{title:"秋遊",eventDate:"2026-10-29",expectedVoters:12,votingOpen:true,closesAt:0},plans:{A:plan("A"),B:plan("B")},updatedAt:9};
const vote = (planId="A",t=100) => ({planId,displayName:"PRIVATE_NAME",photoURL:"PRIVATE_PHOTO",updatedAt:t});
const detail = (planId="A",preferences={g0:"c0"},other={}) => ({planId,preferences,note:"",familyCount:0,familyNote:"",updatedAt:100,...other});
test("counts one choice per voter without weighting companions or another camp",()=>{
 const votes={a:vote(),b:vote(),c:vote("B")};const details={a:detail("A",{g0:"c0"},{familyCount:9}),b:detail("A",{g0:"c1"}),c:detail("B")};
 const [g]=preferenceTallies("A",catalog.plans.A,votes,details);
 assert.equal(g.total,2);assert.equal(g.selected,2);assert.equal(g.high,1);assert.deepEqual(g.leaders,["餐廳甲","餐廳乙"]);assert.equal(g.choices[0].percent,50);
});
test("blank, stale, missing and deleted choices are distinguished and conserve voter count",()=>{
 const votes={a:vote(),b:vote(),c:vote(),d:vote(),e:vote(),f:vote()};
 const details={a:detail(),b:detail("A",{}),c:detail("A",{g0:"deleted"}),d:detail("B"),e:detail("A",{g0:"c0"},{updatedAt:99})};
 const [g]=preferenceTallies("A",catalog.plans.A,votes,details);
 assert.equal(g.selected,1);assert.equal(g.arranged,1);assert.equal(g.removed,1);assert.equal(g.unknown,3);assert.equal(g.selected+g.arranged+g.removed+g.unknown,g.total);
});
test("switching camps removes the previous choice and ignores stale details",()=>{
 const votes={a:vote("B",101)};const stale={a:detail()};
 assert.equal(preferenceTallies("A",catalog.plans.A,votes,stale)[0].total,0);
 assert.equal(preferenceTallies("B",catalog.plans.B,votes,stale)[0].unknown,1);
 const current={a:detail("B",{g0:"c1"},{updatedAt:101})};
 assert.equal(preferenceTallies("B",catalog.plans.B,votes,current)[0].choices.find(c=>c.count===1).id,"c1");
});
test("zero votes do not invent a leader",()=>{
 const [g]=preferenceTallies("A",catalog.plans.A,{},{});assert.equal(g.high,0);assert.deepEqual(g.leaders,[]);assert.ok(g.choices.every(c=>!c.leading));
});
test("organizer totals explain legacy details and ignore whitespace or hidden family notes",()=>{
 const votes={a:vote(),b:vote(),c:vote(),d:vote()};const details={a:detail("A",{},{familyCount:undefined}),b:detail("A",{},{note:"  ",familyNote:"hidden"}),c:detail("A",{},{familyCount:2,familyNote:"帶小孩"})};
 const s=organizerSnapshot(catalog,votes,details);assert.equal(s.total,4);assert.equal(s.guests,2);assert.equal(s.attendees,6);assert.equal(s.incomplete,2);assert.equal(s.notes.length,1);assert.equal(s.rows.find(r=>r.uid==="b").pendingReason,"");assert.match(s.rows.find(r=>r.uid==="a").pendingReason,/舊資料/);assert.match(s.rows.find(r=>r.uid==="d").pendingReason,/同步/);
});
test("anonymous payload is a strict aggregate with no identity or private note fields",()=>{
 const payload=anonymousChoiceSummary(catalog,{PRIVATE_UID:vote()},{PRIVATE_UID:detail("A",{g0:"c1"},{note:"PRIVATE_NOTE",familyNote:"PRIVATE_FAMILY",familyCount:5,email:"PRIVATE_EMAIL"})});
 const json=JSON.stringify(payload);for(const secret of ["PRIVATE_UID","PRIVATE_NAME","PRIVATE_PHOTO","PRIVATE_NOTE","PRIVATE_FAMILY","PRIVATE_EMAIL"]) assert.ok(!json.includes(secret));
 assert.deepEqual(Object.keys(payload).sort(),["plans","version"]);
 const groupKeys=["arranged","choices","high","id","label","leaders","mode","removed","selected","total","unknown"];
 for(const groups of Object.values(payload.plans))for(const group of groups){assert.deepEqual(Object.keys(group).sort(),groupKeys);for(const c of group.choices)assert.deepEqual(Object.keys(c).sort(),["count","id","label","leading","percent"]);}
});
test("source version changes for a vote or catalog change but not object order",()=>{
 const votes={a:vote(),b:vote("B")};const first=choiceSourceVersion(catalog,votes);
 assert.equal(first,choiceSourceVersion(catalog,{b:votes.b,a:votes.a}));assert.notEqual(first,choiceSourceVersion(catalog,{...votes,a:vote("A",101)}));assert.notEqual(first,choiceSourceVersion({...catalog,updatedAt:10},votes));
});
test("email search is case-insensitive, partial, trimmed and safe while loading",()=>{
 assert.equal(matchesRosterSearch(" SHELLY@ ","同事","Shelly@example.test"),true);assert.equal(matchesRosterSearch("example.test",undefined,null,"Shelly@example.test"),true);assert.equal(matchesRosterSearch("none",undefined,null),false);assert.equal(matchesRosterSearch("  ",undefined),true);
});
test("massage defaults to individual arrangements in old and new catalogs",()=>{
 assert.equal(choiceGroupMode("B","g0",groups.g0),"individual");assert.equal(choiceGroupMode("A","g0",groups.g0),"group");assert.equal(choiceGroupMode("B","g0",{...groups.g0,selectionMode:"group"}),"group");assert.equal(choiceGroupMode("C","custom",{...groups.g0,selectionMode:"individual"}),"individual");assert.equal(preferenceTallies("B",catalog.plans.B,{},{} )[0].mode,"individual");
});
test("copied organizer summary contains individual selections and explanatory notes",()=>{
 const summary=organizerSummaryText(catalog,{a:vote("B")},{a:detail("B",{g0:"c1"},{note:"稍晚到",familyCount:1})});assert.match(summary,/各自選擇：餐廳乙 1 人/);assert.match(summary,/PRIVATE_NAME：稍晚到/);assert.match(summary,/家眷 1 位/);assert.ok(summary.includes("\n"));
});

test("option portraits contain only names and photos of matching current voters",()=>{
 const votes={a:vote(),b:vote(),c:vote("B"),d:vote(),e:vote(),f:vote()};
 const details={a:detail("A",{g0:"c1"},{note:"PRIVATE_NOTE",familyCount:9,familyNote:"PRIVATE_FAMILY",email:"PRIVATE_EMAIL"}),b:detail("A",{}),c:detail("B",{g0:"c0"}),d:detail("A",{g0:"deleted"}),e:detail("B"),f:detail("A",{g0:"c1"},{updatedAt:99})};
 const result=publicChoiceResults(catalog,votes,details);
 assert.deepEqual(result.supporters.A.g0,{c1:[{displayName:"PRIVATE_NAME",photoURL:"PRIVATE_PHOTO"}]});
 assert.deepEqual(result.supporters.B.g0,{c0:[{displayName:"PRIVATE_NAME",photoURL:"PRIVATE_PHOTO"}]});
 for(const groups of Object.values(result.supporters))for(const choices of Object.values(groups))for(const people of Object.values(choices))for(const person of people)assert.deepEqual(Object.keys(person).sort(),["displayName","photoURL"]);
 const json=JSON.stringify(result);for(const value of ["PRIVATE_NOTE","PRIVATE_FAMILY","PRIVATE_EMAIL"])assert.ok(!json.includes(value));
});
test("all portraits remain available for paging in vote order",()=>{
 const votes={},details={};for(let i=0;i<8;i++){votes["uid_"+i]={...vote("A",100+i),displayName:"name"+i};details["uid_"+i]=detail("A",{g0:"c0"},{updatedAt:100+i});}
 const result=publicChoiceResults(catalog,votes,details);
 assert.equal(result.plans.A[0].choices.find(c=>c.id==="c0").count,8);
 assert.deepEqual(result.supporters.A.g0.c0.map(p=>p.displayName),["name7","name6","name5","name4","name3","name2","name1","name0"]);
 assert.ok(!JSON.stringify(result).includes("uid_"));
});

test("organizer-arranged portraits match blank preferences without including stale or deleted choices",()=>{
 const votes={blank:vote(),selected:vote(),deleted:vote(),stale:vote(),other:vote("B"),missing:vote()};
 const details={blank:detail("A",{},{note:"PRIVATE_NOTE",familyNote:"PRIVATE_FAMILY"}),selected:detail(),deleted:detail("A",{g0:"removed"}),stale:detail("A",{},{updatedAt:99}),other:detail("B",{})};
 const result=publicChoiceResults(catalog,votes,details);
 assert.equal(result.plans.A[0].arranged,1);assert.equal(result.arrangedSupporters.A.g0.length,1);assert.equal(result.arrangedSupporters.B.g0.length,1);
 assert.deepEqual(result.arrangedSupporters.A.g0[0],{displayName:"PRIVATE_NAME",photoURL:"PRIVATE_PHOTO"});
 const json=JSON.stringify(result.arrangedSupporters);assert.ok(!json.includes("PRIVATE_NOTE"));assert.ok(!json.includes("PRIVATE_FAMILY"));
});


test("organizer massage names match current choices and copied summary identifies assigned people", () => {
 const massage = { ...catalog, plans: { ...catalog.plans, B: plan("B", { g0: { label: "按摩想選哪一種？", selectionMode: "individual", choices: { spa: choice("精油 SPA・60 分鐘"), foot: choice("腳底按摩・80 分鐘") } } }) } };
 const votes = { a: { ...vote("B"), displayName: "小安" }, b: { ...vote("B"), displayName: "小柏" }, blank: { ...vote("B"), displayName: "小岑" }, stale: { ...vote("B", 101), displayName: "不同步" }, switched: { ...vote("A", 101), displayName: "已改派" } };
 const details = { a: detail("B", { g0: "spa" }, { familyCount: 3 }), b: detail("B", { g0: "spa" }), blank: detail("B", {}), stale: detail("B", { g0: "foot" }), switched: detail("B", { g0: "spa" }) };
 const lists = choiceSupporterLists(massage, votes, details);
 assert.deepEqual(lists.supporters.B.g0.spa.map(p => p.displayName), ["小安", "小柏"]);
 assert.equal(lists.supporters.B.g0.foot, undefined);
 assert.deepEqual(lists.arrangedSupporters.B.g0.map(p => p.displayName), ["小岑"]);
 const line = organizerSummaryText(massage, votes, details).split("\n").find(line => line.startsWith("按摩想選"));
 assert.match(line, /精油 SPA・60 分鐘 2 人（小安、小柏）/);
 assert.match(line, /主辦安排 1 人（小岑）/);
 assert.ok(!line.includes("不同步"));
 assert.ok(!line.includes("已改派"));
});

test("organizer lists and copied selections retain every participant above five", () => {
 const votes = {}, details = {};
 for (let i = 0; i < 7; i++) { votes["p" + i] = { ...vote("B"), displayName: "同事" + i }; details["p" + i] = detail("B", { g0: "c0" }); }
 const members = choiceSupporterLists(catalog, votes, details).supporters.B.g0.c0;
 assert.equal(members.length, 7);
 const line = organizerSummaryText(catalog, votes, details).split("\n").find(line => line.includes("各自選擇："));
 for (const person of members) assert.ok(line.includes(person.displayName));
 assert.match(line, /7 人/);
});

test("public and organizer results retain configured order as vote counts change", () => {
 const p = plan("B");
 p.groups = structuredClone(groups);
 p.groups.g0.choices.c0.order = 2;
 p.groups.g0.choices.c1.order = 0;
 p.groups.g0.choices.c2.order = 1;
 const votes = {a:vote("B"),b:vote("B")};
 const details = {a:detail("B",{g0:"c0"}),b:detail("B",{g0:"c1"})};
 const configured = {...catalog, plans:{B:p}};
 for (const snapshot of [details, {...details, b:detail("B",{g0:"c0"})}]) {
  const publicGroup = publicChoiceResults(configured,votes,snapshot).plans.B[0];
  const adminGroup = organizerSnapshot(configured,votes,snapshot).plans[0].groups[0];
  assert.deepEqual(publicGroup.choices.map(c=>c.id), ["c1","c2","c0"]);
  assert.deepEqual(adminGroup.choices, publicGroup.choices);
  assert.equal(publicGroup.choices.reduce((sum,c)=>sum+c.count,0),2);
 }
 const final = publicChoiceResults(configured,votes,{...details,b:detail("B",{g0:"c0"})}).plans.B[0];
 assert.deepEqual(final.leaders,["餐廳甲"]);
 assert.deepEqual(final.choices.map(c=>[c.id,c.count,c.leading]),[["c1",0,false],["c2",0,false],["c0",2,true]]);
});
test("foot-bath choices appear in public totals and organizer participant lists", () => {
 const bath={label:"足湯の底四選一",selectionMode:"individual",choices:{energy:choice("元氣十足"),flowers:choice("捻花惹草")}};
 const configured={...catalog,plans:{B:plan("B",{g0:groups.g0,footBath:bath})}};
 const votes={a:{...vote("B"),displayName:"小安"},b:{...vote("B"),displayName:"小柏"},legacy:vote("B")};
 const details={a:detail("B",{g0:"c0",footBath:"energy"},{familyCount:2}),b:detail("B",{g0:"c1",footBath:"flowers"}),legacy:detail("B",{g0:"c0"})};
 const result=publicChoiceResults(configured,votes,details);
 const group=result.plans.B.find(g=>g.id==="footBath");
 assert.equal(group.mode,"individual");assert.equal(group.selected,2);assert.equal(group.arranged,1);
 assert.deepEqual(group.choices.map(c=>c.count),[1,1]);
 assert.deepEqual(result.supporters.B.footBath.energy.map(p=>p.displayName),["小安"]);
 assert.deepEqual(result.supporters.B.footBath.flowers.map(p=>p.displayName),["小柏"]);
 assert.match(organizerSummaryText(configured,votes,details),/足湯の底四選一｜各自選擇：元氣十足 1 人（小安）/);
});
