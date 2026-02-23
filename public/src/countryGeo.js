const GEO_API_URL = "https://ipapi.co/json/";
const GEO_TIMEOUT_MS = 5000;

/**
 * When IP geo fails (e.g. localhost), try browser locale (e.g. es-UY → es_UY).
 * @param {Array<{ id: string }>} countries
 * @returns {string|null}
 */
function getCountryIdFromLocale(countries) {
  if (typeof navigator === "undefined") return null;
  const lang = navigator.language || navigator.languages?.[0];
  if (!lang) return null;
  const part = lang.split("-")[1] || lang.split("_")[1];
  const code = part ? String(part).toUpperCase() : null;
  const country = code ? countries.find((c) => c.id.endsWith("_" + code)) : null;
  return country ? country.id : null;
}

/**
 * Fetches country from IP via ipapi.co (HTTPS) and maps to app country id (e.g. en_US).
 * @param {Array<{ id: string }>} countries - List of { id: "lang_COUNTRY" }
 * @returns {Promise<string|null>} Country id if success and in list, else null
 */
export async function fetchCountryFromIp(countries) {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), GEO_TIMEOUT_MS);
  try {
    const res = await fetch(GEO_API_URL, { signal: ac.signal });
    clearTimeout(timeout);
    const data = await res.json();
    const code = data?.country_code ? String(data.country_code).toUpperCase() : null;
    const country = code ? countries.find((c) => c.id.endsWith("_" + code)) : null;
    const id = country ? country.id : null;
    if (id) return id;
    // No valid country from API (e.g. error, localhost). Try browser locale as fallback.
    const localeId = getCountryIdFromLocale(countries);
    return localeId;
  } catch (err) {
    clearTimeout(timeout);
    return null;
  }
}
