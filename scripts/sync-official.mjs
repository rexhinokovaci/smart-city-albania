// Imports cameras published by Albanian public bodies into data/official.geojson.
// Each adapter reads one official public page. A failing adapter keeps its previous features.
import { writeFile } from "node:fs/promises";
import { inAlbania, readJson } from "./lib.mjs";

const OUT = "data/official.geojson";

const ADAPTERS = [
  {
    key: "tirana-traffic",
    page: "https://tirana.al/kamera-trafiku",
    operator: "Bashkia Tiranë",
    async fetchFeatures() {
      const res = await fetch(this.page, { headers: { "User-Agent": "Mozilla/5.0 (smart-city-albania sync)" }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const objects = html.match(/\{"id":\d+,"name":"[^"]*","url":"[^"]*","lattitude":"[^"]*","longitude":"[^"]*"[^{}]*\}/g) ?? [];
      return objects.map((raw) => JSON.parse(raw)).map((c) => {
        const lat = Number(c.lattitude);
        const lon = Number(c.longitude);
        if (!inAlbania(lat, lon)) return null;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [lon, lat] },
          properties: {
            id: `tirana-${c.id}`,
            type: "cctv",
            name: c.name.trim(),
            operator: this.operator,
            purpose: "traffic",
            installed: c.createdDate?.slice(0, 10),
            source: this.page,
            verified: true,
          },
        };
      }).filter(Boolean);
    },
  },
];

const previous = await readJson(OUT).catch(() => ({ features: [] }));
const features = [];
let failures = 0;
for (const adapter of ADAPTERS) {
  const kept = previous.features.filter((f) => f.properties.adapter === adapter.key);
  try {
    const fresh = (await adapter.fetchFeatures()).map((f) => ({ ...f, properties: { ...f.properties, adapter: adapter.key } }));
    // An empty or collapsed result usually means the page layout changed, not that cameras vanished.
    if (!fresh.length || (kept.length >= 5 && fresh.length < kept.length * 0.5)) throw new Error(`suspicious result: ${fresh.length} vs ${kept.length} previously`);
    features.push(...fresh);
    console.log(`${adapter.key}: ${fresh.length} cameras`);
  } catch (e) {
    failures++;
    features.push(...kept);
    console.warn(`${adapter.key} failed (${e.message}); kept ${kept.length} previous cameras`);
  }
}

features.sort((a, b) => a.properties.id.localeCompare(b.properties.id, "en", { numeric: true }));
await writeFile(OUT, JSON.stringify({ type: "FeatureCollection", generated: new Date().toISOString(), features }, null, 1) + "\n");
console.log(`Wrote ${features.length} official cameras to ${OUT}.`);
if (failures === ADAPTERS.length) process.exit(1);
