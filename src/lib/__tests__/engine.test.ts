import { describe, expect, it } from "vitest";
import { sampleDataset } from "@/lib/data/sampleDataset";
import { evaluateBuild } from "@/lib/engine";
import type { BuildConfig } from "@/lib/types";

const baseBuild: BuildConfig = {
  heroId: "geist",
  itemIds: ["close_quarters", "rapid_fire_rounds"],
  soulBudget: 6400,
  scenarioId: "sustained",
  enemyId: "default_enemy",
  teamModifierIds: [],
};

describe("weapon formula order", () => {
  it("applies expected ordered buckets", () => {
    const result = evaluateBuild(sampleDataset, baseBuild);

    const expected =
      ((result.breakdown.baseDamage * result.breakdown.weaponDamageMultiplier +
        result.breakdown.flatBonus) *
        result.breakdown.falloff *
        result.breakdown.resistances *
        result.breakdown.critMultiplier *
        result.breakdown.damageAmplification);

    expect(result.breakdown.finalDamagePerBullet).toBeCloseTo(expected, 6);
  });

  it("uses guardrails to reduce practical sustained output", () => {
    const practical = evaluateBuild(sampleDataset, baseBuild);
    const theoretical = evaluateBuild(sampleDataset, {
      ...baseBuild,
      scenarioId: "ceiling",
    });

    expect(practical.guardrailedDps).toBeLessThanOrEqual(theoretical.guardrailedDps);
  });
});
