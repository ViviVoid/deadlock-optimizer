import type {
  BuildConfig,
  Dataset,
  EnemyProfile,
  Hero,
  Item,
  Scenario,
  TeamModifier,
} from "@/lib/types";

export type DamageBreakdown = {
  baseDamage: number;
  weaponDamageMultiplier: number;
  flatBonus: number;
  falloff: number;
  resistances: number;
  critMultiplier: number;
  damageAmplification: number;
  finalDamagePerBullet: number;
};

export type BuildResult = {
  hero: Hero;
  enemy: EnemyProfile;
  scenario: Scenario;
  selectedItems: Item[];
  selectedTeamModifiers: TeamModifier[];
  totalCost: number;
  budgetValid: boolean;
  rawDps: number;
  guardrailedDps: number;
  burstWindowDamage: number;
  ehpMultiplier: number;
  assumptions: string[];
  breakdown: DamageBreakdown;
};

function sum<T>(arr: T[], getter: (item: T) => number): number {
  return arr.reduce((acc, item) => acc + getter(item), 0);
}

export function resolveBuild(dataset: Dataset, build: BuildConfig) {
  const hero = dataset.heroes.find((h) => h.id === build.heroId);
  const enemy = dataset.enemies.find((e) => e.id === build.enemyId);
  const scenario = dataset.scenarios.find((s) => s.id === build.scenarioId);
  if (!hero || !enemy || !scenario) {
    throw new Error("Build references unknown hero/enemy/scenario");
  }

  const selectedItems = build.itemIds
    .map((id) => dataset.items.find((item) => item.id === id))
    .filter((item): item is Item => Boolean(item));

  const selectedTeamModifiers = build.teamModifierIds
    .map((id) => dataset.teamModifiers.find((tm) => tm.id === id))
    .filter((tm): tm is TeamModifier => Boolean(tm));

  return { hero, enemy, scenario, selectedItems, selectedTeamModifiers };
}

export function effectiveItemCost(item: Item, selectedItems: Item[]): number {
  if (!item.upgradesFrom) return item.baseCost;
  const parentOwned = selectedItems.some((i) => i.id === item.upgradesFrom);
  if (!parentOwned) return item.baseCost;
  const parent = selectedItems.find((i) => i.id === item.upgradesFrom);
  return Math.max(item.baseCost - (parent?.baseCost ?? 0), 0);
}

function computeFalloff(distanceMeters: number, hero: Hero): number {
  const { falloffNearMeters, falloffFarMeters } = hero.stats;
  if (distanceMeters <= falloffNearMeters) return 1;
  if (distanceMeters >= falloffFarMeters) return 0.1;
  const t =
    (distanceMeters - falloffNearMeters) /
    (falloffFarMeters - falloffNearMeters);
  return 1 - t * 0.9;
}

function computeCritMultiplier(hero: Hero, enemy: EnemyProfile): number {
  if (!hero.stats.canCrit || hero.noCritException) return 1;
  const critBase = 1 + 0.65 * (1 + hero.stats.critBonusScale);
  return critBase * enemy.critResistMultiplier * enemy.headshotTakenMultiplier;
}

function computeAbilityDps(hero: Hero, scenario: Scenario, guardrailed: boolean): number {
  if (!hero.abilities.length) return 0;

  return hero.abilities.reduce((acc, ability) => {
    const guard = ability.guardrails;
    const tickSec =
      (guardrailed && scenario.useObservedTickRate ? guard.tickIntervalMs : 1000) /
      1000;
    const maxTicks = ability.activeDurationSec / tickSec;
    const castsPerWindow = scenario.sustainedDurationSec / ability.cooldownSec;
    const uptimePenalty = guardrailed ? guard.maxMaintainedUptimePct : 1;
    const losPenalty =
      guardrailed && guard.requiresLineOfSight && !scenario.assumePerfectLineOfSight
        ? 0.78
        : 1;
    const animationPenalty =
      guardrailed && !scenario.ignoreAnimationLocks
        ? Math.max(1 - (guard.castTimeMs + guard.recoveryTimeMs) / 10000, 0.7)
        : 1;

    const totalDamage =
      maxTicks * ability.damagePerTick * castsPerWindow * uptimePenalty * losPenalty * animationPenalty;

    return acc + totalDamage / scenario.sustainedDurationSec;
  }, 0);
}

