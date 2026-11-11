const AC = require('../src/engine.js');
const room = {
  L: 6, W: 4.5, H: 2.8, windows: 6, doors: 2, people: 0, chairs: 10,
  mats: { floor: 'parquet', ceiling: 'intonaco', front: 'intonaco', back: 'intonaco', left: 'intonaco', right: 'intonaco' },
  src: [1.2, 2.0, 1.4], mic: [4.2, 2.7, 1.2],
};
const fs = 48000;
const model = AC.rtModel(room);
console.log('RT modello  ', model.map((v) => v.toFixed(2)).join(' '));

let t = Date.now();
const ir = AC.synthIR(room, fs, 3);
const res = AC.analyze(ir, fs);
console.log('RT da IR    ', res.bands.map((b) => (b.rt ? b.rt.toFixed(2) : 'n.d.') + b.method).join(' '), `(${Date.now() - t} ms)`);
console.log('INR', res.bands.map((b) => b.inr.toFixed(0)).join(' '), 'C50', res.c50.toFixed(1), 'D50', res.d50.toFixed(2), 'flutter', res.flutter);
const m = AC.matchReflections(res.reflections, room);
console.log(m.map((r) => `${r.ms.toFixed(1)}ms ${r.dB.toFixed(0)}dB ${r.surface || '-'}`).join(' | '));
console.log('1° ordine previsto', AC.imageSources(room, 1).paths.map((p) => `${p.delay.toFixed(1)}ms ${p.surface}`).join(' | '));

// catena sweep: registrazione simulata = sweep * IR, con ritardo e rumore
const sw = AC.genSweep(fs, 4, 60, 16000);
const rec = new Float32Array(sw.length + ir.length + 12000);
const conv = AC.convolve(Float64Array.from(sw), Float64Array.from(ir));
for (let i = 0; i < conv.length; i++) rec[i + 9000] = conv[i] + (Math.random() - 0.5) * 2e-3;
const res2 = AC.analyze(Float32Array.from(AC.deconvolve(rec, sw).subarray(0, 9000 + ir.length)), fs);
console.log('INR sweep', res2.bands.map((b) => b.inr.toFixed(0)+'/'+b.tc.toFixed(2)).join(' '));
console.log('RT da sweep ', res2.bands.map((b) => (b.rt ? b.rt.toFixed(2) : 'n.d.') + b.method).join(' '));

let fail = 0;
res.bands.forEach((b, i) => { if (!b.rt || Math.abs(b.rt / model[i] - 1) > 0.15) { fail++; console.log('FAIL banda', b.fc); } });
res2.bands.forEach((b, i) => { if (!b.rt || Math.abs(b.rt / model[i] - 1) > 0.15) { fail++; console.log('FAIL sweep banda', b.fc); } });
if (m.filter((r) => r.surface).length < 3) { fail++; console.log('FAIL riflessioni associate'); }

// trattamento
const tTar = AC.targetCurve(AC.USES[0].t(AC.geometry(room).V));
const enabled = Object.fromEntries(AC.PRODUCTS.map((p) => [p.id, true]));
const areas = AC.propose(room, model, tTar, enabled, {});
const after = AC.rtAfter(room, model, areas);
console.log('target      ', tTar.map((v) => v.toFixed(2)).join(' '));
console.log('proposta    ', areas);
console.log('RT dopo     ', after.map((v) => v.toFixed(2)).join(' '));
after.forEach((T, b) => { if (T > tTar[b] * (b ? 1.2 : 1.45) || T < tTar[b] * 0.7) { fail++; console.log('FAIL trattamento banda', AC.BANDS[b]); } });

// OBJ: scatola 5 x 3 x 2.5 ruotata di 30 gradi, Y in alto
const c = Math.cos(0.52), s = Math.sin(0.52), vsx = [];
for (const x of [0, 5]) for (const y of [0, 2.5]) for (const z of [0, 3]) vsx.push(`v ${x * c - z * s} ${y} ${x * s + z * c}`);
const obj = vsx.join('\n') + '\nf 1 2 4 3\n';
const scan = AC.parseOBJ(obj, 'y');
console.log('OBJ', scan.L, scan.W, scan.H);
if (Math.abs(scan.L - 5) > 0.1 || Math.abs(scan.W - 3) > 0.1 || Math.abs(scan.H - 2.5) > 0.05) { fail++; console.log('FAIL obj'); }
console.log(fail ? `${fail} FALLITI` : 'TUTTO OK');
process.exit(fail ? 1 : 0);
