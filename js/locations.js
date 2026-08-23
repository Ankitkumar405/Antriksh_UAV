/* ============================================================
   LOCATION CODES
   Named depots / drop points, the way a real ops team would
   refer to them instead of raw coordinates. Free-text search
   (via OpenStreetMap) still works for anywhere not in this list.
   ============================================================ */

const LOCATION_REGISTRY = {
  "WH-PAT-01": { label: "Warehouse — Patna Central", lat: 25.6127, lng: 85.1421 },
  "DRP-PAT-002": { label: "Drop point — Boring Road", lat: 25.6127, lng: 85.1200 },
  "DRP-PAT-014": { label: "Drop point — Kankarbagh", lat: 25.5941, lng: 85.1592 },
  "BASE-ANT-01": { label: "Antriksh field base", lat: 25.5941, lng: 85.1376 },
  "RANCHI-01": { label: "Ranchi — city centre", lat: 23.3441, lng: 85.3096 },
  "JAMTARA-01": { label: "Jamtara — town centre", lat: 23.9633, lng: 86.8014 },
  "KV-JAMTARA": { label: "KV Jamtara — Kendriya Vidyalaya, New Town", lat: 23.9631, lng: 86.7999 },
};
function findLocation(code) {
  if (!code) return null;
  const key = code.trim().toUpperCase();
  return LOCATION_REGISTRY[key] || null;
}

const DEMO_LOCATION_CODES = Object.keys(LOCATION_REGISTRY);

/** Free-text place search via OpenStreetMap Nominatim (client-side, no key needed). */
async function geocodeText(query) {
  if (!query || query.trim().length < 3) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await res.json();
    if (!data || !data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
  } catch (e) {
    console.warn("Geocoding failed:", e);
    return null;
  }
}
