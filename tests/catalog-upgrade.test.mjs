import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const uri=s=>"data:text/javascript;base64,"+Buffer.from(s).toString("base64");
const compiled=file=>readFile(new URL("../.tools/admin-tests/"+file+".js",import.meta.url),"utf8");
const trips=uri(await compiled("trips")), bath=uri(await compiled("foot-bath"));
const { sortedGroups, sortedChoices, prepareVoteDetails, emptyDraft, voteDraftFromDetails, getVoteChange }=await import(trips);
const upgradeSource=(await compiled("catalog-upgrade")).replace('"./foot-bath"',JSON.stringify(bath)).replace('"./trips"',JSON.stringify(trips));
const { upgradeCatalog }=await import(uri(upgradeSource));
const old=()=>({updatedAt:100,settings:{},plans:{B:{groups:{g0:{label:"按摩",choices:{existing:{label:"已編輯的按摩",description:"第一行\n第二行",descriptionHighlights:[{start:0,end:3}],price:"123",order:0}}},g1:{label:"下午茶",choices:{tea:{label:"下午茶"}}}}}}});

test("legacy upgrade inserts four individual bath choices after massage without overwriting edited data",()=>{
 const catalog=old(),before=structuredClone(catalog),next=upgradeCatalog(catalog);
 assert.deepEqual(catalog,before);
 assert.equal(next.updatedAt,100);
 assert.equal(next.schemaVersion,2);
 assert.deepEqual(sortedGroups(next.plans.B).map(([id])=>id),["g0","footBath","g1"]);
 assert.deepEqual(next.plans.B.groups.g0.choices,before.plans.B.groups.g0.choices);
 const bath=next.plans.B.groups.footBath;
 assert.equal(bath.selectionMode,"individual");
 assert.equal(bath.collapsibleDescriptions,undefined);
 assert.match(bath.choices.beauty.ingredients,/丹參、紅花/);
 assert.deepEqual(sortedChoices(bath).map(([,c])=>c.label),["返老還童","貴妃美人","元氣十足","捻花惹草"]);
});

test("upgrade is idempotent and a later intentional removal stays removed",()=>{
 const first=upgradeCatalog(old());assert.equal(upgradeCatalog(first),first);
 delete first.plans.B.groups.footBath;assert.equal(upgradeCatalog(first).plans.B.groups.footBath,undefined);
 const existing=old();existing.plans.B.groups.footBath={label:"主辦已編輯的足湯",choices:{custom:{label:"自訂"}}};
 assert.deepEqual(upgradeCatalog(existing).plans.B.groups.footBath,existing.plans.B.groups.footBath);
 const noMassage={...old(),plans:{A:{groups:{}}}};assert.deepEqual(upgradeCatalog(noMassage).plans,noMassage.plans);
});

test("bath choice is stored with massage and afternoon tea and can be changed without another camp vote",()=>{
 const plan=upgradeCatalog(old()).plans.B;
 const draft={...emptyDraft,planId:"B",preferences:{g0:"existing",footBath:"energy",g1:"tea"}};
 const details=prepareVoteDetails(plan,draft);
 assert.deepEqual(details.preferences,draft.preferences);
 const saved={...details,updatedAt:101};assert.deepEqual(voteDraftFromDetails(saved).preferences,draft.preferences);
 const changed=prepareVoteDetails(plan,{...draft,preferences:{...draft.preferences,footBath:"flowers"}});
 assert.equal(getVoteChange(plan,{...draft,preferences:changed.preferences},"B",saved),"details");
 assert.deepEqual(prepareVoteDetails(plan,{...draft,preferences:{g0:"existing",footBath:"invalid"}}).preferences,{g0:"existing"});
 const legacy=voteDraftFromDetails({...saved,preferences:{g0:"existing"}});
 assert.equal(legacy.preferences.footBath,undefined);
});

test("v1 upgrade fills ingredients while retaining edits, blank ingredients, order and deliberate removal",()=>{
 const catalog=upgradeCatalog(old());catalog.schemaVersion=1;
 const bath=catalog.plans.B.groups.footBath;bath.collapsibleDescriptions=true;
 bath.choices.beauty.ingredients="";bath.choices.energy.ingredients="自訂材料";
 bath.choices.rejuvenate.label="自訂名稱";bath.choices.rejuvenate.order=3;
 delete bath.choices.rejuvenate.ingredients;
 const upgraded=upgradeCatalog(catalog).plans.B.groups.footBath;
 assert.equal(upgraded.collapsibleDescriptions,undefined);
 assert.equal(upgraded.choices.beauty.ingredients,"");
 assert.equal(upgraded.choices.energy.ingredients,"自訂材料");
 assert.equal(upgraded.choices.rejuvenate.label,"自訂名稱");
 assert.equal(upgraded.choices.rejuvenate.order,3);
 assert.match(upgraded.choices.rejuvenate.ingredients,/玄參/);
 delete catalog.plans.B.groups.footBath;
 assert.equal(upgradeCatalog(catalog).plans.B.groups.footBath,undefined);
});
