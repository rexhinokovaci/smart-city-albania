// Imports open "new camera" reports from GitHub issues as UNVERIFIED cameras.
// Run daily by the content routine. Anti-abuse: account age, per-author cap,
// confirmations, Albania bbox, de-duplication. A maintainer can upgrade with "approved"
// or reject with the "rejected" label.
import { writeFile } from "node:fs/promises";
import { distanceKm, readJson } from "./lib.mjs";
import { parseCameraIssue } from "./reports.mjs";

const REPO = process.env.GITHUB_REPOSITORY ?? "rexhinokovaci/smart-city-albania";
const MIN_ACCOUNT_AGE_DAYS = 7;
const MAX_PER_AUTHOR = 5;
const DEDUPE_M = 15;
const REQUIRED_CONFIRMATIONS = 3;

const headers = { Accept: "application/vnd.github+json", "User-Agent": "smart-city-albania-import" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`GitHub API ${path}: HTTP ${res.status}`);
  return res.json();
}

const issues = (await gh(`/repos/${REPO}/issues?labels=new-camera&state=open&per_page=100&sort=created&direction=asc`))
  .filter((i) => !i.pull_request && !i.labels.some((l) => ["rejected", "approved"].includes(l.name)));

const path = "data/cameras.geojson";
const curated = await readJson(path);
const others = [...(await readJson("data/official.geojson")).features, ...(await readJson("data/osm.geojson")).features];
const known = () => [...curated.features, ...others].map((f) => ({ id: f.properties.id, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));

const accountAge = new Map();
const perAuthor = new Map();
const today = new Date().toISOString().slice(0, 10);
const report = { added: [], skipped: [] };

for (const issue of issues) {
  const author = issue.user?.login;
  const skip = (reason) => report.skipped.push(`#${issue.number} (${author}): ${reason}`);
  if (curated.features.some((f) => f.properties.id === `sca-${issue.number}`)) continue;
  try {
    if (!accountAge.has(author)) {
      const u = await gh(`/users/${encodeURIComponent(author)}`);
      accountAge.set(author, (Date.now() - Date.parse(u.created_at)) / 86_400_000);
    }
    if (accountAge.get(author) < MIN_ACCOUNT_AGE_DAYS) { skip(`account younger than ${MIN_ACCOUNT_AGE_DAYS} days, needs manual review`); continue; }
    if ((perAuthor.get(author) ?? 0) >= MAX_PER_AUTHOR) { skip(`more than ${MAX_PER_AUTHOR} reports today, rest wait for tomorrow`); continue; }

    const { lat, lon, confirmed, properties } = parseCameraIssue(issue);
    if (confirmed < REQUIRED_CONFIRMATIONS) { skip("confirmations not ticked"); continue; }
    const dupe = known().find((k) => distanceKm(lat, lon, k.lat, k.lon) * 1000 < DEDUPE_M);
    if (dupe) { skip(`duplicate of ${dupe.id} (< ${DEDUPE_M} m)`); continue; }

    curated.features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: { ...properties, verified: false, added: today },
    });
    perAuthor.set(author, (perAuthor.get(author) ?? 0) + 1);
    report.added.push(`#${issue.number} → ${properties.id} (${properties.type}${properties.zone ? `, ${properties.zone}` : ""})`);
  } catch (e) {
    skip(e.message);
  }
}

await writeFile(path, JSON.stringify(curated, null, 2) + "\n");
console.log(`Added ${report.added.length} unverified cameras from reports.`);
report.added.forEach((l) => console.log(`  + ${l}`));
report.skipped.forEach((l) => console.log(`  - skipped ${l}`));
