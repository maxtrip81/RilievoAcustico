# Rilievo Acustico

Misura, analisi e progetto del trattamento fonoassorbente di un ambiente: geometria da scansione LiDAR (OBJ), misura con sweep o impulso, riverbero, riflessioni, risposta in frequenza, fonometro, disposizione dei pannelli e relazione PDF.

## Versioni

| Versione | Dove | Note |
|---|---|---|
| App desktop (macOS, Windows, Linux) | pagina **Releases** del repository | microfono, scelta di ingresso e uscita audio, registrazioni salvate in `Documenti/Rilievo Acustico` |
| Web | `index.html`, pubblicabile con GitHub Pages | serve un indirizzo https per usare il microfono |

## App desktop

Gli installer vengono costruiti da GitHub Actions (workflow **App desktop**): a mano dalla scheda Actions, oppure pubblicando un tag `v*`, che crea anche la release con i file.

In locale:

```bash
npm install
```

```bash
npm start
```

```bash
npm run dist
```

`npm run dist` crea l'installer per il sistema su cui gira, nella cartella `release/`.

L'app non è firmata con un certificato Apple o Microsoft. Al primo avvio:

- **macOS**: clic destro sull'app → Apri, oppure Impostazioni di Sistema → Privacy e sicurezza → Apri comunque. Poi consenti l'uso del microfono.
- **Windows**: nella finestra di SmartScreen scegli «Ulteriori informazioni» → «Esegui comunque».
- **Linux**: rendi eseguibile l'AppImage (`chmod +x`) e avvialo.

## Sviluppo

- `src/` sorgenti; `node build.js` rigenera `index.html` e la pagina dell'app desktop.
- `npm test` esegue i test del motore di calcolo.
- `desktop/main.js` è il processo principale dell'app desktop.
