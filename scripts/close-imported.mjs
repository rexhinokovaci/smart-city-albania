// Prints the issue numbers that are referenced as a camera source in data/cameras.geojson.
import { readJson } from "./lib.mjs";

const repo = process.env.GITHUB_REPOSITORY ?? "rexhinokovaci/smart-city-albania";
const prefix = `https://github.com/${repo}/issues/`;
const fc = await readJson("data/cameras.geojson");
const numbers = fc.features
  .map((f) => f.properties.source)
  .filter((s) => typeof s === "string" && s.startsWith(prefix))
  .map((s) => Number.parseInt(s.slice(prefix.length), 10))
  .filter(Number.isInteger);
console.log([...new Set(numbers)].join("\n"));
