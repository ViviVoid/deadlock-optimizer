import { z } from "zod";

export const economyTierSchema = z.union([
  z.literal(800),
  z.literal(1600),
  z.literal(3200),
  z.literal(6400),
]);
export type EconomyTier = z.infer<typeof economyTierSchema>;

export const statBlockSchema = z.object({
  baseDamage: z.number().nonnegative(),
  fireRate: z.number().positive(),
  magazineSize: z.number().positive(),
  reloadTimeSec: z.number().nonnegative(),
  headshotRatio: z.number().min(0).max(1).default(0.2),
  critBonusScale: z.number().default(0),
  canCrit: z.boolean().default(true),
  falloffNearMeters: z.number().positive(),
  falloffFarMeters: z.number().positive(),
  flatWeaponDamage: z.number().default(0),
});

export const guardrailSchema = z.object({
  castTimeMs: z.number().nonnegative().default(0),
  recoveryTimeMs: z.number().nonnegative().default(0),
  requiresLineOfSight: z.boolean().default(false),
  maxMaintainedUptimePct: z.number().min(0).max(1).default(1),
  tickIntervalMs: z.number().positive().default(1000),
  retargetDelayMs: z.number().nonnegative().default(0),
});

export const abilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  damagePerTick: z.number().nonnegative(),
  activeDurationSec: z.number().nonnegative(),
  cooldownSec: z.number().positive(),
  guardrails: guardrailSchema,
});

export const heroSchema = z.object({
  id: z.string(),
  name: z.string(),
  stats: statBlockSchema,
  boonsWeaponDamageMultiplier: z.number().nonnegative().default(1),
  abilities: z.array(abilitySchema),
  noCritException: z.boolean().default(false),
  headshotTakenMultiplier: z.number().positive().default(1),
});
export type Hero = z.infer<typeof heroSchema>;

export const itemEffectSchema = z.object({
  weaponDamagePct: z.number().default(0),
  fireRatePct: z.number().default(0),
  flatWeaponDamage: z.number().default(0),
  bulletResistReductionPct: z.number().default(0),
  damageAmplificationPct: z.number().default(0),
  conditional: z.string().optional(),
});

export const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: economyTierSchema,
  baseCost: z.number().positive(),
  upgradesFrom: z.string().optional(),
  effects: itemEffectSchema,
});
export type Item = z.infer<typeof itemSchema>;

export const enemyProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  bulletResistPct: z.number().min(-0.95).max(0.95).default(0),
  critResistMultiplier: z.number().positive().default(1),
  headshotTakenMultiplier: z.number().positive().default(1),
});
export type EnemyProfile = z.infer<typeof enemyProfileSchema>;

export const teamModifierSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(false),
  weaponDamagePct: z.number().default(0),
  damageAmplificationPct: z.number().default(0),
  bulletResistReductionPct: z.number().default(0),
});
export type TeamModifier = z.infer<typeof teamModifierSchema>;

export const scenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  distanceMeters: z.number().nonnegative(),
  includeReloadCycle: z.boolean().default(true),
  continuousFireAssumption: z.boolean().default(false),
  ignoreAnimationLocks: z.boolean().default(false),
  assumePerfectLineOfSight: z.boolean().default(false),
  useObservedTickRate: z.boolean().default(true),
  sustainedDurationSec: z.number().positive().default(20),
  enableExperimentalDamageAmp: z.boolean().default(false),
});
export type Scenario = z.infer<typeof scenarioSchema>;

export const buildSchema = z.object({
  heroId: z.string(),
  itemIds: z.array(z.string()),
  soulBudget: z.number().positive(),
  scenarioId: z.string(),
  enemyId: z.string(),
  teamModifierIds: z.array(z.string()),
});
export type BuildConfig = z.infer<typeof buildSchema>;

export const datasetSchema = z.object({
  version: z.string(),
  heroes: z.array(heroSchema),
  items: z.array(itemSchema),
  enemies: z.array(enemyProfileSchema),
  teamModifiers: z.array(teamModifierSchema),
  scenarios: z.array(scenarioSchema),
});
export type Dataset = z.infer<typeof datasetSchema>;
