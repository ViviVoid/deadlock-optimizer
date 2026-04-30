import type {
  BuildConfig,
  Dataset,
  Hero,
  Item,
  TeamModifier,
} from "@/lib/types";

export type DamageBreakdown = {
  baseBulletDamage: number;
  boonBulletDamage: number;
  maxBoonBulletDamage: number;
  weaponDamageMultiplier: number;
  /** Souls spent on equipped gun-slot items (sum of baseCost, category gun). */
  weaponSoulInvestment: number;
  /** Wiki table: bonus weapon damage as a fraction (e.g. 0.13 for +13%). */
  gunInvestmentWeaponPct: number;
  fireRateMultiplier: number;
  clipMultiplier: number;
  reloadMultiplier: number;
  flatWeaponDamage: number;
  flatBaseDamage: number;
  damageAmplification: number;
};

export type BuildResult = {
  hero: Hero;
  selectedItems: Item[];
  selectedTeamModifiers: TeamModifier[];
  soulCountUsed: number;
  /** Sum of `baseCost` for equipped items in the gun (weapon) category — drives shop investment weapon %. */
  weaponSoulInvestment: number;
  /** Wiki weapon-shop investment row applied as a fraction (e.g. 0.13). */
  gunInvestmentWeaponPct: number;
  boonCount: number;
  totalCost: number;
  activeConditionals: string[];
  rows: Array<{
    label: "Base" | "@Boon" | "@MaxBoon";
    /** Hero gun bullet stat for this tier (pre–weapon-damage multiplier). */
    rawBulletDamage: number;
    /** Per pellet after weapon damage % (items + gun shop souls), flat adds, and damage amp. */
    bulletDamage: number;
    rof: number;
    perShot: number;
    dps: number;
    headshotDps: number;
  }>;
  finalPerShotBase: number;
  finalPerShotBoon: number;
  finalDpsBase: number;
  finalDpsBoon: number;
  finalPerShotMaxBoon: number;
  finalDpsMaxBoon: number;
  finalDpsHeadshotBase: number;
  finalDpsHeadshotBoon: number;
  finalDpsHeadshotMaxBoon: number;
  bulletVelocityLabel: string;
  breakdown: DamageBreakdown;
};

function sum<T>(arr: T[], getter: (item: T) => number): number {
  return arr.reduce((acc, item) => acc + getter(item), 0);
}

function itemContributesToTotals(item: Item, conditionalStates: Record<string, boolean>): boolean {
  if (!item.conditionalId) return true;
  if (item.conditionalEffects) return true;
  return Boolean(conditionalStates[item.conditionalId]);
}

function mergedItemEffects(item: Item, conditionalStates: Record<string, boolean>) {
  const base = item.effects;
  const condOn = item.conditionalId ? Boolean(conditionalStates[item.conditionalId]) : true;
  const extra = item.conditionalEffects && condOn ? item.conditionalEffects : {};
  return {
    weaponDamagePct: base.weaponDamagePct + (extra.weaponDamagePct ?? 0),
    fireRatePct: base.fireRatePct + (extra.fireRatePct ?? 0),
    clipSizePct: base.clipSizePct + (extra.clipSizePct ?? 0),
    reloadReductionPct: base.reloadReductionPct + (extra.reloadReductionPct ?? 0),
    bulletLifestealPct: base.bulletLifestealPct + (extra.bulletLifestealPct ?? 0),
    flatWeaponDamage: base.flatWeaponDamage + (extra.flatWeaponDamage ?? 0),
    flatBaseDamage: base.flatBaseDamage + (extra.flatBaseDamage ?? 0),
    damageAmplificationPct: base.damageAmplificationPct + (extra.damageAmplificationPct ?? 0),
  };
}

