import { footBathGroup } from "./foot-bath";
import { sortedGroups, type Catalog } from "./trips";

const latestSchemaVersion = 4;
const legacyFishingPrice = "釣蝦與餐費待確認";
const fishingPrice = "釣蝦 1 小時 $400 起・村民食堂 $720＋10%";

/** Upgrade old catalogs in memory; the next normal admin save persists the version. */
export function upgradeCatalog(catalog: Catalog): Catalog {
  const version = catalog.schemaVersion || 0;
  if (version >= latestSchemaVersion) return catalog;
  const next = structuredClone(catalog);
  const planB = next.plans.B;
  if (version < 2 && planB?.groups?.g0) {
    if (version < 1 && !planB.groups.footBath) {
      const groups = sortedGroups(planB);
      groups.splice(groups.findIndex(([id]) => id === "g0") + 1, 0, ["footBath", structuredClone(footBathGroup)]);
      planB.groups = Object.fromEntries(groups.map(([id, group], order) => [id, { ...group, order }]));
    }
    const bath = planB.groups.footBath;
    if (bath) {
      delete bath.collapsibleDescriptions;
      for (const [id, choice] of Object.entries(bath.choices || {})) {
        const ingredients = footBathGroup.choices[id]?.ingredients;
        if (choice.ingredients === undefined && ingredients) choice.ingredients = ingredients;
      }
    }
  }
  if (next.plans.A?.priceNote === legacyFishingPrice) next.plans.A.priceNote = fishingPrice;
  next.schemaVersion = latestSchemaVersion;
  return next;
}
