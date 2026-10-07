// Converts an approved "new camera" issue into a curated GeoJSON feature.
// Input is untrusted: it is read from the event payload file, never interpolated into a shell.
import { readFile, writeFile } from "node:fs/promises";
import { CAMERA_TYPES, ZONES, inAlbania, readJson } from "./lib.mjs";

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const issue = event.issue;
const body = String(issue.body ?? "");

function field(label) {
  const re = new RegExp(`###\\s*${label}[^\\n]*\\n+([\\s\\S]*?)(?=\\n###|$)`);
  const v = body.match(re)?.[1]?.trim();
  return v && v !== "_No response_" ? v : undefined;
}

const coords = field("Koordinatat")?.match(/(-?\d{1,2}\.\d{3,})\s*[,; ]\s*(-?\d{1,2}\.\d{3,})/);
if (!coords) throw new Error("Koordinatat mungojnë ose janë në format të gabuar.");
const lat = Number(Number(coords[1]).toFixed(6));
const lon = Number(Number(coords[2]).toFixed(6));
if (!inAlbania(lat, lon)) throw new Error(`Koordinatat ${lat}, ${lon} janë jashtë Shqipërisë.`);

const type = field("Lloji")?.split(/\s/)[0];
if (!CAMERA_TYPES.includes(type)) throw new Error(`Lloj i panjohur: ${type}`);

const zone = field("Ku ndodhet")?.split(/\s/)[0];
if (zone !== undefined && !ZONES.includes(zone)) throw new Error(`Zonë e panjohur: ${zone}`);

const dirRaw = field("Drejtimi");
const direction = dirRaw === undefined ? undefined : Number.parseInt(dirRaw, 10);
if (direction !== undefined && !(direction >= 0 && direction < 360)) throw new Error("Drejtimi duhet të jetë 0-359.");

const operator = field("Operatori")?.replace(/[<>]/g, "").slice(0, 80);

const path = "data/cameras.geojson";
const fc = await readJson(path);
const id = `sca-${issue.number}`;
if (fc.features.some((f) => f.properties.id === id)) throw new Error(`${id} ekziston tashmë.`);
fc.features.push({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties: {
    id, type,
    ...(direction !== undefined && { direction }),
    ...(operator && { operator }),
    ...(zone && { zone }),
    source: issue.html_url,
    verified: true,
    added: new Date().toISOString().slice(0, 10),
  },
});
await writeFile(path, JSON.stringify(fc, null, 2) + "\n");
console.log(`Added ${id} at ${lat}, ${lon} (${type}).`);
