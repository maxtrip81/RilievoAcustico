# Rilievo Acustico

Web app per il rilievo acustico di un ambiente: geometria da scansione LiDAR (OBJ), misura di riflessioni, echi e riverbero con il microfono del dispositivo, dimensionamento dei pannelli fonoassorbenti e relazione PDF.

- `index.html` è l'app completa, in un unico file: basta servirla da un indirizzo https.
- `src/` contiene i sorgenti; `node build.js` rigenera `index.html`.
- `node test/engine.test.js` esegue i test del motore di calcolo.

## Pubblicazione con GitHub Pages

Settings → Pages → Source: «Deploy from a branch» → Branch `main`, cartella `/ (root)` → Save.
