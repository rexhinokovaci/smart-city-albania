// Static site build: map app + markdown content + generated city pages, sitemap, RSS, llms.txt.
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { marked } from "marked";

marked.use({ renderer: { html: (token) => esc(typeof token === "string" ? token : token.text) } });
import { CONTENT_KINDS, cityFor, distanceKm, escapeHtml as esc, parseFrontMatter, readJson } from "./lib.mjs";

const SITE_URL = (process.env.SITE_URL ?? "https://rexhinokovaci.github.io/smart-city-albania").replace(/\/$/, "");
const OUT = "dist";
const TYPE_LABELS = { alpr: "Lexues targash (ALPR)", cctv: "Kamera CCTV", dome: "Kamera kupolë (PTZ)", speed: "Kamera shpejtësie", other: "Tjetër" };
const KIND_TITLES = { news: "Lajme për Smart City Albania", guides: "Të drejtat e tua dhe udhëzues" };
const today = new Date().toISOString().slice(0, 10);

async function write(path, content) {
  await mkdir(dirname(join(OUT, path)), { recursive: true });
  await writeFile(join(OUT, path), content);
}

// `depth` = how many directories below the site root this page lives, for relative asset links.
function layout({ title, description, path, depth, body, jsonLd, lang = "sq" }) {
  const up = "../".repeat(depth);
  const canonical = `${SITE_URL}/${path}`;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self' data: https:; object-src 'none'; base-uri 'self'; form-action 'none'; upgrade-insecure-requests">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)} — Smart City Albania</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<link rel="alternate" type="application/rss+xml" title="Lajme — Smart City Albania" href="${SITE_URL}/feed.xml">
<link rel="icon" href="${up}assets/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${up}assets/style.css">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body>
<header class="topbar">
  <a class="brand" href="${up || "./"}"><img src="${up}assets/icon.svg" alt="" width="28" height="28"><span>Smart City <b>Albania</b></span></a>
  <nav class="topnav"><a href="${up}">Harta</a><a href="${up}lajme/">Lajme</a><a href="${up}udhezues/">Të drejtat</a><a href="${up}qytete/">Qytetet</a><a href="${up}udhezues/rreth-projektit/">Rreth nesh</a></nav>
</header>
<main class="page">
${body}
</main>
<footer class="site-footer">© ${new Date().getFullYear()} Modex Apps · Të gjitha të drejtat e rezervuara · Të dhënat e hartës © OpenStreetMap contributors (ODbL) · <a href="${up}udhezues/privatesia-e-faqes/">Privatësia</a></footer>
</body>
</html>
`;
}

async function loadContent(kind) {
  const cfg = CONTENT_KINDS[kind];
  let files = [];
  try { files = (await readdir(cfg.dir)).filter((f) => f.endsWith(".md")); } catch { return []; }
  const items = [];
  for (const file of files) {
    const { meta, body } = parseFrontMatter(await readFile(join(cfg.dir, file), "utf8"));
    if (meta.draft === "true") continue;
    items.push({ ...meta, kind, slug: file.replace(/\.md$/, ""), route: cfg.route, html: marked.parse(body), sources: meta.sources ?? [] });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

function renderArticle(item) {
  const path = `${item.route}/${item.slug}/`;
  const sources = item.sources.length
    ? `<section class="sources"><h2>Burimet</h2><ol>${item.sources.map((s) => `<li><a href="${esc(s)}" rel="noopener nofollow" target="_blank">${esc(s)}</a></li>`).join("")}</ol></section>`
    : "";
  const body = `<article>
<h1>${esc(item.title)}</h1>
<p class="meta"><time datetime="${esc(item.date)}">${esc(item.date)}</time>${item.updated ? ` · përditësuar ${esc(item.updated)}` : ""}</p>
${item.html}
${sources}
<a class="btn btn-primary cta" href="../../">Shiko hartën e kamerave →</a>
</article>`;
  const jsonLd = {
    "@context": "https://schema.org", "@type": item.kind === "news" ? "NewsArticle" : "Article",
    headline: item.title, description: item.description, datePublished: item.date, dateModified: item.updated ?? item.date,
    inLanguage: item.lang, mainEntityOfPage: `${SITE_URL}/${path}`, publisher: { "@type": "Organization", name: "Modex Apps" },
    ...(item.sources.length ? { citation: item.sources } : {}),
  };
  return { path, html: layout({ title: item.title, description: item.description, path, depth: 2, body, jsonLd, lang: item.lang }) };
}

function renderIndex(kind, items) {
  const route = CONTENT_KINDS[kind].route;
  const body = `<h1>${esc(KIND_TITLES[kind])}</h1>
<ul class="cards">${items.map((i) => `<li><a href="${i.slug}/"><strong>${esc(i.title)}</strong><small>${esc(i.date)} · ${esc(i.description)}</small></a></li>`).join("") || "<li>Së shpejti.</li>"}</ul>`;
  return { path: `${route}/`, html: layout({ title: KIND_TITLES[kind], description: `${KIND_TITLES[kind]} — burime të verifikuara, të përditësuara rregullisht.`, path: `${route}/`, depth: 1, body }) };
}

function renderCity(city, cams) {
  const path = `qytete/${city.slug}/`;
  const counts = Object.fromEntries(Object.keys(TYPE_LABELS).map((k) => [k, cams.filter((c) => c.type === k).length]));
  const title = `Kamerat e mbikëqyrjes në ${city.name}`;
  const named = cams.filter((c) => c.origin === "official" && c.name);
  const description = `${cams.length} kamera të regjistruara në ${city.name}, përfshirë ${counts.alpr} lexues targash. Shiko hartën dhe njih të drejtat e tua.`;
  const rows = Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `<tr><td>${TYPE_LABELS[k]}</td><td>${n}</td></tr>`).join("");
  const body = `<h1>${esc(title)}</h1>
<p class="meta">Përditësuar ${today}</p>
<p>Në hartën tonë publike janë regjistruar <strong>${cams.length}</strong> kamera mbikëqyrjeje brenda rreth ${city.radiusKm} km nga qendra e ${esc(city.name)}. Të dhënat vijnë nga burime zyrtare publike, raportime të verifikuara dhe OpenStreetMap.</p>
${rows ? `<table><thead><tr><th>Lloji</th><th>Numri</th></tr></thead><tbody>${rows}</tbody></table>` : "<p>Ende nuk ka kamera të regjistruara këtu. Ndihmo duke raportuar një.</p>"}
${city.smartCity ? `<p><strong>${esc(city.name)} është një nga 20 qytetet e programit qeveritar Smart City</strong>, ku po instalohen kamera inteligjente që lexojnë edhe targat (<a href="https://euronews.al/cilat-jane-20-qytetet-e-shqiperise-qe-do-monitorohen-nga-kamerat/" rel="noopener nofollow" target="_blank">Euronews Albania, 2024</a>). Vendndodhjet e tyre nuk janë publikuar zyrtarisht.</p>` : ""}
${named.length ? `<h2>Kamerat zyrtare të publikuara</h2><ul>${named.map((c) => `<li>${esc(c.name)}${c.operator ? ` · ${esc(c.operator)}` : ""}</li>`).join("")}</ul>` : ""}
<h2>Çfarë duhet të dish</h2>
<p>Kamerat në hapësira publike përpunojnë të dhëna personale. Ke të drejtë të dish kush i operon, për çfarë qëllimi dhe sa kohë ruhen pamjet, si dhe të kërkosh pamjet ku shfaqesh ti. <a href="../../udhezues/si-te-kerkosh-pamjet-e-kameres/">Lexo si t'i kërkosh</a>.</p>
<a class="btn btn-primary cta" href="../../#14/${city.lat}/${city.lon}">Hap hartën e ${esc(city.name)} →</a>`;
  const jsonLd = { "@context": "https://schema.org", "@type": "WebPage", name: title, description, about: { "@type": "City", name: city.name, geo: { "@type": "GeoCoordinates", latitude: city.lat, longitude: city.lon } } };
  return { path, html: layout({ title, description, path, depth: 2, body, jsonLd }) };
}

function rss(items) {
  const entries = items.slice(0, 50).map((i) => `<item><title>${esc(i.title)}</title><link>${SITE_URL}/${i.route}/${i.slug}/</link><guid>${SITE_URL}/${i.route}/${i.slug}/</guid><pubDate>${new Date(`${i.date}T08:00:00Z`).toUTCString()}</pubDate><description>${esc(i.description)}</description></item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Smart City Albania — Lajme</title><link>${SITE_URL}/</link><description>Lajme dhe analiza mbi kamerat e mbikëqyrjes në Shqipëri.</description><language>sq</language>
${entries}
</channel></rss>
`;
}

// ---- build ----
await rm(OUT, { recursive: true, force: true });
await cp("src", OUT, { recursive: true });
await cp("data", join(OUT, "data"), { recursive: true });

const curated = await readJson("data/cameras.geojson");
const official = await readJson("data/official.geojson");
const osm = await readJson("data/osm.geojson");
const cities = await readJson("data/cities.json");

// Merge sources by priority (curated > official > OSM). A lower-priority camera within
// DEDUPE_M metres of an already-kept one is treated as the same device.
const DEDUPE_M = 15;
const SOURCES = [["community", curated], ["official", official], ["osm", osm]];
const cameras = [];
const ids = new Set();
for (const [origin, fc] of SOURCES) {
  for (const f of fc.features) {
    const [lon, lat] = f.geometry.coordinates;
    if (ids.has(f.properties.id)) continue;
    if (origin !== "community" && cameras.some((c) => c.origin !== origin && distanceKm(lat, lon, c.lat, c.lon) * 1000 < DEDUPE_M)) continue;
    ids.add(f.properties.id);
    cameras.push({ ...f.properties, origin, lat, lon });
  }
}
const byCity = new Map(cities.map((c) => [c.slug, []]));
for (const cam of cameras) {
  const c = cityFor(cam.lat, cam.lon, cities);
  cam.city = c?.name;
  if (c) byCity.get(c.slug).push(cam);
}
await write("data/all.geojson", JSON.stringify({
  type: "FeatureCollection",
  attribution: "Curated © Modex Apps; official data from public bodies as cited; OSM data © OpenStreetMap contributors (ODbL)",
  features: cameras.map(({ lat, lon, ...p }) => ({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: p })),
}) + "\n");
const citiesWithCameras = [...byCity.values()].filter((l) => l.length).length;
await write("data/meta.json", JSON.stringify({ updated: today, total: cameras.length, official: cameras.filter((c) => c.origin === "official").length, citiesWithCameras, smartCityCities: cities.filter((c) => c.smartCity).length, osmGenerated: osm.generated, officialGenerated: official.generated }) + "\n");

const indexHtml = (await readFile("src/index.html", "utf8")).replaceAll("{{SITE_URL}}", SITE_URL);
await write("index.html", indexHtml);

const pages = [{ path: "", priority: "1.0" }];
const allItems = [];
for (const kind of Object.keys(CONTENT_KINDS)) {
  const items = await loadContent(kind);
  allItems.push(...items);
  const idx = renderIndex(kind, items);
  await write(`${idx.path}index.html`, idx.html);
  pages.push({ path: idx.path, priority: "0.8" });
  for (const item of items) {
    const page = renderArticle(item);
    await write(`${page.path}index.html`, page.html);
    pages.push({ path: page.path, lastmod: item.updated ?? item.date, priority: kind === "guides" ? "0.8" : "0.6" });
  }
}

const cityCards = cities.map((c) => ({ c, n: byCity.get(c.slug).length })).sort((a, b) => b.n - a.n);
await write("qytete/index.html", layout({
  title: "Kamerat sipas qytetit", description: "Sa kamera mbikëqyrjeje ka në çdo qytet të Shqipërisë? Numri i përditësuar çdo ditë.", path: "qytete/", depth: 1,
  body: `<h1>Kamerat sipas qytetit</h1><ul class="cards">${cityCards.map(({ c, n }) => `<li><a href="${c.slug}/"><strong>${esc(c.name)}</strong><small>${n} kamera të regjistruara</small></a></li>`).join("")}</ul>`,
}));
pages.push({ path: "qytete/", priority: "0.8" });
for (const city of cities) {
  const page = renderCity(city, byCity.get(city.slug));
  await write(`${page.path}index.html`, page.html);
  pages.push({ path: page.path, lastmod: today, priority: "0.7" });
}

await write("404.html", layout({ title: "Faqja nuk u gjet", description: "Faqja nuk ekziston.", path: "404.html", depth: 0, body: `<h1>404 — Faqja nuk u gjet</h1><p><a href="${SITE_URL}/">Kthehu te harta</a></p>` }).replaceAll('href="assets/', `href="${SITE_URL}/assets/`).replaceAll('src="assets/', `src="${SITE_URL}/assets/`));
await write("feed.xml", rss(allItems.filter((i) => i.kind === "news")));
await write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `<url><loc>${SITE_URL}/${p.path}</loc><lastmod>${p.lastmod ?? today}</lastmod><priority>${p.priority}</priority></url>`).join("\n")}
</urlset>
`);
await write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
await write("llms.txt", `# Smart City Albania

> Public transparency map of surveillance cameras and licence-plate readers (ALPR) in Albania, with guides on residents' privacy rights. Maintained by Modex Apps.

- Cameras mapped: ${cameras.length} (updated ${today})
- Data: ${SITE_URL}/data/cameras.geojson (curated), ${SITE_URL}/data/osm.geojson (© OpenStreetMap contributors, ODbL)

## Guides
${allItems.filter((i) => i.kind === "guides").map((i) => `- [${i.title}](${SITE_URL}/${i.route}/${i.slug}/): ${i.description}`).join("\n")}

## News
${allItems.filter((i) => i.kind === "news").slice(0, 30).map((i) => `- [${i.title}](${SITE_URL}/${i.route}/${i.slug}/): ${i.description}`).join("\n")}

## Cities
${cities.map((c) => `- [${c.name}](${SITE_URL}/qytete/${c.slug}/)`).join("\n")}
`);
await write(".nojekyll", "");
console.log(`Built ${pages.length} pages, ${cameras.length} cameras, ${citiesWithCameras} cities with cameras → ${OUT}/`);