export function evaluateBuild(dataset: Dataset, build: BuildConfig): BuildResult {
  const { hero, enemy, scenario, selectedItems, selectedTeamModifiers } = resolveBuild(dataset, build);

  const totalWeaponPct =
    sum(selectedItems, (i) => i.effects.weaponDamagePct) +
    sum(selectedTeamModifiers, (tm) => tm.weaponDamagePct);
  const totalFireRatePct = sum(selectedItems, (i) => i.effects.fireRatePct);
  const totalFlatBonus = sum(selectedItems, (i) => i.effects.flatWeaponDamage) + hero.stats.flatWeaponDamage;
  const totalResistReduction =
    sum(selectedItems, (i) => i.effects.bulletResistReductionPct) +
    sum(selectedTeamModifiers, (tm) => tm.bulletResistReductionPct);
  const totalDamageAmp =
    sum(selectedItems, (i) => i.effects.damageAmplificationPct) +
    sum(selectedTeamModifiers, (tm) => tm.damageAmplificationPct);

  const baseDamage = hero.stats.baseDamage;
  const weaponDamageMultiplier = hero.boonsWeaponDamageMultiplier * (1 + totalWeaponPct);
  const falloff = computeFalloff(scenario.distanceMeters, hero);
  const effectiveResistPct = enemy.bulletResistPct * (1 - totalResistReduction);
  const resistances = 1 - effectiveResistPct;
  const critMultiplier = 1 + (computeCritMultiplier(hero, enemy) - 1) * hero.stats.headshotRatio;
  const damageAmplification = scenario.enableExperimentalDamageAmp ? 1 + totalDamageAmp : 1;

  const finalDamagePerBullet =
    ((baseDamage * weaponDamageMultiplier + totalFlatBonus) *
      falloff *
      resistances *
      critMultiplier *
      damageAmplification);

  const fireRate = hero.stats.fireRate * (1 + totalFireRatePct);
  const cycleSeconds = hero.stats.magazineSize / fireRate + hero.stats.reloadTimeSec;
  const sustainedFireRate =
    scenario.includeReloadCycle && !scenario.continuousFireAssumption
      ? hero.stats.magazineSize / cycleSeconds
      : fireRate;

  const rawWeaponDps = finalDamagePerBullet * sustainedFireRate;
  const rawAbilityDps = computeAbilityDps(hero, scenario, false);
  const guardrailedAbilityDps = computeAbilityDps(hero, scenario, true);

  const rawDps = rawWeaponDps + rawAbilityDps;
  const guardrailedDps = rawWeaponDps + guardrailedAbilityDps;

  const burstWindowDamage = finalDamagePerBullet * fireRate * 3 + guardrailedAbilityDps * 3;
  const ehpMultiplier = 1 / Math.max(resistances, 0.1);

  const totalCost = sum(selectedItems, (item) => effectiveItemCost(item, selectedItems));

  const assumptions = [
    scenario.enableExperimentalDamageAmp ? "Experimental damage amplification enabled" : "Damage amplification disabled",
    scenario.includeReloadCycle ? "Reload cycle included" : "Continuous firing assumption",
    scenario.assumePerfectLineOfSight ? "Perfect line of sight" : "LOS interruptions modeled",
    scenario.ignoreAnimationLocks ? "Animation locks ignored" : "Animation locks modeled",
  ];

  return {
    hero,
    enemy,
    scenario,
    selectedItems,
    selectedTeamModifiers,
    totalCost,
    budgetValid: totalCost <= build.soulBudget,
    rawDps,
    guardrailedDps,
    burstWindowDamage,
    ehpMultiplier,
    assumptions,
    breakdown: {
      baseDamage,
      weaponDamageMultiplier,
      flatBonus: totalFlatBonus,
      falloff,
      resistances,
      critMultiplier,
      damageAmplification,
      finalDamagePerBullet,
    },
  };
}
