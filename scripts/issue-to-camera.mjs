// A maintainer applied the "approved" label: add the camera as verified, or upgrade
// an auto-imported (unverified) entry from the same issue to verified.
import { readFile, writeFile } from "node:fs/promises";
import { readJson } from "./lib.mjs";
import { parseCameraIssue } from "./reports.mjs";

const { issue } = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const { lat, lon, properties } = parseCameraIssue(issue);

const path = "data/cameras.geojson";
const fc = await readJson(path);
const existing = fc.features.find((f) => f.properties.id === properties.id);
if (existing) {
  existing.properties.verified = true;
  console.log(`Marked ${properties.id} as verified.`);
} else {
  fc.features.push({
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: { ...properties, verified: true, added: new Date().toISOString().slice(0, 10) },
  });
  console.log(`Added ${properties.id} at ${lat}, ${lon} (${properties.type}).`);
}
await writeFile(path, JSON.stringify(fc, null, 2) + "\n");
