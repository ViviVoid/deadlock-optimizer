import { describe, expect, it } from "vitest";
import { sampleDataset } from "@/lib/data/sampleDataset";
import { evaluateBuild } from "@/lib/engine";
import type { BuildConfig } from "@/lib/types";

const build: BuildConfig = {
  heroId: "geist",
  itemIds: ["close_quarters", "hollow_point", "glass_cannon"],
  soulBudget: 10000,
  scenarioId: "sustained",
  enemyId: "default_enemy",
  teamModifierIds: [],
};

describe("economy path constraints", () => {
  it("accounts for upgrade discount in effective total cost", () => {
    const result = evaluateBuild(sampleDataset, build);
    expect(result.totalCost).toBe(800 + (3200 - 800) + (6400 - 3200));
    expect(result.budgetValid).toBe(true);
  });
});
