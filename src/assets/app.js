/* global L */
const I18N = {
  sq: {
    "nav.news": "Lajme", "nav.guides": "Të drejtat", "nav.cities": "Qytetet",
    "stats.total": "kamera në hartë", "stats.official": "nga burime zyrtare", "stats.cities": "qytete",
    "search.label": "Kërko qytetin", "search.placeholder": "Kërko qytetin…",
    "locate": "📍 Kamerat pranë meje", "filters.title": "Lloji", "sources.title": "Burimi",
    "type.alpr": "Lexues targash (ALPR)", "type.cctv": "Kamera CCTV", "type.dome": "Kamera kupolë (PTZ)",
    "type.speed": "Kamera shpejtësie", "type.other": "Tjetër",
    "origin.official": "Zyrtar (bashki, policia)", "origin.community": "Raportime të verifikuara", "origin.osm": "OpenStreetMap",
    "cones": "Shfaq fushën e shikimit",
    "report": "＋ Raporto një kamerë",
    "title": "Harta e kamerave të mbikëqyrjes në Shqipëri",
    "privacy": "Kjo faqe nuk përdor cookies dhe nuk gjurmon vizitorët. Vendndodhja jote përpunohet vetëm në pajisjen tënde.",
    "updated": "Përditësuar:",
    "popup.operator": "Operatori", "popup.direction": "Drejtimi", "popup.source": "Burimi",
    "popup.view": "Fusha e shikimit", "popup.viewEst": "e vlerësuar", "popup.mount": "Montimi",
    "popup.manufacturer": "Prodhuesi", "popup.installed": "Instaluar", "popup.zone": "Zona",
    "popup.city": "Qyteti", "popup.purpose.traffic": "Monitorim trafiku",
    "popup.unverified": "E paverifikuar", "popup.fix": "Raporto gabim", "popup.osm": "Ndrysho në OSM",
    "popup.official": "Burim zyrtar", "popup.noDirection": "drejtimi i panjohur",
    "zone.street": "Rrugë / kryqëzim", "zone.residential": "Lagje", "zone.school": "Perimetër shkolle",
    "zone.square": "Shesh / park", "zone.highway": "Autostradë", "zone.other": "Tjetër",
    "zone.town": "Zonë publike", "zone.public": "Hapësirë publike", "zone.traffic": "Trafik", "zone.area": "Zonë", "zone.parking": "Parking", "zone.shop": "Dyqan", "zone.building": "Ndërtesë",
    "legend.cone": "Koni = fusha e shikimit · rrethi me vija = drejtimi i panjohur (vlera tipike, jo të matura)",
    "map.light": "Hartë e çelët", "map.dark": "Hartë e errët",
    "nearby.result": (n, km) => `${n} kamera brenda ${km} km nga ti.`,
    "nearby.none": (km) => `Asnjë kamerë e regjistruar brenda ${km} km. Shihe një? Raportoje.`,
    "nearby.error": "Nuk mund të marrim vendndodhjen. Kontrollo lejet e shfletuesit.",
    "load.error": "Të dhënat nuk u ngarkuan. Provo përsëri më vonë.",
  },
  en: {
    "nav.news": "News", "nav.guides": "Your rights", "nav.cities": "Cities",
    "stats.total": "cameras mapped", "stats.official": "from official sources", "stats.cities": "cities",
    "search.label": "Search city", "search.placeholder": "Search a city…",
    "locate": "📍 Cameras near me", "filters.title": "Type", "sources.title": "Source",
    "type.alpr": "Plate reader (ALPR)", "type.cctv": "CCTV camera", "type.dome": "Dome camera (PTZ)",
    "type.speed": "Speed camera", "type.other": "Other",
    "origin.official": "Official (municipality, police)", "origin.community": "Verified reports", "origin.osm": "OpenStreetMap",
    "cones": "Show field of view",
    "report": "＋ Report a camera",
    "title": "Surveillance camera map of Albania",
    "privacy": "No cookies, no tracking. Your location is processed only on your device.",
    "updated": "Updated:",
    "popup.operator": "Operator", "popup.direction": "Facing", "popup.source": "Source",
    "popup.view": "Field of view", "popup.viewEst": "estimated", "popup.mount": "Mount",
    "popup.manufacturer": "Manufacturer", "popup.installed": "Installed", "popup.zone": "Zone",
    "popup.city": "City", "popup.purpose.traffic": "Traffic monitoring",
    "popup.unverified": "Unverified", "popup.fix": "Report an error", "popup.osm": "Edit on OSM",
    "popup.official": "Official source", "popup.noDirection": "direction unknown",
    "zone.street": "Street / junction", "zone.residential": "Neighbourhood", "zone.school": "School perimeter",
    "zone.square": "Square / park", "zone.highway": "Highway", "zone.other": "Other",
    "zone.town": "Public area", "zone.public": "Public space", "zone.traffic": "Traffic", "zone.area": "Area", "zone.parking": "Parking", "zone.shop": "Shop", "zone.building": "Building",
    "legend.cone": "Cone = field of view · dashed circle = direction unknown (typical values, not measured)",
    "map.light": "Light map", "map.dark": "Dark map",
    "nearby.result": (n, km) => `${n} cameras within ${km} km of you.`,
    "nearby.none": (km) => `No cameras recorded within ${km} km. Spot one? Report it.`,
    "nearby.error": "Could not get your location. Check browser permissions.",
    "load.error": "Data failed to load. Please try again later.",
  },
};
const COLORS = { alpr: "#e41e20", cctv: "#2563eb", dome: "#9333ea", speed: "#d97706", other: "#64748b" };
// Typical field of view per camera type when the source gives none: [angle in degrees, range in metres].
// These are display estimates, labelled as such in the UI; real values vary with lens and mounting.
const VIEW_DEFAULTS = { alpr: [30, 40], cctv: [60, 60], dome: [360, 80], speed: [20, 60], other: [60, 40] };
const CONE_MIN_ZOOM = 15;
const REPO = "https://github.com/rexhinokovaci/smart-city-albania";
const NEARBY_KM = 2;
const COMPASS = ["V", "VL", "L", "JL", "J", "JP", "P", "VP"];
const COMPASS_EN = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

