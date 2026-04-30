import { z } from "zod";

export const economyTierSchema = z.union([
  z.literal(800),
  z.literal(1600),
  z.literal(3200),
  z.literal(6400),
]);
export type EconomyTier = z.infer<typeof economyTierSchema>;
export const itemCategorySchema = z.enum(["gun", "vitality", "spirit"]);
export type ItemCategory = z.infer<typeof itemCategorySchema>;
export const soulModeSchema = z.enum(["autoFromItems", "manual"]);
export type SoulMode = z.infer<typeof soulModeSchema>;

export const gunStatSchema = z.object({
  bulletDamageStart: z.number().nonnegative(),
  bulletDamagePerBoon: z.number().nonnegative(),
  bulletDamageMaxBoon: z.number().nonnegative(),
  spiritScaling: z.number().nonnegative().default(0),
  baseRof: z.number().positive(),
  ammo: z.number().positive(),
  clipSizePct: z.number().default(0),
  reloadTimeSec: z.number().nonnegative(),
  reloadReductionPct: z.number().default(0),
  pelletCount: z.number().positive().default(1),
  bulletVelocity: z.number().nullable().default(null),
  critBonusScalePct: z.number().default(0),
});

export const heroSchema = z.object({
  id: z.string(),
  name: z.string(),
  gun: gunStatSchema,
});
export type Hero = z.infer<typeof heroSchema>;

export const itemEffectSchema = z.object({
  weaponDamagePct: z.number().default(0),
  fireRatePct: z.number().default(0),
  clipSizePct: z.number().default(0),
  reloadReductionPct: z.number().default(0),
  bulletLifestealPct: z.number().default(0),
  flatWeaponDamage: z.number().default(0),
  flatBaseDamage: z.number().default(0),
  damageAmplificationPct: z.number().default(0),
  description: z.string().default(""),
});

export const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: itemCategorySchema,
  tier: economyTierSchema,
  baseCost: z.number().positive(),
  upgradesFrom: z.string().optional(),
  conditionalId: z.string().optional(),
  conditionalLabel: z.string().optional(),
  /** Extra gun-relevant stats applied only when `conditionalId` is toggled on (innate stays in `effects`). */
  conditionalEffects: itemEffectSchema.partial().optional(),
  /** From cache: item with an activatable slot (shop “active” items). */
  isActiveItem: z.boolean().default(false),
  /** Derived: proc windows, important_properties, or ConditionallyApplied in source data. */
  hasConditionalEffects: z.boolean().default(false),
  effects: itemEffectSchema,
});
export type Item = z.infer<typeof itemSchema>;

export const enemyProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  bulletResistPct: z.number().min(-0.95).max(0.95).default(0),
});
export type EnemyProfile = z.infer<typeof enemyProfileSchema>;

export const teamModifierSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(false),
  weaponDamagePct: z.number().default(0),
  damageAmplificationPct: z.number().default(0),
  fireRatePct: z.number().default(0),
  reloadReductionPct: z.number().default(0),
});
export type TeamModifier = z.infer<typeof teamModifierSchema>;

export const scenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  includeReloadCycle: z.boolean().default(true),
});
export type Scenario = z.infer<typeof scenarioSchema>;

export const boonBreakpointSchema = z.object({
  souls: z.number().int().nonnegative(),
  boons: z.number().int().nonnegative(),
});
export type BoonBreakpoint = z.infer<typeof boonBreakpointSchema>;

/** Souls spent in the weapon shop track; highest tier at or below investment applies (wiki Weapon Damage). */
export const weaponInvestmentBreakpointSchema = z.object({
  souls: z.number().int().nonnegative(),
  /** Fraction, e.g. 0.07 for +7% */
  weaponDamagePct: z.number().nonnegative(),
});
export type WeaponInvestmentBreakpoint = z.infer<typeof weaponInvestmentBreakpointSchema>;

export const buildSchema = z.object({
  heroId: z.string(),
  itemIds: z.array(z.string()),
  soulMode: soulModeSchema.default("autoFromItems"),
  soulCount: z.number().int().nonnegative().default(900),
  conditionalStates: z.record(z.string(), z.boolean()).default({}),
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
  boonBreakpoints: z.array(boonBreakpointSchema),
  weaponInvestmentBreakpoints: z.array(weaponInvestmentBreakpointSchema),
});
export type Dataset = z.infer<typeof datasetSchema>;