export function resolveBuild(dataset: Dataset, build: BuildConfig) {
  const hero = dataset.heroes.find((h) => h.id === build.heroId) ?? dataset.heroes[0];
  const scenario = dataset.scenarios.find((s) => s.id === build.scenarioId) ?? dataset.scenarios[0];
  if (!hero || !scenario || dataset.items.length === 0) {
    throw new Error("Dataset is missing required heroes/scenarios/items");
  }

  const selectedItems = build.itemIds
    .map((id) => dataset.items.find((item) => item.id === id))
    .filter((item): item is Item => Boolean(item));

  const selectedTeamModifiers = build.teamModifierIds
    .map((id) => dataset.teamModifiers.find((tm) => tm.id === id))
    .filter((tm): tm is TeamModifier => Boolean(tm));

  return { hero, scenario, selectedItems, selectedTeamModifiers };
}

export function effectiveItemCost(item: Item, selectedItems: Item[]): number {
  if (!item.upgradesFrom) return item.baseCost;
  const parentOwned = selectedItems.some((i) => i.id === item.upgradesFrom);
  if (!parentOwned) return item.baseCost;
  const parent = selectedItems.find((i) => i.id === item.upgradesFrom);
  return Math.max(item.baseCost - (parent?.baseCost ?? 0), 0);
}

export function boonsForSouls(dataset: Dataset, soulCount: number): number {
  let current = 0;
  for (const step of dataset.boonBreakpoints) {
    if (soulCount >= step.souls) current = step.boons;
    else break;
  }
  return current;
}

/** Weapon shop investment: highest wiki tier at or below `weaponSoulInvestment`. */
export function gunInvestmentWeaponDamagePct(dataset: Dataset, weaponSoulInvestment: number): number {
  let best = 0;
  for (const step of dataset.weaponInvestmentBreakpoints) {
    if (weaponSoulInvestment >= step.souls) best = step.weaponDamagePct;
  }
  return best;
}

