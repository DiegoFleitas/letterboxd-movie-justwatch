/**
 * One-time (or periodic) build: fetch GetPackages, build canonical map, write redis/data/canonical-providers.json.
 */
import type { AxiosInstance } from "axios";
import httpClientFactory from "@server/lib/axios.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildCanonicalProviderMaps } from "@server/lib/canonicalProviders.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..", "..");
const isDryRun = process.argv.includes("--dry-run");

const GET_PACKAGES_QUERY = `
  query GetPackages($platform: Platform! = WEB, $country: Country!) {
    packages(country: $country, platform: $platform, includeAddons: true) {
      clearName
      technicalName
    }
  }
`;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface Pkg {
  technicalName: string;
  clearName?: string;
}

async function fetchPackagesForCountry(httpClient: AxiosInstance, country: string): Promise<Pkg[]> {
  const { data } = await httpClient.post(
    "https://apis.justwatch.com/graphql",
    {
      query: GET_PACKAGES_QUERY,
      variables: { platform: "WEB", country },
    },
    { timeout: 15000 },
  );
  const packages = (data as { data?: { packages?: Pkg[] } })?.data?.packages ?? [];
  return packages.map((p) => ({ technicalName: p.technicalName, clearName: p.clearName || "" }));
}

async function main(): Promise<void> {
  const { countries } = await import(
    pathToFileURL(join(rootDir, "src/client/src/countries.ts")).href
  );
  const countryCodes = [
    ...new Set(countries.map((c: { id: string }) => c.id.split("_")[1]).filter(Boolean)),
  ] as string[];

  const httpClient = httpClientFactory();
  const allPackages: Pkg[] = [];
  const delayMs = 300;

  if (isDryRun) {
    console.log("Dry run: fetching packages for 1 country only (no file will be written).");
    const country = countryCodes[0];
    try {
      const packages = await fetchPackagesForCountry(httpClient, country);
      for (const p of packages) allPackages.push(p);
      const canonicalMap = buildCanonicalProviderMaps(allPackages).byTechnicalName;
      console.log(`  Country: ${country}`);
      console.log(`  Packages fetched: ${allPackages.length}`);
      console.log(`  Canonical map entries: ${Object.keys(canonicalMap).length}`);
      console.log("Dry run OK. Run without --dry-run to build the full map.");
      return;
    } catch (err) {
      console.error("Dry run failed:", (err as Error).message);
      process.exit(1);
    }
  }

  console.log(`Fetching packages for ${countryCodes.length} countries...`);
  for (let i = 0; i < countryCodes.length; i++) {
    const country = countryCodes[i];
    try {
      const packages = await fetchPackagesForCountry(httpClient, country);
      for (const p of packages) allPackages.push(p);
      if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${countryCodes.length} countries`);
      if (i < countryCodes.length - 1) await sleep(delayMs);
    } catch (err) {
      console.warn(`  Skip ${country}:`, (err as Error).message);
    }
  }

  const { byTechnicalName, byClearName } = buildCanonicalProviderMaps(allPackages);
  const outPath = join(rootDir, "redis", "data", "canonical-providers.json");
  mkdirSync(dirname(outPath), { recursive: true });
  const payload = { byTechnicalName, byClearName };
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(
    `Wrote ${Object.keys(byTechnicalName).length} byTechnicalName, ${Object.keys(byClearName).length} byClearName to ${outPath}`,
  );
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
