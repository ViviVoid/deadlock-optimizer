import type { BuildConfig } from "@/lib/types";

const STORAGE_KEY = "deadlock-optimizer-mvp";

export type PersistedState = {
  activeBuild: BuildConfig;
  compareBuild: BuildConfig;
};

export function saveState(state: PersistedState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

export function exportState(state: PersistedState): string {
  return JSON.stringify(state, null, 2);
}

export function importState(raw: string): PersistedState {
  const parsed = JSON.parse(raw) as PersistedState;
  return parsed;
}
