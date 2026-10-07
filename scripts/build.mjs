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
const OG_IMAGE = `${SITE_URL}/assets/og.png`;
const PUBLISHER = { "@type": "Organization", name: "Modex Apps", url: "https://modex.al", logo: { "@type": "ImageObject", url: `${SITE_URL}/assets/og.png` } };
const SECTION_NAMES = { lajme: "Lajme", udhezues: "Të drejtat", qytete: "Qytetet", en: "English" };

// BreadcrumbList for every page below the root: Home › Section › Page.
function breadcrumbs(path, title) {
  const parts = path.split("/").filter(Boolean);
  if (!parts.length || path.endsWith(".html")) return null;
  const crumbs = [{ name: "Smart City Albania", url: `${SITE_URL}/` }];
  if (SECTION_NAMES[parts[0]] && parts.length > 1) crumbs.push({ name: SECTION_NAMES[parts[0]], url: `${SITE_URL}/${parts[0]}/` });
  crumbs.push({ name: title, url: `${SITE_URL}/${path}` });
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })) };
}

// Visible FAQ + matching FAQPage schema (Google requires the answers to be on the page).
function faq(items) {
  return {
    html: `<h2>Pyetje të shpeshta</h2>${items.map((q) => `<h3>${esc(q.q)}</h3><p>${esc(q.a)}</p>`).join("")}`,
    jsonLd: { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((q) => ({ "@type": "Question", name: q.q, acceptedAnswer: { "@type": "Answer", text: q.a } })) },
  };
}

async function write(path, content) {
  await mkdir(dirname(join(OUT, path)), { recursive: true });
  await writeFile(join(OUT, path), content);
}

