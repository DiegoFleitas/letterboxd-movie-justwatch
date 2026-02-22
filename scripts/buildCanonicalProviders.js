/**
 * Build script: fetch GetPackages from JustWatch for all supported countries,
 * build canonical provider maps, and write data/canonical-providers.json.
 *
 * Usage:
 *   node scripts/buildCanonicalProviders.js              # write to data/canonical-providers.json
 *   node scripts/buildCanonicalProviders.js --dry-run    # print to stdout, no file write
 */

import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { buildCanonicalProviderMaps } from "../helpers/canonicalProviders.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, "..", "data", "canonical-providers.json");
const isDryRun = process.argv.includes("--dry-run");

// All JustWatch-supported countries (ISO 3166-1 alpha-2)
const COUNTRIES = [
  "AD", "AE", "AG", "AL", "AO", "AR", "AT", "AU", "AZ",
  "BA", "BB", "BE", "BF", "BG", "BH", "BM", "BO", "BR", "BS", "BY", "BZ",
  "CA", "CD", "CH", "CI", "CL", "CM", "CO", "CR", "CU", "CV", "CY", "CZ",
  "DE", "DJ", "DK", "DO", "DZ",
  "EC", "EE", "EG", "ES", "ET",
  "FI", "FJ", "FR",
  "GB", "GF", "GH", "GI", "GP", "GQ", "GR", "GT",
  "HK", "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IN", "IQ", "IS", "IT",
  "JM", "JO", "JP",
  "KE", "KR", "KW", "KY",
  "LB", "LC", "LI", "LT", "LU", "LV",
  "MA", "MC", "MD", "MK", "ML", "MQ", "MR", "MT", "MU", "MX", "MY", "MZ",
  "NE", "NG", "NI", "NL", "NO", "NZ",
  "OM",
  "PA", "PE", "PH", "PK", "PL", "PS", "PT", "PY",
  "QA",
  "RO", "RS", "RU", "RW",
  "SA", "SC", "SE", "SG", "SI", "SK", "SM", "SN", "SV",
  "TC", "TH", "TN", "TR", "TT", "TW", "TZ",
  "UA", "UG", "US", "UY", "UZ",
  "VE", "XK",
  "YE", "ZA", "ZM", "ZW",
];

const GRAPHQL_URL = "https://apis.justwatch.com/graphql";

const GET_PACKAGES_QUERY = `
  query GetPackages($platform: Platform! = WEB, $country: Country!) {
    packages(country: $country, platform: $platform, includeAddons: false) {
      clearName
      technicalName
    }
  }
`;

async function fetchPackagesForCountry(country) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: GET_PACKAGES_QUERY,
      variables: { platform: "WEB", country },
    }),
  });
  if (!res.ok) {
    console.warn(`[buildCanonicalProviders] ${country}: HTTP ${res.status} – skipping`);
    return [];
  }
  const json = await res.json();
  const pkgs = json?.data?.packages;
  if (!Array.isArray(pkgs)) {
    console.warn(`[buildCanonicalProviders] ${country}: unexpected response – skipping`);
    return [];
  }
  return pkgs;
}

async function main() {
  console.log(`Fetching packages for ${COUNTRIES.length} countries…`);
  const allPackages = [];

  for (const country of COUNTRIES) {
    process.stdout.write(`  ${country}… `);
    try {
      const pkgs = await fetchPackagesForCountry(country);
      process.stdout.write(`${pkgs.length} packages\n`);
      allPackages.push(...pkgs);
    } catch (err) {
      process.stdout.write(`error (${err.message}) – skipping\n`);
    }
  }

  console.log(`\nBuilding canonical maps from ${allPackages.length} total package entries…`);
  const { byTechnicalName, byClearName } = buildCanonicalProviderMaps(allPackages);
  const technicalCount = Object.keys(byTechnicalName).length;
  const clearCount = Object.keys(byClearName).length;
  console.log(`  byTechnicalName: ${technicalCount} entries`);
  console.log(`  byClearName: ${clearCount} entries`);

  const output = JSON.stringify({ byTechnicalName, byClearName }, null, 2);

  if (isDryRun) {
    console.log("\n[dry-run] Output (first 2000 chars):");
    console.log(output.slice(0, 2000));
    console.log(`\n[dry-run] Would write ${output.length} bytes to ${outputPath}`);
  } else {
    writeFileSync(outputPath, output, "utf8");
    console.log(`\nWrote ${output.length} bytes to ${outputPath}`);
  }
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
