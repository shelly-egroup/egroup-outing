import { footBathGroup } from "./foot-bath";
import { sortedGroups, type Catalog } from "./trips";

/** Upgrade old catalogs in memory; the next normal admin save persists the version. */
export function upgradeCatalog(catalog: Catalog): Catalog {
  if ((catalog.schemaVersion || 0) >= 2) return catalog;
  const next = structuredClone(catalog);
  next.schemaVersion = 2;
  const plan = next.plans.B;
  if (!plan?.groups?.g0) return next;
  if ((catalog.schemaVersion || 0) < 1 && !plan.groups.footBath) {
    const groups = sortedGroups(plan);
    groups.splice(groups.findIndex(([id]) => id === "g0") + 1, 0, ["footBath", structuredClone(footBathGroup)]);
    plan.groups = Object.fromEntries(groups.map(([id, group], order) => [id, { ...group, order }]));
  }
  const bath = plan.groups.footBath;
  if (bath) {
    delete bath.collapsibleDescriptions;
    for (const [id, choice] of Object.entries(bath.choices || {})) {
      const ingredients = footBathGroup.choices[id]?.ingredients;
      if (choice.ingredients === undefined && ingredients) choice.ingredients = ingredients;
    }
  }
  return next;
}
