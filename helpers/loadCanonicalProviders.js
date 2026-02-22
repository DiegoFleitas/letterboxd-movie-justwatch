/**
 * Load the pre-built canonical provider map once (from data/canonical-providers.json).
 * Supports format { byTechnicalName, byClearName } or legacy flat byTechnicalName.
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const dataPath = join(rootDir, "data/canonical-providers.json");

let cached = null;

/** Reset cache (for tests). */
export function _resetCache() {
  cached = null;
}

/** Inject data for tests (bypasses file read). Shape: { byTechnicalName?, byClearName? }. */
export function _injectForTest(data) {
  cached = data && (data.byTechnicalName != null || data.byClearName != null)
    ? { byTechnicalName: data.byTechnicalName ?? {}, byClearName: data.byClearName ?? {} }
    : null;
}

function load() {
  if (cached !== null) return cached;
  if (!existsSync(dataPath)) {
    cached = { byTechnicalName: {}, byClearName: {} };
    return cached;
  }
  try {
    const raw = readFileSync(dataPath, "utf8");
    const data = JSON.parse(raw);
    if (data.byTechnicalName && data.byClearName) {
      cached = data;
    } else {
      cached = { byTechnicalName: data, byClearName: {} };
    }
    return cached;
  } catch (err) {
    console.warn("[loadCanonicalProviders] Failed to load:", err.message);
    cached = { byTechnicalName: {}, byClearName: {} };
    return cached;
  }
}

export function getCanonicalProviderMap() {
  return load().byTechnicalName;
}

export function getCanonicalProviderByNames() {
  return load().byClearName;
}
