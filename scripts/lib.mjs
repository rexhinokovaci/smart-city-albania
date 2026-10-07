import { readFile } from "node:fs/promises";

// Rough bounding box of Albania, used to reject obviously wrong coordinates.
export const ALBANIA_BBOX = { minLat: 39.6, maxLat: 42.7, minLon: 19.2, maxLon: 21.1 };

export const CAMERA_TYPES = ["alpr", "cctv", "dome", "speed", "other"];

export const CONTENT_KINDS = {
  news: { dir: "content/news", route: "lajme", requireSources: true },
  guides: { dir: "content/guides", route: "udhezues", requireSources: false },
};

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function inAlbania(lat, lon) {
  const b = ALBANIA_BBOX;
  return lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
}

export function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function cityFor(lat, lon, cities) {
  let best = null;
  for (const c of cities) {
    const d = distanceKm(lat, lon, c.lat, c.lon);
    if (d <= c.radiusKm && (!best || d < best.d)) best = { city: c, d };
  }
  return best ? best.city : null;
}

// Minimal front matter parser: `key: value` lines, plus `sources:` followed by `- url` lines.
export function parseFrontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error("missing front matter block");
  const meta = {};
  let listKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && listKey) {
      meta[listKey].push(unquote(item[1].trim()));
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) throw new Error(`cannot parse front matter line: ${line}`);
    const [, key, value] = kv;
    if (value === "") {
      meta[key] = [];
      listKey = key;
    } else {
      meta[key] = unquote(value.trim());
      listKey = null;
    }
  }
  return { meta, body: m[2] };
}

function unquote(s) {
  return s.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
