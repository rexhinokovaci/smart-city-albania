# Contributing / Si të kontribuosh

Ky projekt ndërtohet nga qytetarët. **Çdokush mund të ndihmojë**, edhe pa ditur të programojë.

## 1. Raporto një kamerë (5 minuta, pa kod)
Plotëso [formularin e kamerës së re](https://github.com/rexhinokovaci/smart-city-albania/issues/new?template=new-camera.yml). Brenda 24 orësh kamera shfaqet në hartë si **e paverifikuar**. Kur një mirëmbajtës e konfirmon, bëhet **e verifikuar**. Raportimet nga llogari GitHub më të reja se 7 ditë shqyrtohen me dorë.

Ose shtoje direkt në **OpenStreetMap** (`man_made=surveillance`, `surveillance:type=camera|ALPR`, `camera:direction=<gradë>`). Harta jonë i tërheq të dhënat e OSM çdo ditë.

**Rregullat**
- Raporto vetëm kamera të dukshme nga **hapësira publike**: rrugë, lagje, sheshe, si dhe hyrjet dhe perimetri i shkollave.
- **Asnjëherë** kamerat brenda shkollave, shtëpive apo ndërtesave private.
- Asnjë fytyrë, targë e lexueshme, emër apo e dhënë personale.
- Emri yt i përdoruesit në GitHub është publik.

## 2. Korrigjo të dhënat
Ndonjë kamerë mungon, është zhvendosur ose është gabim? Përdor [formularin e korrigjimit](https://github.com/rexhinokovaci/smart-city-albania/issues/new?template=correction.yml).

## 3. Shkruaj ose përkthe
Udhëzuesit dhe lajmet ndodhen në `content/` dhe shkruhen në Markdown. Lajmet duhet të kenë të paktën një burim `https` te `sources:`. Raporto faktet, atribuo pretendimet ("sipas…") dhe mos akuzo askënd.

## 4. Kodi
```bash
npm ci
npm run serve      # validon + ndërton + shërben dist/
npm run sync:osm   # rifreskon OpenStreetMap
npm run sync:official
```
- Shiko issues me etiketën [`good first issue`](https://github.com/rexhinokovaci/smart-city-albania/labels/good%20first%20issue).
- **Burime të reja zyrtare**: shto një adapter te `scripts/sync-official.mjs`. Lexo vetëm faqe publike dhe cito URL-në.
- Çdo PR duhet të kalojë `npm run build`. Mbaje kodin të thjeshtë: pa framework dhe pa backend.

## License
Contributions are accepted under the project's licenses: AGPL-3.0 for code, CC BY-SA 4.0 for content and ODbL for data. See [LICENSES.md](LICENSES.md).
