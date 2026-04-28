import { describe, expect, it } from "vitest";
import { sampleDataset } from "@/lib/data/sampleDataset";
import { orderAveragedContributions } from "@/lib/contributions";
import { evaluateBuild } from "@/lib/engine";
import type { BuildConfig } from "@/lib/types";

const build: BuildConfig = {
  heroId: "geist",
  itemIds: ["close_quarters", "rapid_fire_rounds", "hollow_point"],
  soulBudget: 9600,
  scenarioId: "sustained",
  enemyId: "default_enemy",
  teamModifierIds: [],
};

describe("item contributions", () => {
  it("keeps order-averaged contribution sum near total build value", () => {
    const withItems = evaluateBuild(sampleDataset, build).guardrailedDps;
    const withoutItems = evaluateBuild(sampleDataset, { ...build, itemIds: [] }).guardrailedDps;

    const expectedDelta = withItems - withoutItems;
    const contribSum = orderAveragedContributions(sampleDataset, build).reduce(
      (acc, item) => acc + item.absoluteDelta,
      0
    );

    expect(Math.abs(contribSum - expectedDelta)).toBeLessThanOrEqual(0.5);
  });
});
