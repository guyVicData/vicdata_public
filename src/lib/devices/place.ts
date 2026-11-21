// 0.8 front door part 3 (E24): a rough place for a request. Pure, no imports (the proxy uses it).

const COUNTRY: Record<string, string> = { GB: "UK", IE: "Ireland", US: "USA", FR: "France", DE: "Germany", ES: "Spain", NL: "Netherlands" };

/** A rough place from Cloudflare's visitor-location headers: "Reading, UK" (city level at most), or the country
 * alone, or null. Nothing finer is read, and the IP address is never kept. */
export function placeFrom(headers: Headers): string | null {
  const city = headers.get("cf-ipcity")?.trim();
  const cc = headers.get("cf-ipcountry")?.trim().toUpperCase();
  const country = cc && cc !== "XX" && cc !== "T1" ? COUNTRY[cc] ?? cc : null;
  const place = [city, country].filter(Boolean).join(", ");
  return place ? place.slice(0, 80) : null;
}
