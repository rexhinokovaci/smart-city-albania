/* global L */
const I18N = {
  sq: {
    "nav.news": "Lajme", "nav.guides": "Të drejtat", "nav.cities": "Qytetet",
    "stats.total": "kamera në hartë", "stats.alpr": "lexues targash", "stats.cities": "qytete",
    "search.label": "Kërko qytetin", "search.placeholder": "Kërko qytetin…",
    "locate": "📍 Kamerat pranë meje", "filters.title": "Lloji",
    "type.alpr": "Lexues targash (ALPR)", "type.cctv": "Kamera CCTV", "type.dome": "Kamera kupolë (PTZ)",
    "type.speed": "Kamera shpejtësie", "type.other": "Tjetër",
    "report": "＋ Raporto një kamerë",
    "privacy": "Kjo faqe nuk përdor cookies dhe nuk gjurmon vizitorët. Vendndodhja jote përpunohet vetëm në pajisjen tënde.",
    "updated": "Përditësuar:",
    "popup.operator": "Operatori", "popup.direction": "Drejtimi", "popup.source": "Burimi",
    "popup.unverified": "E paverifikuar", "popup.fix": "Raporto gabim",
    "nearby.result": (n, km) => `${n} kamera brenda ${km} km nga ti.`,
    "nearby.none": (km) => `Asnjë kamerë e regjistruar brenda ${km} km. Shihe një? Raportoje.`,
    "nearby.error": "Nuk mund të marrim vendndodhjen. Kontrollo lejet e shfletuesit.",
    "load.error": "Të dhënat nuk u ngarkuan. Provo përsëri më vonë.",
  },
  en: {
    "nav.news": "News", "nav.guides": "Your rights", "nav.cities": "Cities",
    "stats.total": "cameras mapped", "stats.alpr": "plate readers", "stats.cities": "cities",
    "search.label": "Search city", "search.placeholder": "Search a city…",
    "locate": "📍 Cameras near me", "filters.title": "Type",
    "type.alpr": "Plate reader (ALPR)", "type.cctv": "CCTV camera", "type.dome": "Dome camera (PTZ)",
    "type.speed": "Speed camera", "type.other": "Other",
    "report": "＋ Report a camera",
    "privacy": "No cookies, no tracking. Your location is processed only on your device.",
    "updated": "Updated:",
    "popup.operator": "Operator", "popup.direction": "Facing", "popup.source": "Source",
    "popup.unverified": "Unverified", "popup.fix": "Report an error",
    "nearby.result": (n, km) => `${n} cameras within ${km} km of you.`,
    "nearby.none": (km) => `No cameras recorded within ${km} km. Spot one? Report it.`,
    "nearby.error": "Could not get your location. Check browser permissions.",
    "load.error": "Data failed to load. Please try again later.",
  },
};
const COLORS = { alpr: "#e41e20", cctv: "#3b82f6", dome: "#a855f7", speed: "#f59e0b", other: "#94a3b8" };
const REPO = "https://github.com/rexhinokovaci/smart-city-albania";
const NEARBY_KM = 2;

let lang = readPref("lang") === "en" ? "en" : "sq";
const t = (key) => I18N[lang][key] ?? I18N.sq[key] ?? key;

function readPref(k) { try { return localStorage.getItem(k); } catch { return null; } }
function writePref(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.getElementById("lang").textContent = lang === "sq" ? "EN" : "SQ";
}

function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function cameraIcon(p) {
  const color = COLORS[p.type] ?? COLORS.other;
  const cone = Number.isInteger(p.direction)
    ? `<path d="M20 20 L8 0 A22 22 0 0 1 32 0 Z" fill="${color}" opacity=".28" transform="rotate(${p.direction} 20 20)"/>`
    : "";
  const ring = p.verified ? "#fff" : "#fbbf24";
  return L.divIcon({
    className: "cam-icon",
    html: `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">${cone}<circle cx="20" cy="20" r="7" fill="${color}" stroke="${ring}" stroke-width="2.5"/></svg>`,
    iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -8],
  });
}

function popupHtml(p, latlng) {
  const rows = [
    `<strong>${esc(t(`type.${p.type}`))}</strong>${p.verified ? "" : ` <span class="badge">${esc(t("popup.unverified"))}</span>`}`,
    p.operator && `${esc(t("popup.operator"))}: ${esc(p.operator)}`,
    Number.isInteger(p.direction) && `${esc(t("popup.direction"))}: ${p.direction}°`,
    /^https:\/\//.test(p.source ?? "") && `<a href="${esc(p.source)}" target="_blank" rel="noopener">${esc(t("popup.source"))}</a>`,
    `<a href="${REPO}/issues/new?template=correction.yml&title=${encodeURIComponent(`Korrigjim: ${p.id}`)}&camera_id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">${esc(t("popup.fix"))}</a>`,
    `<small>${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</small>`,
  ];
  return rows.filter(Boolean).join("<br>");
}

