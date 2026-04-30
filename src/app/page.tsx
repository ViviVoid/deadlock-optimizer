"use client";

import { useEffect, useMemo, useState } from "react";
import { sampleDataset } from "@/lib/data/sampleDataset";
import { evaluateBuild, gunInvestmentWeaponDamagePct } from "@/lib/engine";
import { exportState, importState, loadState, saveState, type PersistedState } from "@/lib/storage";
import type { BuildConfig, Item } from "@/lib/types";

const defaultBuild: BuildConfig = {
  heroId: "lady_geist",
  itemIds: ["close_quarters"],
  soulMode: "autoFromItems",
  soulCount: 900,
  conditionalStates: {},
  scenarioId: "base",
  enemyId: "default_enemy",
  teamModifierIds: [],
};

function formatPctFrac(frac: number): string {
  if (!frac) return "";
  const pct = frac * 100;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

function summarizeEffects(e: Partial<Item["effects"]>): string[] {
  const parts: string[] = [];
  if (e.weaponDamagePct) parts.push(`Wpn ${formatPctFrac(e.weaponDamagePct)}`);
  if (e.fireRatePct) parts.push(`RoF ${formatPctFrac(e.fireRatePct)}`);
  if (e.clipSizePct) parts.push(`Clip ${formatPctFrac(e.clipSizePct)}`);
  if (e.reloadReductionPct) parts.push(`Reload −${formatPctFrac(e.reloadReductionPct)}`);
  if (e.bulletLifestealPct) parts.push(`BL ${formatPctFrac(e.bulletLifestealPct)}`);
  if (e.flatWeaponDamage) parts.push(`Flat+wpn ${e.flatWeaponDamage}`);
  if (e.flatBaseDamage) parts.push(`Flat+base ${e.flatBaseDamage}`);
  if (e.damageAmplificationPct) parts.push(`Amp ${formatPctFrac(e.damageAmplificationPct)}`);
  return parts;
}

function itemStatTitle(item: Item): string {
  const innate = summarizeEffects(item.effects).join(" · ") || "—";
  const bonus = item.conditionalEffects ? summarizeEffects(item.conditionalEffects).join(" · ") : "";
  const desc = item.effects.description ? `\n\n${item.effects.description}` : "";
  if (bonus) return `Always: ${innate}\nWhen toggled on: ${bonus}${desc}`;
  return `${innate}${desc}`;
}

function ItemFlags({ item }: { item: Item }) {
  return (
    <span className="mt-0.5 flex flex-wrap gap-1">
      {item.isActiveItem ? (
        <span className="rounded bg-amber-950/80 px-1 text-[10px] text-amber-200">Active</span>
      ) : null}
      {item.hasConditionalEffects ? (
        <span className="rounded bg-violet-950/80 px-1 text-[10px] text-violet-200">Conditional</span>
      ) : null}
    </span>
  );
}

type ItemEffects = Item["effects"];

function emptyEffects(): ItemEffects {
  return {
    weaponDamagePct: 0,
    fireRatePct: 0,
    clipSizePct: 0,
    reloadReductionPct: 0,
    bulletLifestealPct: 0,
    flatWeaponDamage: 0,
    flatBaseDamage: 0,
    damageAmplificationPct: 0,
    description: "",
  };
}

export default function Home() {
  const [activeBuild, setActiveBuild] = useState<BuildConfig>(defaultBuild);
  const [compareBuild, setCompareBuild] = useState<BuildConfig>(defaultBuild);
  const [storageReady, setStorageReady] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [heroPickerOpen, setHeroPickerOpen] = useState(false);
  const [heroQuery, setHeroQuery] = useState("");
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState<"gun" | "vitality" | "spirit">("gun");

  useEffect(() => {
    queueMicrotask(() => {
      const persisted = loadState();
      if (persisted) {
        setActiveBuild(persisted.activeBuild);
        setCompareBuild(persisted.compareBuild);
      }
      setStorageReady(true);
    });
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const payload: PersistedState = { activeBuild, compareBuild };
    saveState(payload);
  }, [activeBuild, compareBuild, storageReady]);

  const result = useMemo(() => evaluateBuild(sampleDataset, activeBuild), [activeBuild]);
  const compareResult = useMemo(() => evaluateBuild(sampleDataset, compareBuild), [compareBuild]);
  const exportJson = useMemo(() => exportState({ activeBuild, compareBuild }), [activeBuild, compareBuild]);
  const activeHero = useMemo(
    () => sampleDataset.heroes.find((h) => h.id === activeBuild.heroId) ?? sampleDataset.heroes[0],
    [activeBuild.heroId]
  );

  const filteredHeroes = useMemo(
    () =>
      sampleDataset.heroes.filter((hero) =>
        hero.name.toLowerCase().includes(heroQuery.trim().toLowerCase())
      ),
    [heroQuery]
  );

  const conditionalItems = useMemo(
    () =>
      sampleDataset.items.filter(
        (item) => item.conditionalId && activeBuild.itemIds.includes(item.id)
      ),
    [activeBuild.itemIds]
  );
  const selectedItems = useMemo(
    () =>
      activeBuild.itemIds
        .map((id) => sampleDataset.items.find((item) => item.id === id))
        .filter((item): item is Item => Boolean(item)),
    [activeBuild.itemIds]
  );
  const categorySoulInvestment = useMemo(() => {
    const totals: Record<"gun" | "vitality" | "spirit", number> = { gun: 0, vitality: 0, spirit: 0 };
    for (const item of selectedItems) totals[item.category] += item.baseCost;
    return totals;
  }, [selectedItems]);
  const gunItemNetEffects = useMemo(() => {
    const totals = emptyEffects();
    for (const item of selectedItems) {
      if (item.category !== "gun") continue;
      totals.weaponDamagePct += item.effects.weaponDamagePct;
      totals.fireRatePct += item.effects.fireRatePct;
      totals.clipSizePct += item.effects.clipSizePct;
      totals.reloadReductionPct += item.effects.reloadReductionPct;
      totals.bulletLifestealPct += item.effects.bulletLifestealPct;
      totals.flatWeaponDamage += item.effects.flatWeaponDamage;
      totals.flatBaseDamage += item.effects.flatBaseDamage;
      totals.damageAmplificationPct += item.effects.damageAmplificationPct;
    }
    return totals;
  }, [selectedItems]);

  const addItem = (itemId: string) => {
    const item = sampleDataset.items.find((entry) => entry.id === itemId);
    if (!item || activeBuild.itemIds.includes(item.id) || activeBuild.itemIds.length >= 12) return;

    let next = [...activeBuild.itemIds];
    if (item.upgradesFrom) {
      next = next.filter((id) => id !== item.upgradesFrom);
    }
    const replacedByUpgrade = sampleDataset.items.filter((candidate) => candidate.upgradesFrom === item.id);
    if (replacedByUpgrade.length > 0) {
      const replacedIds = new Set(replacedByUpgrade.map((candidate) => candidate.id));
      next = next.filter((id) => !replacedIds.has(id));
    }
    next.push(item.id);
    setActiveBuild((prev) => ({ ...prev, itemIds: next }));
  };

  const removeItem = (itemId: string) => {
    setActiveBuild((prev) => ({
      ...prev,
      itemIds: prev.itemIds.filter((id) => id !== itemId),
    }));
  };

  const toggleConditional = (conditionalId: string) => {
    setActiveBuild((prev) => ({
      ...prev,
      conditionalStates: {
        ...prev.conditionalStates,
        [conditionalId]: !prev.conditionalStates[conditionalId],
      },
    }));
  };

  const cloneBuild = (build: BuildConfig): BuildConfig => ({
    ...build,
    itemIds: [...build.itemIds],
    conditionalStates: { ...build.conditionalStates },
    teamModifierIds: [...build.teamModifierIds],
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header>
          <h1 className="text-3xl font-bold">Deadlock Optimizer MVP</h1>
          <p className="text-slate-300 mt-2">Gun-only calculator with boon-aware table outputs.</p>
        </header>

        <section className="grid gap-4 xl:grid-cols-3">
          <Panel title="Hero & Souls">
            <button
              className="rounded bg-indigo-700 px-3 py-2 text-sm font-semibold"
              type="button"
              onClick={() => setHeroPickerOpen((open) => !open)}
            >
              Select Hero: {activeHero?.name ?? "—"}
            </button>
            {heroPickerOpen ? (
              <div className="space-y-2 rounded border border-slate-800 bg-slate-950 p-2">
                <input
                  className="w-full rounded bg-slate-900 p-2 text-sm"
                  placeholder="Search hero..."
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                />
                <HeroGrid
                  heroes={filteredHeroes}
                  activeHeroId={activeBuild.heroId}
                  onSelect={(heroId) => {
                    setActiveBuild((prev) => ({ ...prev, heroId }));
                    setHeroPickerOpen(false);
                  }}
                />
              </div>
            ) : null}
            <div className="rounded border border-slate-800 p-2 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={activeBuild.soulMode === "autoFromItems"}
                  onChange={(e) =>
                    setActiveBuild((prev) => ({
                      ...prev,
                      soulMode: e.target.checked ? "autoFromItems" : "manual",
                    }))
                  }
                />
                Souls based off built items
              </label>
              <p className="mt-2 text-xs text-slate-300">Effective Souls: {result.soulCountUsed}</p>
            </div>
            <input
              className="w-full rounded bg-slate-900 p-2 text-sm"
              type="number"
              value={activeBuild.soulCount}
              onChange={(e) =>
                setActiveBuild((prev) => ({ ...prev, soulCount: Number(e.target.value) }))
              }
              disabled={activeBuild.soulMode === "autoFromItems"}
            />
            <label className="block text-sm">RoF model</label>
            <select
              className="w-full rounded bg-slate-900 p-2 text-sm"
              value={activeBuild.scenarioId}
              onChange={(e) =>
                setActiveBuild((prev) => ({ ...prev, scenarioId: e.target.value }))
              }
            >
              {sampleDataset.scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
          </Panel>
          <Panel title="Built Items (6 x 2)">
            <ItemSlots build={activeBuild} onRemove={removeItem} />
            <button
              className="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold"
              type="button"
              onClick={() => setShopOpen((open) => !open)}
            >
              {shopOpen ? "Close Shop Popup" : "Open Shop Popup"}
            </button>
          </Panel>
          <Panel title="Conditionals">
            {conditionalItems.length === 0 ? (
              <p className="text-xs text-slate-300">No conditional items currently built.</p>
            ) : (
              <div className="space-y-2">
                {conditionalItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full rounded border px-3 py-2 text-left text-xs ${
                      item.conditionalId && activeBuild.conditionalStates[item.conditionalId]
                        ? "border-emerald-500 bg-emerald-950/20"
                        : "border-slate-700 bg-slate-900"
                    }`}
                    onClick={() => item.conditionalId && toggleConditional(item.conditionalId)}
                  >
                    <p className="font-semibold">{item.name}</p>
                    <ItemFlags item={item} />
                    <p className="text-slate-300">{item.conditionalLabel ?? "Conditional active"}</p>
                    <p className="text-[10px] text-slate-400">
                      {summarizeEffects(item.effects).join(" · ") || "—"}
                      {item.conditionalEffects && Object.keys(item.conditionalEffects).length > 0
                        ? ` · (+${summarizeEffects(item.conditionalEffects).join(" · ")} when on)`
                        : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}
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
                  setActiveBuild(imported.activeBuild);
                  setCompareBuild(imported.compareBuild);
                  setImportText("");
                  setImportError(null);
                } catch {
                  setImportError("Invalid import JSON. Check schema and try again.");
                }
              }}
            >
              Import JSON
            </button>
            {importError ? <p className="mt-2 text-xs text-rose-300">{importError}</p> : null}
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Results">
            <ResultsTable result={result} />
            <p className="mt-2 text-xs text-slate-300">Bullet Velocity: {result.bulletVelocityLabel}</p>
          </Panel>
          <Panel title="Delta vs Saved Baseline">
            <DeltaTable active={result} baseline={compareResult} />
            <button
              className="mt-2 w-full rounded bg-emerald-700 px-3 py-2 text-xs font-semibold"
              type="button"
              onClick={() => setCompareBuild(cloneBuild(activeBuild))}
            >
              Save Active to Baseline
            </button>
          </Panel>
          <Panel title="Build Summary">
            <Metric label="Built Item Souls" value={result.totalCost} />
            <Metric label="Effective Souls" value={result.soulCountUsed} />
            <Metric label="Boon Count" value={result.boonCount} />
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Weapon slot souls (investment)</span>
              <span className="font-mono">{result.weaponSoulInvestment}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Gun shop weapon damage</span>
              <span className="font-mono">+{(result.gunInvestmentWeaponPct * 100).toFixed(0)}%</span>
            </div>
            <p className="text-xs text-slate-300">
              Active conditionals: {result.activeConditionals.length > 0 ? result.activeConditionals.join(", ") : "none"}
            </p>
          </Panel>
        </section>
        {shopOpen ? (
          <ShopOverlay
            tab={shopTab}
            setTab={setShopTab}
            activeIds={activeBuild.itemIds}
            build={activeBuild}
            onAdd={addItem}
            onRemove={removeItem}
            onClose={() => setShopOpen(false)}
            categorySoulInvestment={categorySoulInvestment}
            gunItemNetEffects={gunItemNetEffects}
          />
        ) : null}
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

function HeroGrid({
  heroes,
  activeHeroId,
  onSelect,
}: {
  heroes: typeof sampleDataset.heroes;
  activeHeroId: string;
  onSelect: (heroId: string) => void;
}) {
  return (
    <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 lg:grid-cols-3">
      {heroes.map((hero) => (
        <button
          key={hero.id}
          type="button"
          className={`rounded border p-2 text-left text-xs ${
            activeHeroId === hero.id ? "border-indigo-500 bg-indigo-950/50" : "border-slate-700 bg-slate-900"
          }`}
          onClick={() => onSelect(hero.id)}
        >
          <div className="mb-2 h-14 rounded bg-slate-800 text-[10px] text-slate-400 grid place-items-center">
            image placeholder
          </div>
          <p className="font-semibold">{hero.name}</p>
          <p className="text-slate-300">Base DPS {(hero.gun.bulletDamageStart * hero.gun.baseRof * hero.gun.pelletCount).toFixed(2)}</p>
        </button>
      ))}
    </div>
  );
}

function ItemSlots({
  build,
  onRemove,
}: {
  build: BuildConfig;
  onRemove: (itemId: string) => void;
}) {
  const slots = Array.from({ length: 12 }, (_, idx) => build.itemIds[idx] ?? null);
  return (
    <div className="grid grid-cols-2 gap-2">
      {slots.map((itemId, idx) => {
        const item = sampleDataset.items.find((entry) => entry.id === itemId);
        return (
          <button
            key={`${itemId ?? "empty"}-${idx}`}
            type="button"
            className={`min-h-14 rounded border p-2 text-left text-xs ${
              item ? "border-emerald-700 bg-slate-900" : "border-slate-800 bg-slate-950 text-slate-400"
            }`}
            title={item ? itemStatTitle(item) : "Empty slot"}
            onClick={() => {
              if (!itemId) return;
              onRemove(itemId);
            }}
          >
            {item ? (
              <>
                <p className="font-semibold">{item.name}</p>
                <ItemFlags item={item} />
                <p className="text-[10px] text-slate-400">
                  {summarizeEffects(item.effects).join(" · ") || "—"}
                  {item.conditionalEffects && Object.keys(item.conditionalEffects).length > 0
                    ? ` · (+${summarizeEffects(item.conditionalEffects).join(" · ")} when on)`
                    : ""}
                </p>
              </>
            ) : (
              <p>Empty Slot</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ShopMenu({
  tab,
  setTab,
  activeIds,
  onAdd,
}: {
  tab: "gun" | "vitality" | "spirit";
  setTab: (tab: "gun" | "vitality" | "spirit") => void;
  activeIds: string[];
  onAdd: (itemId: string) => void;
}) {
  const tiers: Array<800 | 1600 | 3200 | 6400> = [800, 1600, 3200, 6400];
  return (
    <div className="space-y-2 rounded border border-slate-800 p-2">
      <div className="flex gap-2">
        {(["gun", "vitality", "spirit"] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={`rounded px-3 py-1 text-xs ${tab === candidate ? "bg-indigo-700" : "bg-slate-800"}`}
            onClick={() => setTab(candidate)}
          >
            {candidate}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tiers.map((tier) => (
          <div key={tier} className="rounded border border-slate-800 p-2">
            <p className="mb-2 text-xs font-semibold">{tier}</p>
            <div className="space-y-1">
              {sampleDataset.items
                .filter((item) => item.category === tab && item.tier === tier)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    title={itemStatTitle(item)}
                    className={`w-full rounded px-2 py-1 text-left text-xs ${
                      activeIds.includes(item.id) ? "bg-emerald-900/40 text-emerald-200" : "bg-slate-900"
                    }`}
                    onClick={() => onAdd(item.id)}
                  >
                    <span className="block font-medium">{item.name}</span>
                    <ItemFlags item={item} />
                    <span className="block text-[10px] text-slate-400">
                      {summarizeEffects(item.effects).join(" · ") || "—"}
                    </span>
                    {item.conditionalEffects && Object.keys(item.conditionalEffects).length > 0 ? (
                      <span className="block text-[10px] text-violet-300/90">
                        +{summarizeEffects(item.conditionalEffects).join(" · ")} (toggle)
                      </span>
                    ) : null}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShopOverlay({
  tab,
  setTab,
  activeIds,
  build,
  onAdd,
  onRemove,
  onClose,
  categorySoulInvestment,
  gunItemNetEffects,
}: {
  tab: "gun" | "vitality" | "spirit";
  setTab: (tab: "gun" | "vitality" | "spirit") => void;
  activeIds: string[];
  build: BuildConfig;
  onAdd: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onClose: () => void;
  categorySoulInvestment: Record<"gun" | "vitality" | "spirit", number>;
  gunItemNetEffects: ItemEffects;
}) {
  const gunInvestmentPct = gunInvestmentWeaponDamagePct(sampleDataset, categorySoulInvestment.gun);
  const vitalityInvestmentPct = gunInvestmentWeaponDamagePct(sampleDataset, categorySoulInvestment.vitality);
  const spiritInvestmentPct = gunInvestmentWeaponDamagePct(sampleDataset, categorySoulInvestment.spirit);
  const gunEffectSummary = summarizeEffects(gunItemNetEffects);

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="mx-auto grid h-[88vh] max-w-7xl grid-cols-1 gap-3 rounded-lg border border-slate-700 bg-slate-900 p-3 lg:grid-cols-[280px_1fr_340px]">
        <div className="space-y-2 overflow-y-auto rounded border border-slate-800 bg-slate-950 p-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-300">Built Slots</p>
            <button
              type="button"
              className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-200"
              onClick={onClose}
            >
              Close
            </button>
          </div>
          <ItemSlots build={build} onRemove={onRemove} />
          <p className="text-[11px] text-slate-400">Click an occupied slot to remove the item.</p>
        </div>
        <div className="overflow-y-auto rounded border border-slate-800 bg-slate-950 p-2">
          <ShopMenu tab={tab} setTab={setTab} activeIds={activeIds} onAdd={onAdd} />
        </div>
        <div className="space-y-3 overflow-y-auto rounded border border-slate-800 bg-slate-950 p-3 text-xs">
          <div>
            <p className="text-sm font-semibold">Investment Summary</p>
            <p className="text-[11px] text-slate-400">Breakpoints currently mirror the gun investment table.</p>
          </div>
          <div className="space-y-1 rounded border border-slate-800 p-2">
            <p className="font-medium text-slate-300">Gun</p>
            <p>Soul investment: <span className="font-mono">{categorySoulInvestment.gun}</span></p>
            <p>Applied weapon bonus: <span className="font-mono">+{(gunInvestmentPct * 100).toFixed(0)}%</span></p>
          </div>
          <div className="space-y-1 rounded border border-slate-800 p-2">
            <p className="font-medium text-slate-300">Vitality (placeholder)</p>
            <p>Soul investment: <span className="font-mono">{categorySoulInvestment.vitality}</span></p>
            <p>Projected breakpoint value: <span className="font-mono">+{(vitalityInvestmentPct * 100).toFixed(0)}%</span></p>
          </div>
          <div className="space-y-1 rounded border border-slate-800 p-2">
            <p className="font-medium text-slate-300">Spirit (placeholder)</p>
            <p>Soul investment: <span className="font-mono">{categorySoulInvestment.spirit}</span></p>
            <p>Projected breakpoint value: <span className="font-mono">+{(spiritInvestmentPct * 100).toFixed(0)}%</span></p>
          </div>
          <div className="space-y-1 rounded border border-slate-800 p-2">
            <p className="font-medium text-slate-300">Net Stats from Built Gun Items</p>
            {gunEffectSummary.length > 0 ? (
              <p>{gunEffectSummary.join(" · ")}</p>
            ) : (
              <p className="text-slate-400">No built gun-item bonuses yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsTable({ result }: { result: ReturnType<typeof evaluateBuild> }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-slate-300">
          <th className="text-left py-1">Metric</th>
          {result.rows.map((row) => (
            <th key={row.label} className="text-right py-1">
              {row.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[
          {
            label: "Per pellet",
            title:
              "Per pellet after weapon damage % (item bonuses + gun shop souls in weapon slots), flat adds, and damage amp. Same multiplier for Base, @Boon, and @MaxBoon (hero bullet tier differs).",
            pick: (row: (typeof result.rows)[number]) => row.bulletDamage,
          },
          { label: "RoF", pick: (row: (typeof result.rows)[number]) => row.rof },
          { label: "Per Shot", pick: (row: (typeof result.rows)[number]) => row.perShot },
          { label: "DPS", pick: (row: (typeof result.rows)[number]) => row.dps },
          { label: "Headshot DPS", pick: (row: (typeof result.rows)[number]) => row.headshotDps },
        ].map((metric) => (
          <tr key={metric.label} className="border-t border-slate-800">
            <td className="py-1" title={"title" in metric ? metric.title : undefined}>
              {metric.label}
            </td>
            {result.rows.map((row) => (
              <td key={`${metric.label}-${row.label}`} className="py-1 text-right font-mono">
                {metric.pick(row).toFixed(2)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DeltaTable({
  active,
  baseline,
}: {
  active: ReturnType<typeof evaluateBuild>;
  baseline: ReturnType<typeof evaluateBuild>;
}) {
  const [baseRow, boonRow, maxRow] = active.rows;
  const [bBaseRow, bBoonRow, bMaxRow] = baseline.rows;

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-slate-300">
          <th className="text-left py-1">Delta</th>
          <th className="text-right py-1">Base</th>
          <th className="text-right py-1">@Boon</th>
          <th className="text-right py-1">@MaxBoon</th>
        </tr>
      </thead>
      <tbody>
        {[
          {
            label: "DPS Delta",
            pick: (r: (typeof active.rows)[number]) => r.dps,
          },
          {
            label: "Headshot DPS Delta",
            pick: (r: (typeof active.rows)[number]) => r.headshotDps,
          },
        ].map((metric) => (
          <tr key={metric.label} className="border-t border-slate-800">
            <td className="py-1">{metric.label}</td>
            <td className="py-1 text-right font-mono">{(metric.pick(baseRow) - metric.pick(bBaseRow)).toFixed(2)}</td>
            <td className="py-1 text-right font-mono">{(metric.pick(boonRow) - metric.pick(bBoonRow)).toFixed(2)}</td>
            <td className="py-1 text-right font-mono">{(metric.pick(maxRow) - metric.pick(bMaxRow)).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