export function evaluateBuild(dataset: Dataset, build: BuildConfig): BuildResult {
  const { hero, scenario, selectedItems, selectedTeamModifiers } = resolveBuild(dataset, build);
  const activeConditionals = selectedItems
    .filter((item) => item.conditionalId && build.conditionalStates[item.conditionalId])
    .map((item) => item.conditionalId as string);
  const contributingItems = selectedItems.filter((item) => itemContributesToTotals(item, build.conditionalStates));

  const soulCountUsed =
    build.soulMode === "autoFromItems"
      ? selectedItems.reduce((acc, item) => acc + item.baseCost, 0)
      : build.soulCount;

  const weaponSoulInvestment = selectedItems
    .filter((item) => item.category === "gun")
    .reduce((acc, item) => acc + item.baseCost, 0);
  const gunInvestmentWeaponPct = gunInvestmentWeaponDamagePct(dataset, weaponSoulInvestment);

  const totalWeaponPct =
    contributingItems.reduce((acc, i) => acc + mergedItemEffects(i, build.conditionalStates).weaponDamagePct, 0) +
    sum(selectedTeamModifiers, (tm) => tm.weaponDamagePct);
  const totalFireRatePct =
    contributingItems.reduce((acc, i) => acc + mergedItemEffects(i, build.conditionalStates).fireRatePct, 0) +
    sum(selectedTeamModifiers, (tm) => tm.fireRatePct);
  const totalClipSizePct = contributingItems.reduce(
    (acc, i) => acc + mergedItemEffects(i, build.conditionalStates).clipSizePct,
    0
  );
  const totalReloadReductionPct =
    contributingItems.reduce(
      (acc, i) => acc + mergedItemEffects(i, build.conditionalStates).reloadReductionPct,
      0
    ) + sum(selectedTeamModifiers, (tm) => tm.reloadReductionPct);
  const totalFlatWeaponDamage = contributingItems.reduce(
    (acc, i) => acc + mergedItemEffects(i, build.conditionalStates).flatWeaponDamage,
    0
  );
  const totalFlatBaseDamage = contributingItems.reduce(
    (acc, i) => acc + mergedItemEffects(i, build.conditionalStates).flatBaseDamage,
    0
  );
  const totalDamageAmp =
    contributingItems.reduce(
      (acc, i) => acc + mergedItemEffects(i, build.conditionalStates).damageAmplificationPct,
      0
    ) + sum(selectedTeamModifiers, (tm) => tm.damageAmplificationPct);

  const boonCount = boonsForSouls(dataset, soulCountUsed);
  const boonBulletDamage = Math.min(
    hero.gun.bulletDamageStart + boonCount * hero.gun.bulletDamagePerBoon,
    hero.gun.bulletDamageMaxBoon
  );
  const baseBulletDamage = hero.gun.bulletDamageStart;
  const maxBoonBulletDamage = hero.gun.bulletDamageMaxBoon;
  const weaponDamageMultiplier = 1 + totalWeaponPct + gunInvestmentWeaponPct;
  const fireRateMultiplier = 1 + totalFireRatePct;
  const clipMultiplier = 1 + hero.gun.clipSizePct + totalClipSizePct;
  const reloadMultiplier = Math.max(1 - (hero.gun.reloadReductionPct + totalReloadReductionPct), 0.1);
  const damageAmplification = 1 + totalDamageAmp;

  // Headshot damage multiplier: base 1.65, modified by hero crit bonus scale.
  const headshotMultiplier = 1.65 + hero.gun.critBonusScalePct / 100;

  const bulletsPerSecond = hero.gun.baseRof * fireRateMultiplier;
  const magazineSize = hero.gun.ammo * clipMultiplier;
  const reloadSec = hero.gun.reloadTimeSec * reloadMultiplier;
  const sustainedBulletsPerSecond =
    scenario.includeReloadCycle ? magazineSize / (magazineSize / bulletsPerSecond + reloadSec) : bulletsPerSecond;

  function computeRow(label: "Base" | "@Boon" | "@MaxBoon", rawBulletDamage: number) {
    const perPellet =
      ((rawBulletDamage + totalFlatBaseDamage) * weaponDamageMultiplier + totalFlatWeaponDamage) *
      damageAmplification;
    const perShot = perPellet * hero.gun.pelletCount;
    return {
      label,
      rawBulletDamage,
      bulletDamage: perPellet,
      rof: sustainedBulletsPerSecond,
      perShot,
      dps: perShot * sustainedBulletsPerSecond,
      headshotDps: perShot * headshotMultiplier * sustainedBulletsPerSecond,
    };
  }

  const rows = [
    computeRow("Base", baseBulletDamage),
    computeRow("@Boon", boonBulletDamage),
    computeRow("@MaxBoon", maxBoonBulletDamage),
  ];

  const finalPerShotBase = rows[0].perShot;
  const finalDpsBase = rows[0].dps;
  const finalPerShotBoon = rows[1].perShot;
  const finalDpsBoon = rows[1].dps;
  const finalPerShotMaxBoon = rows[2].perShot;
  const finalDpsMaxBoon = rows[2].dps;
  const finalDpsHeadshotBase = rows[0].headshotDps;
  const finalDpsHeadshotBoon = rows[1].headshotDps;
  const finalDpsHeadshotMaxBoon = rows[2].headshotDps;

  const totalCost = selectedItems.reduce((acc, item) => acc + item.baseCost, 0);

  return {
    hero,
    selectedItems,
    selectedTeamModifiers,
    soulCountUsed,
    weaponSoulInvestment,
    gunInvestmentWeaponPct,
    boonCount,
    totalCost,
    activeConditionals,
    rows,
    finalPerShotBase,
    finalPerShotBoon,
    finalDpsBase,
    finalDpsBoon,
    finalPerShotMaxBoon,
    finalDpsMaxBoon,
    finalDpsHeadshotBase,
    finalDpsHeadshotBoon,
    finalDpsHeadshotMaxBoon,
    bulletVelocityLabel: hero.gun.bulletVelocity === null ? "Not Available" : `${hero.gun.bulletVelocity}`,
    breakdown: {
      baseBulletDamage,
      boonBulletDamage,
      maxBoonBulletDamage,
      weaponDamageMultiplier,
      weaponSoulInvestment,
      gunInvestmentWeaponPct,
      fireRateMultiplier,
      clipMultiplier,
      reloadMultiplier,
      flatWeaponDamage: totalFlatWeaponDamage,
      flatBaseDamage: totalFlatBaseDamage,
      damageAmplification,
    },
  };
}
