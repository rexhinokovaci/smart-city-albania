// Pulls surveillance cameras in Albania from OpenStreetMap into data/osm.geojson.
// OSM data is © OpenStreetMap contributors, ODbL — it is kept in its own file and attributed.
import { writeFile } from "node:fs/promises";
import { inAlbania, readJson } from "./lib.mjs";

const OUT = "data/osm.geojson";
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const QUERY = `[out:json][timeout:120];
area["ISO3166-1"="AL"][admin_level=2]->.al;
(
  node["man_made"="surveillance"](area.al);
  node["highway"="speed_camera"](area.al);
  node["enforcement"](area.al);
);
out body;`;

function classify(t) {
  if (t.highway === "speed_camera" || t.enforcement === "maxspeed") return "speed";
  if (t["surveillance:type"] === "ALPR" || t.enforcement === "traffic_signals") return "alpr";
  if (t["camera:type"] === "dome") return "dome";
  if (t["surveillance:type"] === "camera" || t.man_made === "surveillance") return "cctv";
  return "other";
}

function parseDirection(raw) {
  const n = Number.parseInt(String(raw ?? "").split(/[;-]/)[0], 10);
  return Number.isFinite(n) ? ((n % 360) + 360) % 360 : undefined;
}

async function fetchOverpass() {
  let lastError;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "smart-city-albania-sync/1.0" },
        body: new URLSearchParams({ data: QUERY }),
        signal: AbortSignal.timeout(150_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastError = e;
      console.warn(`Overpass ${url} failed: ${e.message}`);
    }
  }
  throw new Error(`all Overpass endpoints failed: ${lastError?.message}`);
}

const data = await fetchOverpass();
const features = data.elements
  .filter((el) => el.type === "node" && inAlbania(el.lat, el.lon))
  .map((el) => {
    const t = el.tags ?? {};
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [el.lon, el.lat] },
      properties: {
        id: `osm-${el.id}`,
        type: classify(t),
        direction: parseDirection(t["camera:direction"] ?? t.direction),
        operator: t.operator,
        zone: t["surveillance:zone"],
        source: `https://www.openstreetmap.org/node/${el.id}`,
        verified: true,
      },
    };
  })
  .sort((a, b) => a.properties.id.localeCompare(b.properties.id));

// Guard against a broken upstream response wiping the dataset.
const previous = await readJson(OUT).catch(() => ({ features: [] }));
if (previous.features.length >= 20 && features.length < previous.features.length * 0.5) {
  console.error(`Refusing to write: ${features.length} features vs ${previous.features.length} previously.`);
  process.exit(1);
}

await writeFile(OUT, JSON.stringify({ type: "FeatureCollection", generated: new Date().toISOString(), attribution: "© OpenStreetMap contributors, ODbL", features }, null, 1) + "\n");
console.log(`Wrote ${features.length} OSM cameras to ${OUT}.`);
