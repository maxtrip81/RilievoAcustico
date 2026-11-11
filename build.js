// Assembla i sorgenti in un'unica pagina: `node build.js`
const fs = require('fs'), path = require('path');
const r = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const head = '<title>Rilievo Acustico</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Space+Grotesk:wght@500;600&display=swap">\n';
const page = `${head}<style>\n${r('style.css')}</style>\n${r('body.html')}<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
<script>\n${r('engine.js')}\n${r('ui.js')}</script>\n`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
// versione per la pubblicazione come Artifact (senza scheletro html)
fs.writeFileSync(path.join(__dirname, 'dist', 'rilievo-acustico.html'), page);
// versione autonoma, da aprire in locale o caricare su un hosting HTTPS
fs.writeFileSync(path.join(__dirname, 'index.html'),
  `<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n${page}</body>\n</html>\n`);
console.log('ok', page.length, 'byte');
