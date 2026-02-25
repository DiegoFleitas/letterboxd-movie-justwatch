const GEO_API_URL = "https://ipapi.co/json/";
const GEO_TIMEOUT_MS = 5000;

interface CountryWithId {
  id: string;
}

function getCountryIdFromLocale(countries: CountryWithId[]): string | null {
  if (typeof navigator === "undefined") return null;
  const lang = navigator.language || navigator.languages?.[0];
  if (!lang) return null;
  const part = lang.split("-")[1] || lang.split("_")[1];
  const code = part ? String(part).toUpperCase() : null;
  const country = code ? countries.find((c) => c.id.endsWith("_" + code)) : null;
  return country ? country.id : null;
}

export async function fetchCountryFromIp(countries: CountryWithId[]): Promise<string | null> {
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
