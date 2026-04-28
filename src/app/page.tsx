"use client";

import { useEffect, useMemo, useState } from "react";
import { sampleDataset } from "@/lib/data/sampleDataset";
import { evaluateBuild } from "@/lib/engine";
import { marginalContributions, orderAveragedContributions } from "@/lib/contributions";
import { optimizeBuilds, type OptimizerObjective } from "@/lib/optimizer";
import { exportState, importState, loadState, saveState, type PersistedState } from "@/lib/storage";
import type { BuildConfig } from "@/lib/types";

const defaultBuild: BuildConfig = {
  heroId: "geist",
  itemIds: ["close_quarters", "rapid_fire_rounds"],
  soulBudget: 6400,
  scenarioId: "sustained",
  enemyId: "default_enemy",
  teamModifierIds: [],
};

function cloneBuild(build: BuildConfig): BuildConfig {
  return {
    ...build,
    itemIds: [...build.itemIds],
    teamModifierIds: [...build.teamModifierIds],
  };
}

export default function Home() {
  const [activeBuild, setActiveBuild] = useState<BuildConfig>(() => {
    const persisted = loadState();
    return persisted ? persisted.activeBuild : defaultBuild;
  });
  const [compareBuild, setCompareBuild] = useState<BuildConfig>(() => {
    const persisted = loadState();
    return persisted
      ? persisted.compareBuild
      : {
          ...defaultBuild,
          itemIds: ["close_quarters"],
        };
  });
  const [objective, setObjective] = useState<OptimizerObjective>("SustainedDPS");
  const [importText, setImportText] = useState("");

  useEffect(() => {
    const payload: PersistedState = { activeBuild, compareBuild };
    saveState(payload);
  }, [activeBuild, compareBuild]);

  const result = useMemo(() => evaluateBuild(sampleDataset, activeBuild), [activeBuild]);
  const compareResult = useMemo(() => evaluateBuild(sampleDataset, compareBuild), [compareBuild]);

  const marginal = useMemo(
    () => marginalContributions(sampleDataset, activeBuild),
    [activeBuild]
  );
  const orderAvg = useMemo(
    () => orderAveragedContributions(sampleDataset, activeBuild),
    [activeBuild]
  );

  const recommendations = useMemo(
    () => optimizeBuilds({ dataset: sampleDataset, baseBuild: activeBuild, objective }),
    [activeBuild, objective]
  );

  const exportJson = useMemo(
    () => exportState({ activeBuild, compareBuild }),
    [activeBuild, compareBuild]
  );

  const updateBuild = (next: Partial<BuildConfig>, target: "active" | "compare") => {
    if (target === "active") setActiveBuild((prev) => ({ ...prev, ...next }));
    else setCompareBuild((prev) => ({ ...prev, ...next }));
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Deadlock Optimizer MVP</h1>
          <p className="text-slate-300 mt-2">
            Gun damage, guardrailed sustained combat, budget-constrained optimization, and item contribution analysis.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Panel title="Build">
            <BuildControls build={activeBuild} setBuild={(n) => updateBuild(n, "active")} />
          </Panel>
          <Panel title="Context">
            <ContextControls build={activeBuild} setBuild={(n) => updateBuild(n, "active")} />
          </Panel>
          <Panel title="Compare Build">
            <BuildControls build={compareBuild} setBuild={(n) => updateBuild(n, "compare")} />
          </Panel>
          <Panel title="Data">
            <p className="text-sm text-slate-300">Dataset version: {sampleDataset.version}</p>
            <button
              className="mt-2 rounded bg-slate-700 px-3 py-1 text-sm"
              onClick={() => navigator.clipboard.writeText(exportJson)}
              type="button"
            >
              Copy Export JSON
            </button>
            <textarea
              className="mt-2 h-24 w-full rounded bg-slate-900 p-2 text-xs"
              placeholder="Paste state JSON here to import"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <button
              className="mt-2 rounded bg-indigo-700 px-3 py-1 text-sm"
              type="button"
              onClick={() => {
                try {
                  const imported = importState(importText);
                  setActiveBuild(cloneBuild(imported.activeBuild));
                  setCompareBuild(cloneBuild(imported.compareBuild));
                  setImportText("");
                } catch {
                  alert("Invalid import JSON");
                }
              }}
            >
              Import JSON
            </button>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Results">
            <Metric label="Damage / Bullet" value={result.breakdown.finalDamagePerBullet} />
            <Metric label="Raw DPS" value={result.rawDps} />
            <Metric label="Guardrailed DPS" value={result.guardrailedDps} />
            <Metric label="Burst Window (3s)" value={result.burstWindowDamage} />
            <Metric label="EHP Multiplier" value={result.ehpMultiplier} />
            <p className="mt-3 text-xs text-amber-300">{result.breakdown.damageAmplification > 1 ? "Experimental damage amplification is enabled." : "Damage amplification is disabled for stability."}</p>
            <ul className="mt-2 list-disc pl-5 text-xs text-slate-300">
              {result.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Panel>

          <Panel title="Delta vs Compare">
            <Metric label="DPS Delta" value={result.guardrailedDps - compareResult.guardrailedDps} />
            <Metric label="Burst Delta" value={result.burstWindowDamage - compareResult.burstWindowDamage} />
            <Metric label="Per Bullet Delta" value={result.breakdown.finalDamagePerBullet - compareResult.breakdown.finalDamagePerBullet} />
            <p className="mt-2 text-xs text-slate-300">
              Active cost: {result.totalCost} / {activeBuild.soulBudget} souls ({result.budgetValid ? "valid" : "over budget"})
            </p>
            <p className="text-xs text-slate-300">
              Compare cost: {compareResult.totalCost} / {compareBuild.soulBudget} souls ({compareResult.budgetValid ? "valid" : "over budget"})
            </p>
          </Panel>

          <Panel title="Optimizer">
            <label className="text-sm">Objective</label>
            <select
              className="mt-1 w-full rounded bg-slate-900 p-2 text-sm"
              value={objective}
              onChange={(e) => setObjective(e.target.value as OptimizerObjective)}
            >
              <option>SustainedDPS</option>
              <option>BurstDamage</option>
              <option>EHP</option>
            </select>
            <ul className="mt-3 space-y-2 text-xs">
              {recommendations.map((rec, i) => (
                <li key={`${rec.build.itemIds.join("-")}-${i}`} className="rounded bg-slate-900 p-2">
                  <p>#{i + 1} score: {rec.score.toFixed(2)}</p>
                  <p>cost: {rec.rationale.totalCost} / {rec.rationale.budget}</p>
                  <p>items: {rec.build.itemIds.join(", ") || "none"}</p>
                  <p>upgrade paths: {rec.rationale.upgradeChains.join(" | ") || "none"}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Item Contribution (Marginal)">
            <ContributionTable rows={marginal} />
          </Panel>
          <Panel title="Item Contribution (Order-Averaged)">
            <ContributionTable rows={orderAvg} />
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-2">{children}</div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-300">{label}</span>
      <span className="font-mono">{value.toFixed(2)}</span>
    </div>
  );
}

function BuildControls({
  build,
  setBuild,
}: {
  build: BuildConfig;
  setBuild: (next: Partial<BuildConfig>) => void;
}) {
  return (
    <>
      <label className="block text-sm">Hero</label>
      <select className="w-full rounded bg-slate-900 p-2 text-sm" value={build.heroId} onChange={(e) => setBuild({ heroId: e.target.value })}>
        {sampleDataset.heroes.map((hero) => (
          <option key={hero.id} value={hero.id}>{hero.name}</option>
        ))}
      </select>

      <label className="block text-sm">Items</label>
      <select
        multiple
        className="h-32 w-full rounded bg-slate-900 p-2 text-sm"
        value={build.itemIds}
        onChange={(e) => {
          const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
          setBuild({ itemIds: ids });
        }}
      >
        {sampleDataset.items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} ({item.baseCost})
          </option>
        ))}
      </select>

      <label className="block text-sm">Soul Budget</label>
      <input
        className="w-full rounded bg-slate-900 p-2 text-sm"
        type="number"
        value={build.soulBudget}
        onChange={(e) => setBuild({ soulBudget: Number(e.target.value) })}
      />
    </>
  );
}

function ContextControls({
  build,
  setBuild,
}: {
  build: BuildConfig;
  setBuild: (next: Partial<BuildConfig>) => void;
}) {
  return (
    <>
      <label className="block text-sm">Enemy</label>
      <select className="w-full rounded bg-slate-900 p-2 text-sm" value={build.enemyId} onChange={(e) => setBuild({ enemyId: e.target.value })}>
        {sampleDataset.enemies.map((enemy) => (
          <option key={enemy.id} value={enemy.id}>{enemy.name}</option>
        ))}
      </select>

      <label className="block text-sm">Scenario</label>
      <select className="w-full rounded bg-slate-900 p-2 text-sm" value={build.scenarioId} onChange={(e) => setBuild({ scenarioId: e.target.value })}>
        {sampleDataset.scenarios.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
        ))}
      </select>

      <label className="block text-sm">Team Modifiers</label>
      <select
        multiple
        className="h-24 w-full rounded bg-slate-900 p-2 text-sm"
        value={build.teamModifierIds}
        onChange={(e) => {
          const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
          setBuild({ teamModifierIds: ids });
        }}
      >
        {sampleDataset.teamModifiers.map((tm) => (
          <option key={tm.id} value={tm.id}>{tm.name}</option>
        ))}
      </select>
    </>
  );
}

function ContributionTable({
  rows,
}: {
  rows: Array<{ itemId: string; absoluteDelta: number; percentageDelta: number }>;
}) {
  return (
    <div className="space-y-1 text-xs">
      {rows.map((row) => {
        const item = sampleDataset.items.find((i) => i.id === row.itemId);
        return (
          <div key={row.itemId} className="flex items-center justify-between rounded bg-slate-900 p-2">
            <span>{item?.name ?? row.itemId}</span>
            <span className="font-mono">+{row.absoluteDelta.toFixed(2)} ({(row.percentageDelta * 100).toFixed(1)}%)</span>
          </div>
        );
      })}
      <p className="pt-2 text-[11px] text-slate-400">
        Attribution caveat: interacting item effects can make isolated contribution estimates non-linear.
      </p>
    </div>
  );
}
