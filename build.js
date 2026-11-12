// Assembla i sorgenti in un'unica pagina: `node build.js`
//  - index.html                 versione web (GitHub Pages), librerie da CDN
//  - dist/rilievo-acustico.html  versione per la pubblicazione come Artifact
//  - desktop/app/index.html      versione per l'app desktop, senza rete (richiede `npm install`)
const fs = require('fs'), path = require('path');
const r = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const title = '<title>Rilievo Acustico</title>\n';
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Space+Grotesk:wght@500;600&display=swap">\n';
const logo = (n) => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'assets', `logo-${n}.png`)).toString('base64');
const brand = (t) => t.split('__LOGO_WHITE__').join(logo('white')).split('__LOGO_BLACK__').join(logo('black'));
const body = brand(`<style>\n${r('style.css')}</style>\n${r('body.html')}`);
const app = brand(`<script>\n${r('engine.js')}\n${r('ui.js')}</script>\n`);
const cdn = '<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>\n';
const shell = (inner) => `<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n${inner}</body>\n</html>\n`;

const web = `${title}<meta name="claude:viewport-fit-sides" content="cover">\n${fonts}${body}${cdn}${app}`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'rilievo-acustico.html'), web);
fs.writeFileSync(path.join(__dirname, 'index.html'), shell(web));
console.log('web ok', web.length, 'byte');

const libs = ['jspdf/dist/jspdf.umd.min.js', 'jszip/dist/jszip.min.js'].map((f) => path.join(__dirname, 'node_modules', f));
if (libs.every((f) => fs.existsSync(f))) {
  const inline = libs.map((f) => `<script>\n${fs.readFileSync(f, 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>\n`).join('');
  fs.mkdirSync(path.join(__dirname, 'desktop', 'app'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'desktop', 'app', 'index.html'), shell(`${title}${body}${inline}${app}`));
  console.log('desktop ok');
} else console.log('desktop saltato: esegui prima `npm install`');