async function loadJson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function main() {
  applyI18n();
  const map = L.map("map", { zoomControl: true, preferCanvas: true }).setView([41.15, 20.0], 8);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, className: "basemap",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45, chunkedLoading: true });
  map.addLayer(cluster);

  let cameras = [];
  let cities = [];
  try {
    const [curated, osm, cityList, meta] = await Promise.all([
      loadJson("data/cameras.geojson"), loadJson("data/osm.geojson"), loadJson("data/cities.json"), loadJson("data/meta.json"),
    ]);
    // Curated entries win over OSM duplicates sharing the same id.
    const seen = new Set();
    for (const f of [...curated.features, ...osm.features]) {
      if (seen.has(f.properties.id)) continue;
      seen.add(f.properties.id);
      const [lng, lat] = f.geometry.coordinates;
      cameras.push({ ...f.properties, latlng: L.latLng(lat, lng) });
    }
    cities = cityList;
    document.getElementById("updated").textContent = meta.updated ?? "–";
    document.getElementById("statCities").textContent = meta.citiesWithCameras ?? "–";
  } catch (e) {
    console.error(e);
    document.getElementById("nearby").hidden = false;
    document.getElementById("nearby").textContent = t("load.error");
  }

  const markers = cameras.map((p) => {
    const m = L.marker(p.latlng, { icon: cameraIcon(p), keyboard: true, title: t(`type.${p.type}`) });
    m.bindPopup(() => popupHtml(p, p.latlng));
    m.cam = p;
    return m;
  });

  const filterBoxes = [...document.querySelectorAll(".filters input")];
  function render() {
    const active = new Set(filterBoxes.filter((b) => b.checked).map((b) => b.value));
    const visible = markers.filter((m) => active.has(m.cam.type));
    cluster.clearLayers();
    cluster.addLayers(visible);
    document.getElementById("statTotal").textContent = visible.length.toLocaleString(lang);
    document.getElementById("statAlpr").textContent = visible.filter((m) => m.cam.type === "alpr").length.toLocaleString(lang);
  }
  filterBoxes.forEach((b) => b.addEventListener("change", render));
  render();

  // City search
  const list = document.getElementById("cityList");
  list.innerHTML = cities.map((c) => `<option value="${esc(c.name)}">`).join("");
  const search = document.getElementById("search");
  search.addEventListener("change", () => {
    const q = search.value.trim().toLowerCase();
    const norm = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const city = cities.find((c) => norm(c.name).startsWith(norm(q)));
    if (city) map.flyTo([city.lat, city.lon], 13);
  });

  // Near me — geolocation never leaves the device.
  const nearby = document.getElementById("nearby");
  let youMarker;
  document.getElementById("locate").addEventListener("click", () => {
    if (!navigator.geolocation) { nearby.hidden = false; nearby.textContent = t("nearby.error"); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const me = L.latLng(pos.coords.latitude, pos.coords.longitude);
      youMarker?.remove();
      youMarker = L.circle(me, { radius: NEARBY_KM * 1000, color: "#e41e20", weight: 1, fillOpacity: 0.06 }).addTo(map);
      map.flyTo(me, 15);
      const n = cameras.filter((c) => distanceKm(me, c.latlng) <= NEARBY_KM).length;
      nearby.hidden = false;
      nearby.textContent = n ? I18N[lang]["nearby.result"](n, NEARBY_KM) : I18N[lang]["nearby.none"](NEARBY_KM);
    }, () => { nearby.hidden = false; nearby.textContent = t("nearby.error"); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  });

  // Shareable view: #zoom/lat/lng
  const fromHash = location.hash.match(/^#(\d{1,2})\/(-?\d+\.\d+)\/(-?\d+\.\d+)$/);
  if (fromHash) map.setView([+fromHash[2], +fromHash[3]], +fromHash[1]);
  map.on("moveend", () => {
    const c = map.getCenter();
    history.replaceState(null, "", `#${map.getZoom()}/${c.lat.toFixed(4)}/${c.lng.toFixed(4)}`);
  });

  document.getElementById("lang").addEventListener("click", () => {
    lang = lang === "sq" ? "en" : "sq";
    writePref("lang", lang);
    applyI18n();
    render();
  });
  if (matchMedia("(max-width: 760px)").matches) document.getElementById("panel").classList.add("collapsed");
  document.getElementById("sheetToggle").addEventListener("click", () => document.getElementById("panel").classList.toggle("collapsed"));
}

main();