let lang = readPref("lang") === "en" ? "en" : "sq";
const t = (key) => I18N[lang][key] ?? I18N.sq[key] ?? key;

function readPref(k) { try { return localStorage.getItem(k); } catch { return null; } }
function writePref(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const safeUrl = (u) => (/^https:\/\//.test(u ?? "") ? u : null);

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

// Point at `metres` along compass `bearing` from `origin` (equirectangular; accurate at these distances).
function offset(origin, bearing, metres) {
  const rad = (bearing * Math.PI) / 180;
  const dLat = (metres * Math.cos(rad)) / 111_320;
  const dLng = (metres * Math.sin(rad)) / (111_320 * Math.cos((origin.lat * Math.PI) / 180));
  return L.latLng(origin.lat + dLat, origin.lng + dLng);
}

function viewOf(p) {
  const [angle, range] = VIEW_DEFAULTS[p.type] ?? VIEW_DEFAULTS.other;
  return { angle: p.fov ?? angle, range: p.range ?? range, estimated: !(p.fov && p.range) };
}

function coneLayer(p) {
  const { angle, range } = viewOf(p);
  const style = { color: COLORS[p.type] ?? COLORS.other, weight: 1, opacity: 0.6, fillOpacity: 0.18, interactive: false };
  if (angle >= 360) return L.circle(p.latlng, { radius: range, ...style });
  // Direction unknown: show the reach as a dashed circle instead of guessing a heading.
  if (!Number.isInteger(p.direction)) return L.circle(p.latlng, { radius: range, ...style, dashArray: "5 4", fillOpacity: 0.1, opacity: 0.75 });
  const pts = [p.latlng];
  const steps = Math.max(6, Math.round(angle / 5));
  for (let i = 0; i <= steps; i++) pts.push(offset(p.latlng, p.direction - angle / 2 + (angle * i) / steps, range));
  return L.polygon(pts, style);
}

function cameraIcon(p) {
  const color = COLORS[p.type] ?? COLORS.other;
  const ring = p.origin === "official" ? "#111" : p.verified === false ? "#fbbf24" : "#fff";
  const arrow = Number.isInteger(p.direction)
    ? `<path d="M14 2 L18 9 L10 9 Z" fill="${color}" stroke="#fff" stroke-width="1" transform="rotate(${p.direction} 14 14)"/>`
    : "";
  return L.divIcon({
    className: "cam-icon",
    html: `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">${arrow}<circle cx="14" cy="14" r="7" fill="${color}" stroke="${ring}" stroke-width="2.5"/></svg>`,
    iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -8],
  });
}

function compass(deg) {
  const i = Math.round(deg / 45) % 8;
  return (lang === "en" ? COMPASS_EN : COMPASS)[i];
}

function popupHtml(p) {
  const v = viewOf(p);
  const row = (label, value) => (value ? `<tr><th>${esc(label)}</th><td>${value}</td></tr>` : "");
  const osmId = p.id.startsWith("osm-") ? p.id.slice(4) : null;
  const links = [
    safeUrl(p.source) && `<a href="${esc(p.source)}" target="_blank" rel="noopener">${esc(p.origin === "official" ? t("popup.official") : t("popup.source"))} ↗</a>`,
    osmId && `<a href="https://www.openstreetmap.org/edit?node=${encodeURIComponent(osmId)}" target="_blank" rel="noopener">${esc(t("popup.osm"))} ↗</a>`,
    `<a href="${REPO}/issues/new?template=correction.yml&title=${encodeURIComponent(`Korrigjim: ${p.id}`)}&camera_id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">${esc(t("popup.fix"))}</a>`,
  ].filter(Boolean).join(" · ");
  return `<div class="pop">
    <div class="pop-head"><i class="dot ${esc(p.type)}"></i><strong>${esc(t(`type.${p.type}`))}</strong>
      ${p.origin === "official" ? `<span class="badge official">${esc(t("popup.official"))}</span>` : ""}
      ${p.verified === false ? `<span class="badge">${esc(t("popup.unverified"))}</span>` : ""}</div>
    ${p.name ? `<div class="pop-name">${esc(p.name)}</div>` : ""}
    <table>
      ${row(t("popup.operator"), esc(p.operator))}
      ${row(t("popup.direction"), Number.isInteger(p.direction) ? `${p.direction}° ${compass(p.direction)}` : esc(t("popup.noDirection")))}
      ${row(t("popup.view"), `${v.angle >= 360 ? "360°" : `${v.angle}°`} · ~${v.range} m${v.estimated ? ` <small>(${esc(t("popup.viewEst"))})</small>` : ""}`)}
      ${row(t("popup.zone"), p.purpose === "traffic" ? esc(t("popup.purpose.traffic")) : p.zone ? esc(I18N[lang][`zone.${p.zone}`] ?? p.zone) : "")}
      ${row(t("popup.mount"), esc(p.mount))}
      ${row(t("popup.manufacturer"), esc(p.manufacturer))}
      ${row(t("popup.installed"), esc(p.installed))}
      ${row(t("popup.city"), esc(p.city))}
    </table>
    <div class="pop-links">${links}</div>
    <small class="pop-coords">${p.latlng.lat.toFixed(5)}, ${p.latlng.lng.toFixed(5)}</small>
  </div>`;
}

async function loadJson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

function legendControl() {
  const c = L.control({ position: "bottomright" });
  c.onAdd = () => {
    const div = L.DomUtil.create("div", "legend");
    div.innerHTML = Object.keys(COLORS).map((k) => `<div><i class="dot ${k}"></i>${esc(t(`type.${k}`))}</div>`).join("")
      + `<div class="legend-cone"><svg width="22" height="14" aria-hidden="true"><path d="M2 12 L20 2 L20 12 Z" fill="#e41e20" fill-opacity=".25" stroke="#e41e20"/></svg>${esc(t("legend.cone"))}</div>`;
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  return c;
}

async function main() {
  applyI18n();
  const map = L.map("map", { zoomControl: true, preferCanvas: false }).setView([41.15, 20.0], 8);
  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const light = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution });
  const dark = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution, className: "basemap-dark" });
  (readPref("basemap") === "dark" ? dark : light).addTo(map);
  const basemaps = { [t("map.light")]: light, [t("map.dark")]: dark };
  L.control.layers(basemaps, null, { position: "topright" }).addTo(map);
  map.on("baselayerchange", (e) => writePref("basemap", e.layer === dark ? "dark" : "light"));
  let legend = legendControl().addTo(map);

  const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45, disableClusteringAtZoom: CONE_MIN_ZOOM, chunkedLoading: true });
  const cones = L.layerGroup();
  map.addLayer(cluster);

  const cameras = [];
  let cities = [];
  try {
    const [all, cityList, meta] = await Promise.all([loadJson("data/all.geojson"), loadJson("data/cities.json"), loadJson("data/meta.json")]);
    for (const f of all.features) {
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

  for (const p of cameras) {
    p.marker = L.marker(p.latlng, { icon: cameraIcon(p), keyboard: true, title: p.name ?? t(`type.${p.type}`) });
    p.marker.bindPopup(() => popupHtml(p), { maxWidth: 300 });
    p.cone = coneLayer(p);
  }

  const typeBoxes = [...document.querySelectorAll('input[name="type"]')];
  const originBoxes = [...document.querySelectorAll('input[name="origin"]')];
  const showCones = document.getElementById("showCones");
  showCones.checked = readPref("cones") !== "off";

  function syncCones() {
    const on = showCones.checked && map.getZoom() >= CONE_MIN_ZOOM;
    if (on && !map.hasLayer(cones)) map.addLayer(cones);
    if (!on && map.hasLayer(cones)) map.removeLayer(cones);
  }

  function render() {
    const types = new Set(typeBoxes.filter((b) => b.checked).map((b) => b.value));
    const origins = new Set(originBoxes.filter((b) => b.checked).map((b) => b.value));
    const visible = cameras.filter((p) => types.has(p.type) && origins.has(p.origin));
    cluster.clearLayers();
    cluster.addLayers(visible.map((p) => p.marker));
    cones.clearLayers();
    visible.forEach((p) => p.cone && cones.addLayer(p.cone));
    syncCones();
    document.getElementById("statTotal").textContent = visible.length.toLocaleString(lang);
    document.getElementById("statOfficial").textContent = visible.filter((p) => p.origin === "official").length.toLocaleString(lang);
  }
  [...typeBoxes, ...originBoxes].forEach((b) => b.addEventListener("change", render));
  showCones.addEventListener("change", () => { writePref("cones", showCones.checked ? "on" : "off"); syncCones(); });
  map.on("zoomend", syncCones);
  render();

  // City search
  document.getElementById("cityList").innerHTML = cities.map((c) => `<option value="${esc(c.name)}">`).join("");
  const search = document.getElementById("search");
  const norm = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  search.addEventListener("change", () => {
    const q = norm(search.value.trim());
    const city = q && cities.find((c) => norm(c.name).startsWith(q));
    if (city) map.flyTo([city.lat, city.lon], 14);
  });

  // Near me: geolocation never leaves the device.
  const nearby = document.getElementById("nearby");
  let youMarker;
  document.getElementById("locate").addEventListener("click", () => {
    if (!navigator.geolocation) { nearby.hidden = false; nearby.textContent = t("nearby.error"); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const me = L.latLng(pos.coords.latitude, pos.coords.longitude);
      youMarker?.remove();
      youMarker = L.circle(me, { radius: NEARBY_KM * 1000, color: "#e41e20", weight: 1, fillOpacity: 0.05 }).addTo(map);
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
    legend.remove();
    legend = legendControl().addTo(map);
    render();
  });
  const panel = document.getElementById("panel");
  if (matchMedia("(max-width: 760px)").matches) panel.classList.add("collapsed");
  document.getElementById("sheetToggle").addEventListener("click", () => panel.classList.toggle("collapsed"));
}

main();
