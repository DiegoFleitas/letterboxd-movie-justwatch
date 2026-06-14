import { type ProfilerOnRenderCallback } from "react";

export interface PerfEntry {
  id: string;
  phase: "mount" | "update" | "nested-update";
  actualDuration: number;
  timestamp: number;
}

const entries: PerfEntry[] = [];
const MAX_ENTRIES = 10_000;

const isEnabled =
  typeof window !== "undefined" && (import.meta.env.DEV || import.meta.env.VITE_PROFILER === "1");

export const recordProfile: ProfilerOnRenderCallback = (
  id: string,
  phase: "mount" | "update" | "nested-update",
  actualDuration: number,
): void => {
  if (!isEnabled) return;
  const entry: PerfEntry = { id, phase, actualDuration, timestamp: performance.now() };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  if (import.meta.env.DEV) {
    console.debug(`[Perf] ${id} (${phase}): ${actualDuration.toFixed(2)}ms`);
  }
};

export function getPerfData(): PerfEntry[] {
  return entries;
}

export function clearPerfData(): void {
  entries.length = 0;
}

// Bridge for Playwright to read profiler data via page.evaluate()
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__PERF_DATA__ = {
    getPerfData,
    clearPerfData,
  };
}
