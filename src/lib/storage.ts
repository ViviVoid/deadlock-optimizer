import { buildSchema } from "@/lib/types";
import type { BuildConfig } from "@/lib/types";
import { z } from "zod";

const STORAGE_KEY = "deadlock-optimizer-mvp";

export type PersistedState = {
  activeBuild: BuildConfig;
  compareBuild: BuildConfig;
};

const persistedStateSchema = buildSchema
  .extend({
    itemIds: buildSchema.shape.itemIds.default([]),
    teamModifierIds: buildSchema.shape.teamModifierIds.default([]),
  })
  .transform((build) => ({
    ...build,
    itemIds: [...build.itemIds],
    teamModifierIds: [...build.teamModifierIds],
  }));

const appStateSchema = z.object({
  activeBuild: persistedStateSchema,
  compareBuild: persistedStateSchema.optional(),
});

function normalizeBuild(build: BuildConfig): BuildConfig {
  return {
    ...build,
    soulMode: build.soulMode ?? "autoFromItems",
    soulCount: build.soulCount ?? 900,
    conditionalStates: build.conditionalStates ?? {},
    scenarioId: build.scenarioId || "base",
    enemyId: build.enemyId || "default_enemy",
    itemIds: Array.isArray(build.itemIds) ? build.itemIds : [],
    teamModifierIds: Array.isArray(build.teamModifierIds) ? build.teamModifierIds : [],
  };
}

export function saveState(state: PersistedState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = appStateSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const activeBuild = normalizeBuild(parsed.data.activeBuild);
    const compareBuild = parsed.data.compareBuild
      ? normalizeBuild(parsed.data.compareBuild)
      : activeBuild;
    return {
      activeBuild,
      compareBuild,
    };
  } catch {
    return null;
  }
}

export function exportState(state: PersistedState): string {
  return JSON.stringify(state, null, 2);
}

export function importState(raw: string): PersistedState {
  const parsed = appStateSchema.parse(JSON.parse(raw));
  const activeBuild = normalizeBuild(parsed.activeBuild);
  const compareBuild = parsed.compareBuild ? normalizeBuild(parsed.compareBuild) : activeBuild;
  return { activeBuild, compareBuild };
}
