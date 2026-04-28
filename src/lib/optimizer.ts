import { evaluateBuild } from "@/lib/engine";
import type { BuildConfig, Dataset, Item } from "@/lib/types";

export type OptimizerObjective = "SustainedDPS" | "BurstDamage" | "EHP";

export type OptimizerRecommendation = {
  build: BuildConfig;
  score: number;
  rationale: {
    totalCost: number;
    budget: number;
    upgradeChains: string[];
    marginalVsSecondBest: number;
  };
};

function scoreResult(
  objective: OptimizerObjective,
  result: ReturnType<typeof evaluateBuild>
): number {
  if (objective === "BurstDamage") return result.burstWindowDamage;
  if (objective === "EHP") return result.ehpMultiplier;
  return result.guardrailedDps;
}

function upgradeChains(items: Item[]): string[] {
  return items
    .filter((item) => item.upgradesFrom)
    .map((item) => `${item.upgradesFrom} -> ${item.id}`);
}

function combinations<T>(arr: T[], maxSize: number): T[][] {
  const out: T[][] = [];
  const n = arr.length;
  for (let mask = 1; mask < 1 << n; mask += 1) {
    const combo: T[] = [];
    for (let i = 0; i < n; i += 1) {
      if (mask & (1 << i)) combo.push(arr[i]);
    }
    if (combo.length <= maxSize) out.push(combo);
  }
  return out;
}

export function optimizeBuilds({
  dataset,
  baseBuild,
  objective,
  maxItems = 6,
}: {
  dataset: Dataset;
  baseBuild: BuildConfig;
  objective: OptimizerObjective;
  maxItems?: number;
}): OptimizerRecommendation[] {
  const candidates = combinations(dataset.items, maxItems);

  const scored = candidates
    .map((candidateItems) => {
      const build: BuildConfig = {
        ...baseBuild,
        itemIds: candidateItems.map((item) => item.id),
      };
      const result = evaluateBuild(dataset, build);
      if (!result.budgetValid) return null;
      return {
        build,
        score: scoreResult(objective, result),
        totalCost: result.totalCost,
        chains: upgradeChains(result.selectedItems),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map((entry, idx, arr) => ({
    build: entry.build,
    score: entry.score,
    rationale: {
      totalCost: entry.totalCost,
      budget: baseBuild.soulBudget,
      upgradeChains: entry.chains,
      marginalVsSecondBest:
        idx === 0 && arr[1] ? entry.score - arr[1].score : 0,
    },
  }));
}
