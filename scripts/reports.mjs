// Parses a "new camera" issue-form body into camera properties. Throws a human-readable
// (Albanian) error for anything invalid. Input is untrusted user text.
import { CAMERA_TYPES, ZONES, inAlbania } from "./lib.mjs";

export function parseCameraIssue(issue) {
  const body = String(issue.body ?? "");
  const field = (label) => {
    const re = new RegExp(`###\\s*${label}[^\\n]*\\n+([\\s\\S]*?)(?=\\n###|$)`);
    const v = body.match(re)?.[1]?.trim();
    return v && v !== "_No response_" ? v : undefined;
  };

  const coords = field("Koordinatat")?.match(/(-?\d{1,2}\.\d{3,})\s*[,; ]\s*(-?\d{1,2}\.\d{3,})/);
  if (!coords) throw new Error("Koordinatat mungojnë ose janë në format të gabuar (p.sh. 41.32750, 19.81870).");
  const lat = Number(Number(coords[1]).toFixed(6));
  const lon = Number(Number(coords[2]).toFixed(6));
  if (!inAlbania(lat, lon)) throw new Error(`Koordinatat ${lat}, ${lon} janë jashtë Shqipërisë.`);

  const type = field("Lloji")?.split(/\s/)[0];
  if (!CAMERA_TYPES.includes(type)) throw new Error(`Lloj i panjohur: ${type}`);

  const zone = field("Ku ndodhet")?.split(/\s/)[0];
  if (zone !== undefined && !ZONES.includes(zone)) throw new Error(`Zonë e panjohur: ${zone}`);

  const dirRaw = field("Drejtimi");
  const direction = dirRaw === undefined ? undefined : Number.parseInt(dirRaw, 10);
  if (direction !== undefined && !(Number.isInteger(direction) && direction >= 0 && direction < 360)) throw new Error("Drejtimi duhet të jetë një numër 0-359.");

  // Operator is free text: keep only letters, digits, spaces and basic punctuation.
  const operator = field("Operatori")?.replace(/[^\p{L}\p{N} .,'()/-]/gu, "").trim().slice(0, 60) || undefined;

  const confirmed = (field("Konfirmim") ?? "").match(/- \[x\]/gi)?.length ?? 0;

  return {
    lat, lon, confirmed,
    properties: {
      id: `sca-${issue.number}`,
      type,
      ...(direction !== undefined && { direction }),
      ...(operator && { operator }),
      ...(zone && { zone }),
      source: issue.html_url,
    },
  };
}