// `depth` = how many directories below the site root this page lives, for relative asset links.
function layout({ title, description, path, depth, body, jsonLd, lang = "sq", ogType = "website", published, alternates = [] }) {
  const up = "../".repeat(depth);
  const canonical = `${SITE_URL}/${path}`;
  const ld = [jsonLd, breadcrumbs(path, title)].flat().filter(Boolean);
  const hreflang = alternates.length
    ? [{ lang, href: canonical }, ...alternates].map((a) => `<link rel="alternate" hreflang="${a.lang}" href="${a.href}">`).join("\n")
    : "";
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
${hreflang}
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="Smart City Albania">
<meta property="og:locale" content="${lang === "en" ? "en_GB" : "sq_AL"}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
${published ? `<meta property="article:published_time" content="${esc(published)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${OG_IMAGE}">
<link rel="alternate" type="application/rss+xml" title="Lajme — Smart City Albania" href="${SITE_URL}/feed.xml">
<link rel="icon" href="${up}assets/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${up}assets/style.css">
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body>
<header class="topbar">
  <a class="brand" href="${up || "./"}"><img src="${up}assets/icon.svg" alt="" width="28" height="28"><span>Smart City <b>Albania</b></span></a>
  <nav class="topnav"><a href="${up}">Harta</a><a href="${up}lajme/">Lajme</a><a href="${up}udhezues/">Të drejtat</a><a href="${up}qytete/">Qytetet</a><a href="${up}udhezues/rreth-projektit/">Rreth nesh</a></nav>
</header>
<main class="page">
${body}
</main>
<footer class="site-footer">© ${new Date().getFullYear()} Modex Apps & kontribuuesit · Open source: kodi AGPL-3.0, përmbajtja CC BY-SA 4.0, të dhënat ODbL · Harta © OpenStreetMap contributors · <a href="https://github.com/rexhinokovaci/smart-city-albania">Kontribuo në GitHub</a> · <a href="${up}udhezues/privatesia-e-faqes/">Privatësia</a></footer>
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
    ? `<section class="sources"><h2>${item.lang === "en" ? "Sources" : "Burimet"}</h2><ol>${item.sources.map((s) => `<li><a href="${esc(s)}" rel="noopener nofollow" target="_blank">${esc(s)}</a></li>`).join("")}</ol></section>`
    : "";
  const body = `<article>
<h1>${esc(item.title)}</h1>
<p class="meta"><time datetime="${esc(item.date)}">${esc(item.date)}</time>${item.updated ? ` · ${item.lang === "en" ? "updated" : "përditësuar"} ${esc(item.updated)}` : ""}</p>
${item.html}
${sources}
<a class="btn btn-primary cta" href="../../${item.lang === "en" ? "en/" : ""}">${item.lang === "en" ? "See the camera map →" : "Shiko hartën e kamerave →"}</a>
</article>`;
  const jsonLd = {
    "@context": "https://schema.org", "@type": item.kind === "news" ? "NewsArticle" : "Article",
    headline: item.title, description: item.description, datePublished: item.date, dateModified: item.updated ?? item.date,
    inLanguage: item.lang, mainEntityOfPage: `${SITE_URL}/${path}`, image: OG_IMAGE, author: PUBLISHER, publisher: PUBLISHER,
    ...(item.sources.length ? { citation: item.sources } : {}),
  };
  // `translation: lajme/other-slug` in front matter links the two language versions (hreflang both ways).
  const alternates = item.translation ? [{ lang: item.lang === "en" ? "sq" : "en", href: `${SITE_URL}/${item.translation.replace(/^\/|\/$/g, "")}/` }] : [];
  return { path, html: layout({ title: item.title, description: item.description, path, depth: 2, body, jsonLd, lang: item.lang, ogType: "article", published: item.date, alternates }) };
}

function renderIndex(kind, items) {
  const route = CONTENT_KINDS[kind].route;
  const body = `<h1>${esc(KIND_TITLES[kind])}</h1>
<ul class="cards">${items.map((i) => `<li><a href="${i.slug}/"><strong>${esc(i.title)}</strong><small>${esc(i.date)} · ${esc(i.description)}</small></a></li>`).join("") || "<li>Së shpejti.</li>"}</ul>`;
  return { path: `${route}/`, html: layout({ title: KIND_TITLES[kind], description: `${KIND_TITLES[kind]} — burime të verifikuara, të përditësuara rregullisht.`, path: `${route}/`, depth: 1, body }) };
}

function renderCity(city, cams, cities) {
  const nearby = cities.filter((c) => c.slug !== city.slug).sort((x, y) => distanceKm(city.lat, city.lon, x.lat, x.lon) - distanceKm(city.lat, city.lon, y.lat, y.lon)).slice(0, 4);
  const path = `qytete/${city.slug}/`;
  const counts = Object.fromEntries(Object.keys(TYPE_LABELS).map((k) => [k, cams.filter((c) => c.type === k).length]));
  const title = `Kamerat e mbikëqyrjes në ${city.name}`;
  const named = cams.filter((c) => c.origin === "official" && c.name);
  const description = `${cams.length} kamera të regjistruara në ${city.name}, përfshirë ${counts.alpr} lexues targash. Shiko hartën dhe njih të drejtat e tua.`;
  const q = faq([
    { q: `Sa kamera mbikëqyrjeje ka në ${city.name}?`, a: `Në hartën publike Smart City Albania janë regjistruar ${cams.length} kamera në ${city.name} (përditësuar ${today}), nga të cilat ${counts.alpr} lexues targash dhe ${counts.speed} kamera shpejtësie. Numri real ka shumë gjasa të jetë më i lartë, sepse vendndodhjet e kamerave të programit qeveritar Smart City nuk janë publikuar.` },
    { q: `A është ${city.name} pjesë e programit Smart City?`, a: city.smartCity ? `Po. ${city.name} është një nga 20 qytetet ku sipas raportimeve po instalohen kamera inteligjente, përfshirë kamera që lexojnë targat (ANPR/ALPR).` : `${city.name} nuk është në listën e 20 qyteteve të raportuara për fazën e parë të programit Smart City. Kamerat e bashkisë, të policisë dhe ato private mund të ekzistojnë gjithsesi.` },
    { q: "Si mund t'i kërkoj pamjet e kamerës ku shfaqem?", a: "Sipas Ligjit nr. 124/2024 për mbrojtjen e të dhënave personale, mund t'i dërgosh një kërkesë me shkrim operatorit të kamerës (Policia e Shtetit, bashkia ose subjekti privat) me datën, orën dhe vendin. Operatori duhet të përgjigjet brenda 30 ditëve. Nëse nuk të përgjigjen, mund të ankohesh te Komisioneri (IDP)." },
    { q: "Si raportoj një kamerë që mungon në hartë?", a: "Përdor formularin 'Raporto një kamerë' në hartë. Shëno vendndodhjen, llojin dhe drejtimin e kamerës. Raportimet shfaqen si të paverifikuara derisa t'i konfirmojë një mirëmbajtës." },
  ]);
  const rows = Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `<tr><td>${TYPE_LABELS[k]}</td><td>${n}</td></tr>`).join("");
  const body = `<h1>${esc(title)}</h1>
<p class="meta">Përditësuar ${today}</p>
<p>Në hartën tonë publike janë regjistruar <strong>${cams.length}</strong> kamera mbikëqyrjeje brenda rreth ${city.radiusKm} km nga qendra e ${esc(city.name)}. Të dhënat vijnë nga burime zyrtare publike, raportime të verifikuara dhe OpenStreetMap.</p>
${rows ? `<table><thead><tr><th>Lloji</th><th>Numri</th></tr></thead><tbody>${rows}</tbody></table>` : "<p>Ende nuk ka kamera të regjistruara këtu. Ndihmo duke raportuar një.</p>"}
${city.smartCity ? `<p><strong>${esc(city.name)} është një nga 20 qytetet e programit qeveritar Smart City</strong>, ku po instalohen kamera inteligjente që lexojnë edhe targat (<a href="https://euronews.al/cilat-jane-20-qytetet-e-shqiperise-qe-do-monitorohen-nga-kamerat/" rel="noopener nofollow" target="_blank">Euronews Albania, 2024</a>). Vendndodhjet e tyre nuk janë publikuar zyrtarisht.</p>` : ""}
${named.length ? `<h2>Kamerat zyrtare të publikuara</h2><ul>${named.map((c) => `<li>${esc(c.name)}${c.operator ? ` · ${esc(c.operator)}` : ""}</li>`).join("")}</ul>` : ""}
<h2>Çfarë duhet të dish</h2>
<p>Kamerat në hapësira publike përpunojnë të dhëna personale. Ke të drejtë të dish kush i operon, për çfarë qëllimi dhe sa kohë ruhen pamjet, si dhe të kërkosh pamjet ku shfaqesh ti. <a href="../../udhezues/si-te-kerkosh-pamjet-e-kameres/">Lexo si t'i kërkosh</a>.</p>
<a class="btn btn-primary cta" href="../../#14/${city.lat}/${city.lon}">Hap hartën e ${esc(city.name)} →</a>
${q.html}
<h2>Qytete afër</h2>
<ul>${nearby.map((c) => `<li><a href="../${c.slug}/">Kamerat në ${esc(c.name)}</a></li>`).join("")}</ul>`;
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "WebPage", name: title, description, dateModified: today, about: { "@type": "City", name: city.name, geo: { "@type": "GeoCoordinates", latitude: city.lat, longitude: city.lon } } },
    q.jsonLd,
  ];
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
  attribution: "Curated data ODbL (Smart City Albania contributors); official data from public bodies as cited; OSM data © OpenStreetMap contributors (ODbL)",
  features: cameras.map(({ lat, lon, ...p }) => ({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: p })),
}) + "\n");
const citiesWithCameras = [...byCity.values()].filter((l) => l.length).length;
await write("data/meta.json", JSON.stringify({ updated: today, total: cameras.length, official: cameras.filter((c) => c.origin === "official").length, citiesWithCameras, smartCityCities: cities.filter((c) => c.smartCity).length, osmGenerated: osm.generated, officialGenerated: official.generated }) + "\n");

const guideItems = await loadContent("guides");
const homeLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: "Smart City Albania", alternateName: "Harta e Kamerave të Shqipërisë", inLanguage: ["sq", "en"], publisher: PUBLISHER },
    {
      "@type": "Dataset", name: "Smart City Albania — Harta e Kamerave",
      description: "Vendndodhjet publike të kamerave të mbikëqyrjes, kamerave të shpejtësisë dhe lexuesve të targave (ALPR/ANPR) në Shqipëri, nga burime zyrtare, raportime të verifikuara dhe OpenStreetMap.",
      url: `${SITE_URL}/`, keywords: ["kamera", "Smart City", "ALPR", "ANPR", "mbikëqyrje", "Shqipëri", "surveillance cameras Albania"],
      license: "https://opendatacommons.org/licenses/odbl/1-0/", isAccessibleForFree: true, dateModified: today,
      spatialCoverage: { "@type": "Place", name: "Shqipëri", geo: { "@type": "GeoShape", box: "39.6 19.2 42.7 21.1" } },
      creator: PUBLISHER,
      distribution: [{ "@type": "DataDownload", encodingFormat: "application/geo+json", contentUrl: `${SITE_URL}/data/all.geojson` }],
    },
  ],
};
const seoLinks = [
  ...cities.map((c) => `<a href="qytete/${c.slug}/">Kamerat në ${esc(c.name)}</a>`),
  ...guideItems.map((g) => `<a href="udhezues/${g.slug}/">${esc(g.title.split(":")[0])}</a>`),
  '<a href="en/" hreflang="en">English</a>',
].join("");
const indexHtml = (await readFile("src/index.html", "utf8"))
  .replace("{{JSON_LD}}", JSON.stringify(homeLd).replace(/</g, "\\u003c"))
  .replace("{{SEO_LINKS}}", seoLinks)
  .replaceAll("{{SITE_URL}}", SITE_URL);
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
  const page = renderCity(city, byCity.get(city.slug), cities);
  await write(`${page.path}index.html`, page.html);
  pages.push({ path: page.path, lastmod: today, priority: "0.7" });
}

// English landing page: captures "surveillance cameras Albania" / "Smart City Albania" searches from abroad.
const enItems = allItems.filter((i) => i.lang === "en");
const enFaq = [
  { q: "How many surveillance cameras are there in Albania?", a: `This open map currently lists ${cameras.length} cameras from official sources, verified reports and OpenStreetMap. Government statements describe about 5,000 intelligent cameras being installed in 20 cities under the Smart City programme, but their locations have not been published, so the real number is higher.` },
  { q: "What is Smart City Albania?", a: "Smart City is the Albanian government's programme for intelligent traffic and public-safety cameras, run by the State Police. Reported components include automatic number plate recognition (ANPR/ALPR) cameras, PTZ traffic cameras, body cameras for police officers and smart radars." },
  { q: "Which cities are covered by the Smart City programme?", a: `Reports list 20 cities, including ${cities.filter((c) => c.smartCity).slice(0, 8).map((c) => c.name).join(", ")} and others.` },
  { q: "Can I request CCTV footage of myself in Albania?", a: "Yes. Albania's Law No. 124/2024 on personal data protection, aligned with the EU GDPR, gives you a right of access. Send a written request to the camera operator with the date, time and place; they should reply within 30 days. If they don't, you can complain to the Information and Data Protection Commissioner (IDP)." },
  { q: "Is this project affiliated with the government?", a: "No. It is an independent, open-source transparency project started by Modex Apps and built by contributors. It maps cameras visible from public space only and never publishes footage, faces or plates." },
];
const enQ = { html: `<h2>Frequently asked questions</h2>${enFaq.map((q) => `<h3>${esc(q.q)}</h3><p>${esc(q.a)}</p>`).join("")}`, jsonLd: { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: enFaq.map((q) => ({ "@type": "Question", name: q.q, acceptedAnswer: { "@type": "Answer", text: q.a } })) } };
await write("en/index.html", layout({
  title: "Surveillance Camera Map of Albania (Smart City, ALPR, CCTV)",
  description: `Open map of ${cameras.length} surveillance, speed and licence-plate (ALPR) cameras in Albania, updated daily. Smart City facts, sources and your privacy rights.`,
  path: "en/", depth: 1, lang: "en",
  alternates: [{ lang: "sq", href: `${SITE_URL}/` }, { lang: "x-default", href: `${SITE_URL}/` }],
  jsonLd: enQ.jsonLd,
  body: `<h1>Surveillance camera map of Albania</h1>
<p class="meta">Updated ${today}</p>
<p><strong>Smart City Albania</strong> is the first public, open-data map of surveillance cameras in Albania. It currently lists <strong>${cameras.length}</strong> cameras, including traffic cameras, speed cameras and licence-plate readers (ALPR/ANPR), drawn from official public sources, verified community reports and OpenStreetMap.</p>
<p>The Albanian government is rolling out about 5,000 intelligent cameras in 20 cities under its Smart City programme. Their locations have not been published. This project helps close that gap, the way many EU cities already publish their public camera locations.</p>
<a class="btn btn-primary cta" href="../">Open the camera map →</a>
${enItems.length ? `<h2>Read in English</h2><ul class="cards">${enItems.map((i) => `<li><a href="../${i.route}/${i.slug}/"><strong>${esc(i.title)}</strong><small>${esc(i.date)} · ${esc(i.description)}</small></a></li>`).join("")}</ul>` : ""}
<h2>Cameras by city</h2>
<ul class="cards">${cityCards.map(({ c, n }) => `<li><a href="../qytete/${c.slug}/" hreflang="sq"><strong>${esc(c.name)}</strong><small>${n} cameras mapped${c.smartCity ? " · Smart City city" : ""}</small></a></li>`).join("")}</ul>
${enQ.html}
<h2>Open data</h2>
<p>All data is free to reuse under the ODbL: <a href="../data/all.geojson">download GeoJSON</a>. Code is AGPL-3.0 and content CC BY-SA 4.0. <a href="https://github.com/rexhinokovaci/smart-city-albania">Contribute on GitHub</a> or report a camera that is missing from the map.</p>`,
}));
pages.push({ path: "en/", priority: "0.9" });

await write("404.html", layout({ title: "Faqja nuk u gjet", description: "Faqja nuk ekziston.", path: "404.html", depth: 0, body: `<h1>404 — Faqja nuk u gjet</h1><p><a href="${SITE_URL}/">Kthehu te harta</a></p>` }).replaceAll('href="assets/', `href="${SITE_URL}/assets/`).replaceAll('src="assets/', `src="${SITE_URL}/assets/`));
await write("feed.xml", rss(allItems.filter((i) => i.kind === "news")));
await write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `<url><loc>${SITE_URL}/${p.path}</loc><lastmod>${p.lastmod ?? today}</lastmod><priority>${p.priority}</priority></url>`).join("\n")}
</urlset>
`);
await write("robots.txt", `User-agent: *\nAllow: /\n\n# AI search and answer engines are welcome: citations send readers to the sources.\n${["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"].map((b) => `User-agent: ${b}\nAllow: /\n`).join("\n")}\nSitemap: ${SITE_URL}/sitemap.xml\n`);
await write("llms.txt", `# Smart City Albania

> Public transparency map of surveillance cameras and licence-plate readers (ALPR) in Albania, with guides on residents' privacy rights. Maintained by Modex Apps.

- Cameras mapped: ${cameras.length} (updated ${today})
- English overview: ${SITE_URL}/en/
- Data: ${SITE_URL}/data/all.geojson (merged), ${SITE_URL}/data/cameras.geojson (curated), ${SITE_URL}/data/osm.geojson (© OpenStreetMap contributors, ODbL)

## Guides
${allItems.filter((i) => i.kind === "guides").map((i) => `- [${i.title}](${SITE_URL}/${i.route}/${i.slug}/): ${i.description}`).join("\n")}

## News
${allItems.filter((i) => i.kind === "news").slice(0, 30).map((i) => `- [${i.title}](${SITE_URL}/${i.route}/${i.slug}/): ${i.description}`).join("\n")}

## Cities
${cities.map((c) => `- [${c.name}](${SITE_URL}/qytete/${c.slug}/)`).join("\n")}
`);
await write(".nojekyll", "");
console.log(`Built ${pages.length} pages, ${cameras.length} cameras, ${citiesWithCameras} cities with cameras → ${OUT}/`);
