import type { EconomyTier, ItemCategory } from "@/lib/types";

type CacheItem = {
  slot_type: "weapon" | "vitality" | "spirit";
  whitelist_bucket: string;
  name: string;
  normalized_name: string;
  raw: {
    id?: number;
    class_name?: string;
    description?: string | { desc?: string; text?: string };
    cost?: number;
  };
};

const tierMap: Record<string, EconomyTier | null> = {
  "800": 800,
  "1600": 1600,
  "3200": 3200,
  "6400": 6400,
  legendary: null,
};

const categoryMap: Record<CacheItem["slot_type"], ItemCategory> = {
  weapon: "gun",
  vitality: "vitality",
  spirit: "spirit",
};

export function normalizeCacheItems(items: CacheItem[]) {
  return items
    .map((entry) => {
      const tier = tierMap[entry.whitelist_bucket];
      if (!tier) return null;
      return {
        id: entry.raw.class_name ?? entry.normalized_name,
        name: entry.name,
        category: categoryMap[entry.slot_type],
        tier,
        baseCost: Number(entry.raw.cost ?? tier),
        effects: {
          weaponDamagePct: 0,
          fireRatePct: 0,
          clipSizePct: 0,
          reloadReductionPct: 0,
          bulletLifestealPct: 0,
          flatWeaponDamage: 0,
          flatBaseDamage: 0,
          damageAmplificationPct: 0,
          description:
            typeof entry.raw.description === "string"
              ? entry.raw.description
              : entry.raw.description?.desc ?? entry.raw.description?.text ?? "",
        },
      };
    })
    .filter((item) => Boolean(item));
}
