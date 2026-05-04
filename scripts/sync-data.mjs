import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const cacheJsonPath = path.join(projectRoot, "src/lib/data/cache/deadlock_items.json");
const cacheCsvPath = path.join(projectRoot, "src/lib/data/cache/deadlock_items.csv");
const outputPath = path.join(projectRoot, "src/lib/data/cache/deadlock_items_app.json");

function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  const asString = String(value);
  const cleaned = asString.replace(/[^0-9+\-\.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function usageFlags(prop) {
  if (!prop || !Array.isArray(prop.usage_flags)) return [];
  return prop.usage_flags.map((flag) => String(flag));
}

function hasModeledEffects(effects) {
  return Boolean(
    effects.weaponDamagePct ||
      effects.fireRatePct ||
      effects.clipSizePct ||
      effects.reloadReductionPct ||
      effects.bulletLifestealPct ||
      effects.flatWeaponDamage ||
      effects.flatBaseDamage ||
      effects.damageAmplificationPct
  );
}

function emptyEffects(description = "") {
  return {
    weaponDamagePct: 0,
    fireRatePct: 0,
    clipSizePct: 0,
    reloadReductionPct: 0,
    bulletLifestealPct: 0,
    flatWeaponDamage: 0,
    flatBaseDamage: 0,
    damageAmplificationPct: 0,
    description,
  };
}

function mapStatKey(rawName) {
  const key = String(rawName ?? "").toLowerCase();
  if (!key) return null;

  if (
    key.includes("baseattackdamagepercent") ||
    key.includes("weaponpower") ||
    key.includes("bonusweaponpower") ||
    key.includes("nonplayerbonusweaponpower")
  ) {
    return "weaponDamagePct";
  }
  if (key.includes("bonusfirerate") || key.includes("activatedfirerate") || key.includes("ambushbonusfirerate")) {
    return "fireRatePct";
  }
  if (key.includes("bonusclipsizepercent") || key.includes("bonusclipsize")) {
    return "clipSizePct";
  }
  if (
    key.includes("ammoreloadpercent") ||
    key.includes("reloadreductionpercent") ||
    key.includes("activereloadpercent")
  ) {
    return "reloadReductionPct";
  }
  if (key.includes("bulletlifestealpercent")) {
    return "bulletLifestealPct";
  }
  return null;
}

function looksConditionalPropertyName(rawName) {
  const key = String(rawName ?? "");
  return (
    key.startsWith("Proc") ||
    key.startsWith("Activated") ||
    key.includes("CloseRange") ||
    key.includes("LongRange") ||
    key.includes("Ambush")
  );
}

function applyModeledStat(target, statKey, valueRaw) {
  if (!statKey) return;
  const value = parseNumber(valueRaw);
  if (!value) return;
  target[statKey] += value / 100;
}

const legacyIdByNormalizedName = {
  closequarters: "close_quarters",
  // Rapid Rounds is the 800 tier predecessor; Swift Striker (1600) maps to the legacy ID.
  rapidrounds: "rapid_rounds",
  hollowpoint: "hollow_point",
  glasscannon: "glass_cannon",
  siphonrounds: "siphon_rounds",
  quicksilverloader: "quicksilver_loader",
  shadowweave: "shadow_weave",
  swiftstriker: "rapid_fire_rounds",
};

function conditionalMetaForItem(entry) {
  const name = entry?.name ?? "";
  const className = entry?.raw?.class_name ?? "";

  if (name === "Close Quarters") {
    return { conditionalId: "close_quarters_near", conditionalLabel: "Close Quarters active (within distance)" };
  }
  if (className === "upgrade_burst_fire") {
    return {
      conditionalId: "burst_fire_proc",
      conditionalLabel: "Burst Fire proc (after bullet hits enemy hero)",
    };
  }
  if (name === "Shadow Weave" || className.includes("cloaking_device_active")) {
    return { conditionalId: "shadow_weave_active", conditionalLabel: "Shadow Weave active window" };
  }
  return null;
}

function tierFromWhitelist(bucket) {
  const b = String(bucket);
  if (b === "800") return 800;
  if (b === "1600") return 1600;
  if (b === "3200") return 3200;
  if (b === "6400") return 6400;
  return null;
}

function categoryFromSlot(slotType) {
  if (slotType === "weapon") return "gun";
  if (slotType === "vitality") return "vitality";
  if (slotType === "spirit") return "spirit";
  return "gun";
}

function normalizeItem(entry) {
  const tier = tierFromWhitelist(entry.whitelist_bucket);
  if (!tier) return null;

  const raw = entry.raw;
  const normalizedName = String(entry.normalized_name ?? "");
  const internalId = legacyIdByNormalizedName[normalizedName] ?? raw.class_name;

  const conditionalMeta = conditionalMetaForItem(entry);

  const rawDescription = raw?.description;
  const descriptionString =
    typeof rawDescription === "string" ? rawDescription : rawDescription?.desc ?? "";

  const effects = emptyEffects(stripHtml(descriptionString));
  const conditionalEffects = emptyEffects();

  // Conditional effects (binary toggle in UI) are mapped at the item-level.
  if (conditionalMeta) {
    effects.description = conditionalMeta.conditionalLabel
      ? `${effects.description}`.trim()
      : effects.description;
  }

  const props = raw.properties ?? {};
  for (const [key, prop] of Object.entries(props)) {
    const statKey = mapStatKey(key);
    if (!statKey) continue;

    const conditionalByUsage = usageFlags(prop).includes("ConditionallyApplied");
    const conditionalByName = looksConditionalPropertyName(key);
    const target = conditionalByUsage || conditionalByName ? conditionalEffects : effects;
    applyModeledStat(target, statKey, prop.value);
  }

  // Some key weapon/rof bonuses are encoded under `upgrades[].property_upgrades[]`.
  const upgrades = raw.upgrades ?? [];
  for (const up of upgrades) {
    const list = up.property_upgrades ?? [];
    for (const pu of list) {
      const name = String(pu.name ?? "");
      const bonus = parseNumber(pu.bonus);
      if (!bonus) continue;
      const statKey = mapStatKey(name);
      if (!statKey) continue;
      const target = looksConditionalPropertyName(name) ? conditionalEffects : effects;
      applyModeledStat(target, statKey, bonus);
    }
  }

  if (raw.class_name === "upgrade_burst_fire") {
    effects.fireRatePct = 0;
    conditionalEffects.fireRatePct = 0;
    applyModeledStat(effects, "fireRatePct", raw.properties?.BonusFireRate?.value);
    const procFr = parseNumber(raw.properties?.ActivatedFireRate?.value) / 100;
    if (procFr) conditionalEffects.fireRatePct += procFr;
  }

  const hasConditionalModeledStats = hasModeledEffects(conditionalEffects);
  const hasConditionalEffects = Boolean(conditionalMeta) || hasConditionalModeledStats;
  const isActiveItem = Boolean(raw.is_active_item);

  // Upgrade replacement rule: predecessor is stored in `component_items` as class_names.
  const componentItems = raw.component_items ?? [];
  const upgradesFromRaw = componentItems.length ? String(componentItems[0]) : undefined;

  const resolvedConditionalId = conditionalMeta?.conditionalId ?? (hasConditionalModeledStats ? `${internalId}_conditional` : undefined);
  const resolvedConditionalLabel =
    conditionalMeta?.conditionalLabel ?? (hasConditionalModeledStats ? `${entry.name} conditional effect active` : undefined);

  const trimmedConditionalEffects = hasConditionalModeledStats
    ? {
        weaponDamagePct: conditionalEffects.weaponDamagePct,
        fireRatePct: conditionalEffects.fireRatePct,
        clipSizePct: conditionalEffects.clipSizePct,
        reloadReductionPct: conditionalEffects.reloadReductionPct,
        bulletLifestealPct: conditionalEffects.bulletLifestealPct,
        flatWeaponDamage: conditionalEffects.flatWeaponDamage,
        flatBaseDamage: conditionalEffects.flatBaseDamage,
        damageAmplificationPct: conditionalEffects.damageAmplificationPct,
      }
    : undefined;

  return {
    id: internalId,
    name: entry.name,
    category: categoryFromSlot(entry.slot_type),
    tier,
    baseCost: Number(entry.cost ?? tier),
    upgradesFrom: undefined, // filled in after we build a className -> id map
    conditionalId: resolvedConditionalId,
    conditionalLabel: resolvedConditionalLabel,
    conditionalEffects: trimmedConditionalEffects,
    isActiveItem,
    hasConditionalEffects,
    effects,
    _upgradesFromRaw: upgradesFromRaw,
  };
}

function main() {
  const cacheJson = JSON.parse(fs.readFileSync(cacheJsonPath, "utf-8"));
  const entries = Array.isArray(cacheJson.items) ? cacheJson.items : [];

  // Keep CSV referenced (pipeline origin), but use JSON for effect extraction.
  if (!fs.existsSync(cacheCsvPath)) {
    console.warn(`Warning: cache CSV missing at ${cacheCsvPath} (continuing with JSON).`);
  }

  const normalizedTemp = entries.map(normalizeItem).filter(Boolean);

  const classNameToInternalId = new Map();
  // Build map by re-reading from original entries.
  for (const rawEntry of entries) {
    const tier = tierFromWhitelist(rawEntry.whitelist_bucket);
    if (!tier) continue;
    const normalizedName = String(rawEntry.normalized_name ?? "");
    const internalId = legacyIdByNormalizedName[normalizedName] ?? rawEntry.raw.class_name;
    classNameToInternalId.set(rawEntry.raw.class_name, internalId);
  }

  const finalItems = normalizedTemp.map((item) => {
    const upgradesFromRaw = item._upgradesFromRaw;
    const upgradesFrom = upgradesFromRaw ? classNameToInternalId.get(upgradesFromRaw) : undefined;
    const rest = { ...item };
    delete rest._upgradesFromRaw;
    return { ...rest, upgradesFrom };
  });

  fs.writeFileSync(outputPath, JSON.stringify(finalItems, null, 2));
  console.log(`Wrote ${outputPath} (${finalItems.length} items).`);
}

main();
