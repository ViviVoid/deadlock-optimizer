import { describe, expect, it } from "vitest";
import { sampleDataset } from "@/lib/data/sampleDataset";
import { evaluateBuild } from "@/lib/engine";
import type { BuildConfig } from "@/lib/types";

const baseBuild: BuildConfig = {
  heroId: "lady_geist",
  itemIds: ["close_quarters", "rapid_fire_rounds"],
  soulMode: "manual",
  soulCount: 900,
  conditionalStates: {},
  scenarioId: "base",
  enemyId: "default_enemy",
  teamModifierIds: [],
};

describe("weapon formula order", () => {
  it("applies expected ordered buckets", () => {
    const result = evaluateBuild(sampleDataset, baseBuild);

    const expected =
      ((result.breakdown.baseBulletDamage + result.breakdown.flatBaseDamage) *
        result.breakdown.weaponDamageMultiplier +
        result.breakdown.flatWeaponDamage) *
      result.breakdown.damageAmplification;

    expect(result.finalPerShotBase).toBeCloseTo(expected, 6);
  });

  it("matches seeded table values without modifiers", () => {
    const emptyBuild = evaluateBuild(sampleDataset, {
      ...baseBuild,
      itemIds: [],
      soulCount: 49600,
      scenarioId: "idealized",
    });
    expect(emptyBuild.finalDpsBase).toBeCloseTo(43.884, 3);
    expect(emptyBuild.finalDpsMaxBoon).toBeCloseTo(118.084, 3);
  });

  it("supports auto soul mode from built items", () => {
    const auto = evaluateBuild(sampleDataset, {
      ...baseBuild,
      soulMode: "autoFromItems",
      itemIds: ["close_quarters", "rapid_fire_rounds"],
    });
    expect(auto.soulCountUsed).toBe(2400);
    expect(auto.rows).toHaveLength(3);
  });

  it("applies weapon shop investment from gun-slot soul spend (wiki table)", () => {
    const r = evaluateBuild(sampleDataset, {
      ...baseBuild,
      itemIds: ["close_quarters"],
      soulMode: "manual",
      soulCount: 0,
    });
    expect(r.weaponSoulInvestment).toBe(800);
    expect(r.gunInvestmentWeaponPct).toBeCloseTo(0.07, 6);
    const expectedBasePellet =
      ((r.breakdown.baseBulletDamage + r.breakdown.flatBaseDamage) * r.breakdown.weaponDamageMultiplier +
        r.breakdown.flatWeaponDamage) *
      r.breakdown.damageAmplification;
    expect(r.rows[0].rawBulletDamage).toBeCloseTo(r.breakdown.baseBulletDamage, 6);
    expect(r.rows[0].bulletDamage).toBeCloseTo(expectedBasePellet, 6);
    const r2 = evaluateBuild(sampleDataset, {
      ...baseBuild,
      itemIds: ["close_quarters", "rapid_fire_rounds"],
      soulMode: "manual",
      soulCount: 0,
    });
    expect(r2.weaponSoulInvestment).toBe(2400);
    expect(r2.gunInvestmentWeaponPct).toBeCloseTo(0.13, 6);
    const expectedMaxPellet =
      ((r2.breakdown.maxBoonBulletDamage + r2.breakdown.flatBaseDamage) * r2.breakdown.weaponDamageMultiplier +
        r2.breakdown.flatWeaponDamage) *
      r2.breakdown.damageAmplification;
    expect(r2.rows[2].rawBulletDamage).toBeCloseTo(r2.breakdown.maxBoonBulletDamage, 6);
    expect(r2.rows[2].bulletDamage).toBeCloseTo(expectedMaxPellet, 6);
  });
});
