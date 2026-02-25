import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { CanonicalProviderMap } from "../types/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const dataPath = join(rootDir, "data/canonical-providers.json");

interface CanonicalData {
  byTechnicalName: CanonicalProviderMap;
  byClearName: Record<string, { id: string; name: string }>;
}

let cached: CanonicalData | null = null;

export function _resetCache(): void {
  cached = null;
}

export function _injectForTest(
  data: { byTechnicalName?: CanonicalProviderMap; byClearName?: Record<string, { id: string; name: string }> } | null
): void {
  cached =
    data && (data.byTechnicalName != null || data.byClearName != null)
      ? {
          byTechnicalName: data.byTechnicalName ?? {},
          byClearName: data.byClearName ?? {},
        }
      : null;
}

function load(): CanonicalData {
  if (cached !== null) return cached;
  if (!existsSync(dataPath)) {
    cached = { byTechnicalName: {}, byClearName: {} };
    return cached;
  }
  try {
    const raw = readFileSync(dataPath, "utf8");
    const data = JSON.parse(raw) as
      | { byTechnicalName?: CanonicalProviderMap; byClearName?: Record<string, { id: string; name: string }> }
      | CanonicalProviderMap;
    if (data && typeof data === "object" && "byTechnicalName" in data && "byClearName" in data) {
      cached = data as CanonicalData;
    } else {
      cached = { byTechnicalName: data as CanonicalProviderMap, byClearName: {} };
    }
    return cached;
  } catch (err) {
    console.warn("[loadCanonicalProviders] Failed to load:", (err as Error).message);
    cached = { byTechnicalName: {}, byClearName: {} };
    return cached;
  }
}

export function getCanonicalProviderMap(): CanonicalProviderMap {
  return load().byTechnicalName;
}

export function getCanonicalProviderByNames(): Record<string, { id: string; name: string }> {
  return load().byClearName;
}
