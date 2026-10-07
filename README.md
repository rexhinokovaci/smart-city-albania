<div align="center">

# 📷 Smart City Albania

**Harta publike e kamerave të mbikëqyrjes dhe lexuesve të targave në Shqipëri.**
*Public transparency map of surveillance cameras and licence-plate readers in Albania.*

[**🗺️ Hap hartën**](https://rexhinokovaci.github.io/smart-city-albania/) · [Lajme](https://rexhinokovaci.github.io/smart-city-albania/lajme/) · [Të drejtat e tua](https://rexhinokovaci.github.io/smart-city-albania/udhezues/) · [Raporto një kamerë](https://github.com/rexhinokovaci/smart-city-albania/issues/new?template=new-camera.yml)

</div>

---

## 🇦🇱 Shqip

Projekti qeveritar **Smart City** po instalon mijëra kamera inteligjente në qytetet e Shqipërisë. Sipas raportimeve, ato përfshijnë mbi 2,000 lexues automatikë targash (ANPR) dhe mbi 2,500 kamera PTZ. Nuk ekziston ende asnjë regjistër publik i vendndodhjeve të tyre. Ky projekt e plotëson këtë boshllëk në mënyrë të hapur, të verifikueshme dhe në përputhje me standardet europiane të transparencës.

**Çfarë ofron:**
- 🗺️ **Hartë interaktive** në stilin e DeFlock: konet e fushës së shikimit, rrezja e mbulimit dhe filtra sipas llojit dhe burimit.
- 🏛️ **Të dhëna zyrtare**: kamerat e trafikut të Bashkisë Tiranë, të importuara çdo ditë nga tirana.al.
- 📍 **"Kamerat pranë meje"**: vendndodhja jote llogaritet vetëm në pajisjen tënde.
- 🏙️ **Faqe për çdo qytet**: Tiranë, Durrës, Vlorë, Shkodër dhe të tjera.
- 📰 **Lajme me burime**: çdo artikull ka referenca të verifikueshme.
- ⚖️ **Udhëzues për të drejtat**: si t'i kërkosh pamjet ku shfaqesh, si dhe standardet e BE-së (Ligji 124/2024, Direktiva 2016/680, KEDNJ neni 8).
- 🔒 **Zero gjurmim**: pa cookies dhe pa analitikë.

**Raporto një kamerë:** [plotëso formularin](https://github.com/rexhinokovaci/smart-city-albania/issues/new?template=new-camera.yml). Pasi shqyrtohet, kamera shfaqet automatikisht në hartë.

## 🇬🇧 English

A DeFlock-style public map of surveillance cameras in Albania, focused on the national *Smart City* programme (ANPR, PTZ and body cameras run by the State Police). It is neutral and source-backed, and it is built to the EU's transparency and privacy standards.

## How it works

```
OpenStreetMap ──(daily GitHub Action)──▶ data/osm.geojson ──────┐
Official pages (tirana.al …) ──(daily)──▶ data/official.geojson ─┤
GitHub issue form ──(maintainer "approved" label)──▶ data/cameras.geojson ─┼─▶ scripts/build.mjs ─▶ GitHub Pages
content/{news,guides}/*.md ────────────────────────────────┘     (map, city pages, sitemap, RSS, llms.txt)
```

- **No backend, no database, no secrets.** It is a static site, so it costs nothing and gives attackers very little to hit.
- **Validation in CI** (`scripts/validate.mjs`): coordinates must fall inside Albania, ids must be unique, types must be valid, and every news post must cite at least one https source.
- **Daily automation:** the OSM sync and redeploy run as a GitHub Action. New articles arrive as PRs from a scheduled Claude routine and merge themselves once CI passes. Only `content/` and `data/cameras.geojson` may change in those PRs.

```bash
npm ci
npm run sync:osm   # refresh OpenStreetMap data
npm run serve      # validate + build + serve dist/ locally
```

| Path | Purpose |
|---|---|
| `src/` | Map app (Leaflet, vanilla JS, no framework) |
| `data/cameras.geojson` | Curated, verified cameras (ODbL) |
| `data/osm.geojson` | OpenStreetMap snapshot (ODbL) |
| `data/official.geojson` | Cameras published by public bodies (adapters in `scripts/sync-official.mjs`) |
| `content/news/` | News posts, `sources:` required |
| `content/guides/` | Evergreen rights and how-to guides |
| `scripts/` | Build, validation, OSM sync, issue→camera |

## Data principles

1. **Public spaces only.** No footage, faces or licence plates are ever published.
2. **Every camera has a source** (an issue, an OSM node or a public document).
3. **Facts, not accusations.** Claims link to sources. Legal conclusions are left to the Commissioner (IDP) and the courts.
4. **Fast corrections.** [Report an error](https://github.com/rexhinokovaci/smart-city-albania/issues/new?template=correction.yml).

## Contribute

Ky është një projekt **open source** dhe ka nevojë për ty:
- 📷 [Raporto një kamerë](https://github.com/rexhinokovaci/smart-city-albania/issues/new?template=new-camera.yml) në lagjen tënde, në rrugë ose pranë shkollave (vetëm nga hapësira publike).
- 🧑‍💻 Merr një [`good first issue`](https://github.com/rexhinokovaci/smart-city-albania/labels/good%20first%20issue).
- 💬 Bashkohu te [Discussions](https://github.com/rexhinokovaci/smart-city-albania/discussions).

Lexo [CONTRIBUTING.md](CONTRIBUTING.md) dhe [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Open source. Code: **AGPL-3.0**. Content: **CC BY-SA 4.0**. Data: **ODbL**. Improvements must stay open. See [LICENSES.md](LICENSES.md).

Built by **[Modex Apps](https://modex.al)**. Institutions interested in collaboration: [open an issue](https://github.com/rexhinokovaci/smart-city-albania/issues).
