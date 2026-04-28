import { evaluateBuild } from "@/lib/engine";
import type { BuildConfig, Dataset } from "@/lib/types";

export type ItemContribution = {
  itemId: string;
  absoluteDelta: number;
  percentageDelta: number;
  method: "marginal" | "order-averaged";
};

function metric(result: ReturnType<typeof evaluateBuild>): number {
  return result.guardrailedDps;
}

export function marginalContributions(dataset: Dataset, baseBuild: BuildConfig): ItemContribution[] {
  const baseline = evaluateBuild(dataset, baseBuild);
  const baselineMetric = metric(baseline);

  return baseBuild.itemIds
    .map((itemId) => {
      const without: BuildConfig = {
        ...baseBuild,
        itemIds: baseBuild.itemIds.filter((id) => id !== itemId),
      };
      const valueWithout = metric(evaluateBuild(dataset, without));
      const delta = baselineMetric - valueWithout;
      return {
        itemId,
        absoluteDelta: delta,
        percentageDelta: baselineMetric > 0 ? delta / baselineMetric : 0,
        method: "marginal" as const,
      };
    })
    .sort((a, b) => b.absoluteDelta - a.absoluteDelta);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const clone = [...arr];
  let s = seed;
  for (let i = clone.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

export function orderAveragedContributions(
  dataset: Dataset,
  baseBuild: BuildConfig,
  samples = 24
): ItemContribution[] {
  const totals = new Map<string, number>();
  baseBuild.itemIds.forEach((id) => totals.set(id, 0));

  for (let i = 1; i <= samples; i += 1) {
    const order = seededShuffle(baseBuild.itemIds, i * 811);
    let prefix: string[] = [];
    let prev = metric(evaluateBuild(dataset, { ...baseBuild, itemIds: prefix }));

    order.forEach((id) => {
      prefix = [...prefix, id];
      const next = metric(evaluateBuild(dataset, { ...baseBuild, itemIds: prefix }));
      totals.set(id, (totals.get(id) ?? 0) + (next - prev));
      prev = next;
    });
  }

  const baseline = metric(evaluateBuild(dataset, baseBuild));
  return [...totals.entries()]
    .map(([itemId, total]) => {
      const avg = total / samples;
      return {
        itemId,
        absoluteDelta: avg,
        percentageDelta: baseline > 0 ? avg / baseline : 0,
        method: "order-averaged" as const,
      };
    })
    .sort((a, b) => b.absoluteDelta - a.absoluteDelta);
}
