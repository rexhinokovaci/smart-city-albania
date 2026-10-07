// Validates curated camera data and content front matter. Exits non-zero on any error.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { CAMERA_TYPES, CONTENT_KINDS, inAlbania, parseFrontMatter, readJson } from "./lib.mjs";

const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function validateCameras(path) {
  const fc = await readJson(path);
  if (fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) return err(path, "not a FeatureCollection");
  const ids = new Set();
  fc.features.forEach((f, i) => {
    const where = `${path}#${i}`;
    const p = f.properties ?? {};
    if (f.type !== "Feature" || f.geometry?.type !== "Point") return err(where, "must be a Point Feature");
    const [lon, lat] = f.geometry.coordinates ?? [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inAlbania(lat, lon)) err(where, `coordinates outside Albania: ${lon},${lat}`);
    if (typeof p.id !== "string" || !p.id) err(where, "properties.id required");
    else if (ids.has(p.id)) err(where, `duplicate id ${p.id}`);
    else ids.add(p.id);
    if (!CAMERA_TYPES.includes(p.type)) err(where, `type must be one of ${CAMERA_TYPES.join(", ")}`);
    if (p.direction !== undefined && !(Number.isInteger(p.direction) && p.direction >= 0 && p.direction < 360)) err(where, "direction must be an integer 0-359");
    if (typeof p.source !== "string" || !p.source) err(where, "source required (issue URL or document URL)");
    if (typeof p.verified !== "boolean") err(where, "verified must be boolean");
    if (!DATE.test(p.added ?? "")) err(where, "added must be YYYY-MM-DD");
  });
}

async function validateContent() {
  for (const [kind, cfg] of Object.entries(CONTENT_KINDS)) {
    let files = [];
    try { files = (await readdir(cfg.dir)).filter((f) => f.endsWith(".md")); } catch { continue; }
    for (const file of files) {
      const where = join(cfg.dir, file);
      try {
        const { meta, body } = parseFrontMatter(await readFile(where, "utf8"));
        const slug = file.replace(/\.md$/, "");
        if (!SLUG.test(slug)) err(where, "filename must be a lowercase-hyphenated slug");
        for (const k of ["title", "description", "date", "lang"]) if (!meta[k]) err(where, `front matter '${k}' required`);
        if (meta.date && !DATE.test(meta.date)) err(where, "date must be YYYY-MM-DD");
        if (meta.lang && !["sq", "en"].includes(meta.lang)) err(where, "lang must be sq or en");
        if (meta.description && meta.description.length > 170) err(where, "description should be <= 170 chars for SEO");
        if (cfg.requireSources) {
          const sources = Array.isArray(meta.sources) ? meta.sources : [];
          if (!sources.length) err(where, `${kind} posts must list at least one source URL`);
          for (const s of sources) if (!/^https:\/\//.test(s)) err(where, `source must be an https URL: ${s}`);
        }
        if (/<\/?[a-z][\s\S]*?>/i.test(body)) err(where, "raw HTML is not allowed in content; use Markdown");
        if (/\]\(\s*(javascript|data|vbscript):/i.test(body)) err(where, "unsafe link scheme");
        if (body.trim().length < 200) err(where, "body too short (< 200 chars)");
      } catch (e) {
        err(where, e.message);
      }
    }
  }
}

await validateCameras("data/cameras.geojson");
for (const f of ["data/osm.geojson", "data/official.geojson"]) await readJson(f).catch((e) => err(f, e.message));
await validateContent();

if (errors.length) {
  console.error(`Validation failed (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log("Validation passed.");
