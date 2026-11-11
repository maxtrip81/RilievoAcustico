/* Motore acustico: nessuna dipendenza dal DOM, usabile anche da Node per i test. */
const AC = {};
AC.C = 343;
AC.BANDS = [125, 250, 500, 1000, 2000, 4000];
AC.PANEL_M2 = 0.72; // pannello standard 120 x 60 cm

/* Coefficienti di assorbimento indicativi (125 Hz - 4 kHz), da tabelle di letteratura. */
AC.MATERIALS = {
  intonaco: { name: 'Intonaco / muratura verniciata', a: [0.02, 0.02, 0.03, 0.04, 0.05, 0.05] },
  cemento: { name: 'Calcestruzzo a vista', a: [0.01, 0.01, 0.02, 0.02, 0.02, 0.03] },
  cartongesso: { name: 'Cartongesso su intercapedine', a: [0.29, 0.10, 0.05, 0.04, 0.07, 0.09] },
  vetro: { name: 'Vetrata', a: [0.35, 0.25, 0.18, 0.12, 0.07, 0.04] },
  legno: { name: 'Rivestimento in legno', a: [0.28, 0.22, 0.17, 0.09, 0.10, 0.11] },
  parquet: { name: 'Parquet', a: [0.04, 0.04, 0.07, 0.06, 0.06, 0.07] },
  piastrelle: { name: 'Piastrelle / marmo / resina', a: [0.01, 0.01, 0.01, 0.02, 0.02, 0.02] },
  linoleum: { name: 'Linoleum / PVC', a: [0.02, 0.03, 0.03, 0.03, 0.03, 0.02] },
  moquette: { name: 'Moquette', a: [0.02, 0.06, 0.14, 0.37, 0.60, 0.65] },
  controsoffitto: { name: 'Controsoffitto in fibra minerale', a: [0.40, 0.55, 0.65, 0.75, 0.80, 0.75] },
  tenda: { name: 'Tendaggio pesante', a: [0.14, 0.35, 0.55, 0.72, 0.70, 0.65] },
};
AC.GLASS = [0.35, 0.25, 0.18, 0.12, 0.07, 0.04];
AC.DOOR = [0.14, 0.10, 0.06, 0.08, 0.10, 0.10];
AC.PERSON = [0.25, 0.35, 0.42, 0.46, 0.50, 0.50]; // m2 di assorbimento per persona seduta
AC.CHAIR = [0.15, 0.25, 0.30, 0.35, 0.35, 0.35]; // m2 per sedia imbottita vuota
AC.AIR_4M = [0, 0, 0, 0.004, 0.009, 0.024]; // 4m, 20 C / 50% UR

AC.SURFACES = [
  { id: 'floor', name: 'Pavimento', kind: 'floor' },
  { id: 'ceiling', name: 'Soffitto', kind: 'ceiling' },
  { id: 'front', name: 'Parete frontale', kind: 'wall' },
  { id: 'back', name: 'Parete di fondo', kind: 'wall' },
  { id: 'left', name: 'Parete sinistra', kind: 'wall' },
  { id: 'right', name: 'Parete destra', kind: 'wall' },
];

/* Prodotti per il trattamento: valori tipici di scheda tecnica, prezzi indicativi modificabili. */
AC.PRODUCTS = [
  { id: 'pet50', name: 'Pannello in fibra di poliestere 50 mm', where: 'wall', a: [0.15, 0.45, 0.85, 0.95, 0.95, 0.95], price: 60 },
  { id: 'rw50', name: 'Pannello in lana di roccia 50 mm rivestito in tessuto', where: 'wall', a: [0.20, 0.65, 0.95, 0.95, 0.95, 0.90], price: 75 },
  { id: 'rw100', name: 'Pannello in lana di roccia 100 mm rivestito in tessuto', where: 'wall', a: [0.60, 0.95, 1.0, 1.0, 1.0, 0.95], price: 110 },
  { id: 'mel50', name: 'Schiuma melamminica 50 mm', where: 'wall', a: [0.15, 0.35, 0.75, 0.95, 1.0, 1.0], price: 55 },
  { id: 'wood', name: 'Legno microforato su lana minerale 50 mm', where: 'wall', a: [0.40, 0.80, 0.85, 0.70, 0.55, 0.45], price: 160 },
  { id: 'trap', name: 'Bass trap angolare (m² di superficie frontale)', where: 'wall', a: [0.85, 0.95, 0.90, 0.85, 0.80, 0.75], price: 180 },
  { id: 'curtain', name: 'Tenda acustica pesante pieghettata', where: 'wall', a: [0.15, 0.40, 0.65, 0.75, 0.70, 0.65], price: 45 },
  { id: 'baffle', name: 'Isole / baffle sospesi 50 mm con intercapedine', where: 'ceiling', a: [0.45, 0.80, 1.0, 1.0, 1.0, 0.95], price: 120 },
  { id: 'ceil', name: 'Controsoffitto fonoassorbente in fibra minerale', where: 'ceiling', a: [0.40, 0.55, 0.65, 0.75, 0.80, 0.75], price: 50 },
  { id: 'carpet', name: 'Moquette spessa / tappeto', where: 'floor', a: [0.05, 0.10, 0.25, 0.45, 0.65, 0.70], price: 40 },
];

const lg = Math.log10;
const clampV = (V) => Math.min(5000, Math.max(30, V));
/* Tempi di riverbero di riferimento: DIN 18041 (gruppi A1-A3), EBU Tech 3276 per le regie. */
AC.USES = [
  { id: 'riunioni', name: 'Sala riunioni / aula', ref: 'DIN 18041 A3', t: (V) => 0.32 * lg(clampV(V)) - 0.17 },
  { id: 'conferenze', name: 'Sala conferenze / parlato', ref: 'DIN 18041 A2', t: (V) => 0.37 * lg(clampV(V)) - 0.14 },
  { id: 'musica', name: 'Sala musica / prove', ref: 'DIN 18041 A1', t: (V) => 0.45 * lg(clampV(V)) + 0.07 },
  { id: 'ufficio', name: 'Ufficio / open space', ref: 'valore tipico', t: () => 0.55 },
  { id: 'ristorante', name: 'Ristorante / bar', ref: 'valore tipico', t: () => 0.7 },
  { id: 'regia', name: 'Regia / studio di registrazione', ref: 'EBU Tech 3276', t: (V) => Math.min(0.4, Math.max(0.2, 0.25 * Math.cbrt(V / 100))) },
  { id: 'ascolto', name: 'Sala ascolto / home cinema', ref: 'valore tipico', t: (V) => Math.min(0.5, Math.max(0.25, 0.3 * Math.cbrt(V / 100))) },
];
AC.targetCurve = (tMid) => [1.2, 1.05, 1, 1, 1, 1].map((k) => k * tMid);

/* ---------- Geometria della stanza (parallelepipedo: x lungo L, y lungo W, z in alto) ---------- */
AC.geometry = function (room) {
  const { L, W, H } = room;
  const raw = { floor: L * W, ceiling: L * W, front: W * H, back: W * H, left: L * H, right: L * H };
  const wallTot = 2 * (L + W) * H;
  const openings = Math.min(wallTot * 0.9, (room.windows || 0) + (room.doors || 0));
  const k = wallTot > 0 ? 1 - openings / wallTot : 1;
  const area = { ...raw };
  for (const id of ['front', 'back', 'left', 'right']) area[id] = raw[id] * k;
  return { V: L * W * H, S: 2 * L * W + wallTot, area, wallNet: wallTot - openings };
};

AC.absorption = function (room) {
  const g = AC.geometry(room);
  const A = AC.BANDS.map((_, b) => {
    let a = 0;
    for (const s of AC.SURFACES) a += g.area[s.id] * AC.MATERIALS[room.mats[s.id]].a[b];
    a += Math.min(room.windows || 0, g.S) * AC.GLASS[b] + (room.doors || 0) * AC.DOOR[b];
    a += (room.people || 0) * AC.PERSON[b] + (room.chairs || 0) * AC.CHAIR[b];
    return a;
  });
  return { ...g, A };
};

/* Riverbero previsto (Eyring, con assorbimento dell'aria). */
AC.rtModel = function (room) {
  const ab = AC.absorption(room);
  return ab.A.map((A, b) => {
    const am = Math.min(0.98, A / ab.S);
    return (0.161 * ab.V) / (-ab.S * Math.log(1 - am) + AC.AIR_4M[b] * ab.V);
  });
};

/* Sorgenti immagine (Allen-Berkley). Restituisce cammini con ritardo rispetto al suono diretto. */
AC.imageSources = function (room, maxOrder, maxDelayMs) {
  const { L, W, H, src, mic } = room;
  const beta = {};
  for (const s of AC.SURFACES) {
    const a = AC.MATERIALS[room.mats[s.id]].a;
    beta[s.id] = Math.sqrt(1 - Math.min(0.95, (a[2] + a[3] + a[4]) / 3));
  }
  const d0 = Math.hypot(src[0] - mic[0], src[1] - mic[1], src[2] - mic[2]) || 0.01;
  const N = Math.ceil(maxOrder / 2) + 1;
  const out = [];
  for (let nx = -N; nx <= N; nx++) for (let px = 0; px <= 1; px++) {
    const ox0 = Math.abs(nx - px), ox1 = Math.abs(nx);
    for (let ny = -N; ny <= N; ny++) for (let py = 0; py <= 1; py++) {
      const oy0 = Math.abs(ny - py), oy1 = Math.abs(ny);
      for (let nz = -N; nz <= N; nz++) for (let pz = 0; pz <= 1; pz++) {
        const oz0 = Math.abs(nz - pz), oz1 = Math.abs(nz);
        const order = ox0 + ox1 + oy0 + oy1 + oz0 + oz1;
        if (order === 0 || order > maxOrder) continue;
        const img = [(1 - 2 * px) * src[0] + 2 * nx * L, (1 - 2 * py) * src[1] + 2 * ny * W, (1 - 2 * pz) * src[2] + 2 * nz * H];
        const d = Math.hypot(img[0] - mic[0], img[1] - mic[1], img[2] - mic[2]);
        const delay = ((d - d0) / AC.C) * 1000;
        if (maxDelayMs && delay > maxDelayMs) continue;
        const refl = beta.front ** ox0 * beta.back ** ox1 * beta.left ** oy0 * beta.right ** oy1 * beta.floor ** oz0 * beta.ceiling ** oz1;
        const p = { order, d, delay, amp: refl / d, level: 20 * lg((refl * d0) / d) };
        if (order === 1) {
          p.surface = ox0 ? 'front' : ox1 ? 'back' : oy0 ? 'left' : oy1 ? 'right' : oz0 ? 'floor' : 'ceiling';
          const axis = ox0 || ox1 ? 0 : oy0 || oy1 ? 1 : 2;
          const plane = { front: 0, back: L, left: 0, right: W, floor: 0, ceiling: H }[p.surface];
          const t = (plane - img[axis]) / (mic[axis] - img[axis]);
          p.point = img.map((v, i) => v + t * (mic[i] - v));
        }
        out.push(p);
      }
    }
  }
  out.sort((a, b) => a.delay - b.delay);
  return { d0, paths: out };
};

/* ---------- DSP ---------- */
AC.nextPow2 = (n) => { let p = 1; while (p < n) p <<= 1; return p; };
AC.fft = function (re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
};

function spectrum(x, n) {
  const re = new Float64Array(n), im = new Float64Array(n);
  re.set(x.length > n ? x.subarray(0, n) : x);
  AC.fft(re, im, false);
  return { re, im };
}

/* Filtri d'ottava a fase zero applicati nel dominio della frequenza. */
AC.octaveBands = function (x, fs) {
  const n = AC.nextPow2(x.length);
  const X = spectrum(x, n);
  return AC.BANDS.map((fc) => {
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let k = 1; k <= n / 2; k++) {
      const f = (k * fs) / n;
      const g = 1 / Math.sqrt(1 + Math.pow((f / fc - fc / f) / 0.7071, 8));
      re[k] = X.re[k] * g; im[k] = X.im[k] * g;
      if (k < n / 2) { re[n - k] = X.re[n - k] * g; im[n - k] = X.im[n - k] * g; }
    }
    AC.fft(re, im, true);
    return re.subarray(0, x.length);
  });
};

AC.highpass = function (x, fs, fc) {
  const n = AC.nextPow2(x.length), X = spectrum(x, n);
  X.re[0] = 0; X.im[0] = 0;
  for (let k = 1; k <= n / 2; k++) {
    const g = 1 / Math.sqrt(1 + Math.pow((fc * n) / (k * fs), 8));
    X.re[k] *= g; X.im[k] *= g;
    if (k < n / 2) { X.re[n - k] *= g; X.im[n - k] *= g; }
  }
  AC.fft(X.re, X.im, true);
  return X.re.subarray(0, x.length);
};

AC.genSweep = function (fs, T, f1, f2) {
  const n = Math.round(fs * T), x = new Float32Array(n), K = Math.log(f2 / f1);
  const fade = Math.round(0.02 * fs);
  for (let i = 0; i < n; i++) {
    const t = i / fs;
    let v = Math.sin(((2 * Math.PI * f1 * T) / K) * (Math.exp((t / T) * K) - 1));
    if (i < fade) v *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fade);
    if (i > n - fade) v *= 0.5 - 0.5 * Math.cos((Math.PI * (n - i)) / fade);
    x[i] = v * 0.8;
  }
  return x;
};

/* Deconvoluzione regolarizzata: risposta all'impulso = registrazione / sweep. */
AC.deconvolve = function (rec, sweep) {
  const n = AC.nextPow2(rec.length + sweep.length);
  const Y = spectrum(rec, n), X = spectrum(sweep, n);
  let mx = 0;
  for (let k = 0; k < n; k++) mx = Math.max(mx, X.re[k] * X.re[k] + X.im[k] * X.im[k]);
  const eps = mx * 1e-4;
  for (let k = 0; k < n; k++) {
    const d = X.re[k] * X.re[k] + X.im[k] * X.im[k] + eps;
    const r = (Y.re[k] * X.re[k] + Y.im[k] * X.im[k]) / d;
    const i = (Y.im[k] * X.re[k] - Y.re[k] * X.im[k]) / d;
    Y.re[k] = r; Y.im[k] = i;
  }
  AC.fft(Y.re, Y.im, true);
  return Y.re.subarray(0, rec.length);
};

AC.convolve = function (a, b) {
  const n = AC.nextPow2(a.length + b.length);
  const A = spectrum(a, n), B = spectrum(b, n);
  for (let k = 0; k < n; k++) {
    const r = A.re[k] * B.re[k] - A.im[k] * B.im[k];
    A.im[k] = A.re[k] * B.im[k] + A.im[k] * B.re[k]; A.re[k] = r;
  }
  AC.fft(A.re, A.im, true);
  return A.re.subarray(0, a.length + b.length);
};

function linfit(xs, ys) {
  const n = xs.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1e-12);
  return { slope, icpt: (sy - slope * sx) / n };
}

/* Curva di decadimento di Schroeder con troncamento al rumore di fondo, RT (T30/T20/T10) ed EDT. */
AC.decay = function (h, fs) {
  const bl = Math.max(1, Math.round(0.002 * fs)), nb = Math.floor(h.length / bl);
  const E = new Float64Array(nb);
  for (let k = 0; k < nb; k++) { let s = 0; for (let i = k * bl; i < (k + 1) * bl; i++) s += h[i] * h[i]; E[k] = s / bl; }
  const tail = Math.max(5, Math.floor(nb * 0.1));
  let noise = 0; for (let k = nb - tail; k < nb; k++) noise += E[k]; noise = noise / tail + 1e-30;
  let kmax = 0; for (let k = 1; k < nb; k++) if (E[k] > E[kmax]) kmax = k;
  const inr = 10 * lg(E[kmax] / noise);
  let tc = nb - tail;
  const thr = noise * 3.16, w = 5;
  for (let k = kmax + 1; k < nb - tail - w; k++) {
    let m = 0; for (let j = 0; j < w; j++) m += E[k + j];
    if (m / w < thr) { tc = k; break; }
  }
  const sch = new Float64Array(tc); let acc = 0;
  for (let k = tc - 1; k >= 0; k--) { acc += E[k] - noise; sch[k] = Math.max(acc, 1e-30); }
  const dB = Array.from(sch, (v) => 10 * lg(v / sch[0])), dt = bl / fs;
  const fit = (hi, lo) => {
    let a = dB.findIndex((v) => v <= hi), b = dB.findIndex((v) => v <= lo);
    if (a < 0 || b < 0 || b - a < 3) return null;
    const xs = [], ys = [];
    for (let k = a; k <= b; k++) { xs.push(k * dt); ys.push(dB[k]); }
    const s = linfit(xs, ys).slope;
    return s < 0 ? -60 / s : null;
  };
  let rt = null, method = null;
  if (inr >= 45) { rt = fit(-5, -35); method = 'T30'; }
  if (rt == null && inr >= 35) { rt = fit(-5, -25); method = 'T20'; }
  if (rt == null && inr >= 25) { rt = fit(-5, -15); method = 'T10'; }
  if (rt == null) method = null;
  const edt = inr >= 20 ? fit(0, -10) : null;
  const step = Math.max(1, Math.floor(tc / 300)), curve = [];
  for (let k = 0; k < tc; k += step) if (dB[k] > -70) curve.push([k * dt, dB[k]]);
  return { rt, method, edt, inr, tc: tc * dt, curve };
};

/* Analisi completa di una risposta all'impulso (o di una registrazione impulsiva: battito, palloncino). */
AC.analyze = function (x, fs) {
  let pm = 0; for (let i = 1; i < x.length; i++) if (Math.abs(x[i]) > Math.abs(x[pm])) pm = i;
  // suono diretto = primo arrivo entro 6 dB dal massimo (le riflessioni sovrapposte possono superarlo)
  let p = Math.max(0, pm - Math.round(0.05 * fs)); while (Math.abs(x[p]) < 0.5 * Math.abs(x[pm])) p++;
  const pre = Math.round(0.002 * fs), start = Math.max(0, p - pre);
  const h = Float64Array.from(x.subarray(start, Math.min(x.length, start + Math.round(4 * fs))));
  const i0 = p - start;
  const broad = AC.decay(h, fs);
  const filtered = AC.octaveBands(h, fs);
  const bands = AC.BANDS.map((fc, b) => ({ fc, ...AC.decay(filtered[b], fs) }));

  // Chiarezza e definizione (ISO 3382-1)
  const tcI = Math.min(h.length, Math.round(broad.tc * fs));
  const en = (a, b) => { let s = 0; for (let i = Math.max(0, a); i < Math.min(tcI, b); i++) s += h[i] * h[i]; return s; };
  const e50 = en(0, i0 + 0.05 * fs), e80 = en(0, i0 + 0.08 * fs), eTot = en(0, tcI);
  const c50 = 10 * lg(e50 / Math.max(eTot - e50, 1e-30)), c80 = 10 * lg(e80 / Math.max(eTot - e80, 1e-30)), d50 = e50 / eTot;

  // Curva energia-tempo (ETC): finestra 1 ms, passo 0,25 ms
  // Calcolata sopra 400 Hz: sotto, l'ondulazione della forma d'onda maschera le singole riflessioni.
  const hf = AC.highpass(h, fs, 400);
  const hop = Math.max(1, Math.round(0.00025 * fs)), w2 = Math.max(1, Math.round(0.00025 * fs));
  const nS = Math.min(h.length, Math.round(0.62 * fs));
  const box = (src) => {
    const cs = new Float64Array(nS + 1), out = new Float64Array(nS);
    for (let i = 0; i < nS; i++) cs[i + 1] = cs[i] + src[i];
    for (let i = 0; i < nS; i++) out[i] = cs[Math.min(nS, i + w2 + 1)] - cs[Math.max(0, i - w2)];
    return out;
  };
  const sq = new Float64Array(nS); for (let i = 0; i < nS; i++) sq[i] = hf[i] * hf[i];
  const sm = box(box(sq)); // finestra triangolare di circa 1 ms
  const nE = Math.floor((nS - 2 * w2) / hop);
  const env = new Float64Array(nE); let emax = 0, kd = 0;
  for (let k = 0; k < nE; k++) { env[k] = sm[k * hop]; if (k * hop <= i0 + 0.001 * fs && env[k] > emax) { emax = env[k]; kd = k; } }
  const eDb0 = Array.from(env, (v) => 10 * lg(v / emax + 1e-12));
  const eDb = eDb0.slice();
  // dopo 30 ms la coda fluttua: si cerca su un inviluppo piu' liscio (circa 3 ms)
  const late = kd + Math.round((0.03 * fs) / hop);
  for (let k = late; k < nE - 6; k++) { let m = 0; for (let j = k - 6; j <= k + 6; j++) m += env[j]; eDb[k] = 10 * lg(m / 13 / emax + 1e-12); }
  const ms = (k) => ((k - kd) * hop * 1000) / fs;
  const etc = []; for (let k = Math.max(0, kd - 8); k < nE; k++) etc.push([ms(k), Math.max(-80, eDb0[k])]);

  // Riflessioni: massimi locali che emergono di almeno 7 dB dal decadimento circostante
  const noiseDb = -broad.inr, refl = [];
  const r1 = Math.round(0.0006 * fs / hop), r5 = Math.round(0.005 * fs / hop);
  for (let k = kd + Math.round(0.001 * fs / hop); k < nE - r5; k++) {
    const v = eDb[k];
    if (v < -40 || v < noiseDb + 10) continue;
    let isMax = true;
    for (let j = k - r1; j <= k + r1; j++) if (eDb[j] > v) { isMax = false; break; }
    if (!isMax) continue;
    const around = [];
    for (let j = k - r5; j <= k + r5; j++) if (Math.abs(j - k) > r1 && j > kd + r1 / 2) around.push(eDb[j]);
    if (around.length < 4) continue;
    around.sort((a, b) => a - b);
    const prom = v - around[Math.floor(around.length * 0.3)];
    const t = ms(k);
    if (prom >= (t < 20 ? 5 : t < 30 ? 7 : 8)) {
      const kind = t >= 50 && v >= -20 ? 'eco' : t < 20 ? 'prima' : t < 50 ? 'precoce' : 'tardiva';
      refl.push({ ms: t, dB: v, prom, extra: (t / 1000) * AC.C, kind });
    }
  }
  refl.sort((a, b) => b.dB - a.dB);
  const reflections = refl.slice(0, 12).sort((a, b) => a.ms - b.ms);

  // Flutter echo: periodicita' nell'inviluppo, tolto l'andamento esponenziale
  let flutter = null;
  {
    const st = Math.round(0.001 * fs / hop), a = kd + 20 * st, b = Math.min(nE, kd + Math.round(Math.min(0.5, broad.tc) * 1000) * st);
    const ys = []; for (let k = a; k < b; k += st) ys.push(eDb[k]);
    if (ys.length > 120) {
      const xs = ys.map((_, i) => i), f = linfit(xs, ys);
      const r0 = ys.map((v, i) => v - f.icpt - f.slope * i);
      // toglie anche l'andamento lento (curvatura del decadimento) con una media mobile di 40 ms
      const r = r0.map((v, i) => { let m = 0, c = 0; for (let j = Math.max(0, i - 20); j <= Math.min(r0.length - 1, i + 20); j++) { m += r0[j]; c++; } return v - m / c; });
      let v0 = 0; for (const v of r) v0 += v * v;
      const ac = (lag) => { let s = 0; for (let i = 0; i + lag < r.length; i++) s += r[i] * r[i + lag]; return s / v0; };
      let best = 0, bl = 0;
      for (let lag = 5; lag <= Math.min(80, Math.floor(r.length / 3)); lag++) { const c = ac(lag); if (c > best) { best = c; bl = lag; } }
      if (best >= 0.4 && ac(2 * bl) >= 0.2 && ac(Math.round(bl / 2)) < best - 0.25) flutter = { periodMs: bl, strength: best, distance: (bl / 1000) * AC.C / 2 };
    }
  }

  const mid = [bands[2].rt, bands[3].rt].filter((v) => v != null);
  return {
    fs, bands, broad, etc, reflections, flutter, c50, c80, d50,
    rtMid: mid.length ? mid.reduce((a, b) => a + b) / mid.length : broad.rt,
    edtMid: [bands[2].edt, bands[3].edt].filter((v) => v != null).reduce((a, b, _, arr) => a + b / arr.length, 0) || broad.edt,
  };
};

/* Associa le riflessioni misurate alle superfici, confrontandole con le sorgenti immagine del primo ordine. */
AC.matchReflections = function (reflections, room) {
  const first = AC.imageSources(room, 1).paths;
  return reflections.map((r) => {
    let best = null;
    for (const p of first) {
      const err = Math.abs(p.delay - r.ms);
      if (err <= 0.6 + 0.06 * r.ms && (!best || err < best.err)) best = { err, surface: p.surface };
    }
    return { ...r, surface: best ? best.surface : null };
  });
};

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* Risposta all'impulso sintetica della stanza: sorgenti immagine + coda riverberante per bande. */
AC.synthIR = function (room, fs, seed) {
  const rt = AC.rtModel(room), rnd = rng(seed || 7);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const dur = Math.min(3.5, Math.max(1.2, 1.8 * Math.max(...rt)));
  const n = Math.round(dur * fs), lead = Math.round(0.02 * fs);
  const h = new Float64Array(n);
  const { d0, paths } = AC.imageSources(room, 4, 90);
  const put = (delayMs, amp) => { const pos = lead + (delayMs / 1000) * fs, i = Math.floor(pos), f = pos - i; if (i + 1 < n) { h[i] += amp * (1 - f); h[i + 1] += amp * f; } };
  put(0, 1 / d0);
  for (const p of paths) put(p.delay, p.amp);
  const white = new Float64Array(n); for (let i = 0; i < n; i++) white[i] = gauss();
  const nb = AC.octaveBands(white, fs), tMix = lead + 0.015 * fs, tailAmp = Math.sqrt((4 * Math.PI * AC.C) / (room.L * room.W * room.H * fs));
  for (let b = 0; b < nb.length; b++) {
    let rms = 0; for (let i = 0; i < n; i++) rms += nb[b][i] * nb[b][i]; rms = Math.sqrt(rms / n);
    const g = tailAmp / rms / Math.sqrt(nb.length), k = 6.908 / rt[b] / fs;
    for (let i = Math.floor(tMix); i < n; i++) {
      const fadeIn = Math.min(1, (i - tMix) / (0.03 * fs));
      h[i] += nb[b][i] * g * fadeIn * Math.exp(-k * (i - tMix));
    }
  }
  const floor = (1 / d0) * Math.pow(10, -68 / 20);
  for (let i = 0; i < n; i++) h[i] += gauss() * floor;
  return Float32Array.from(h);
};

/* ---------- Trattamento ---------- */
AC.hostAlpha = function (room) {
  const g = AC.geometry(room), wall = AC.BANDS.map(() => 0);
  for (const id of ['front', 'back', 'left', 'right']) AC.MATERIALS[room.mats[id]].a.forEach((a, b) => { wall[b] += (a * g.area[id]) / (g.wallNet || 1); });
  return { wall, ceiling: AC.MATERIALS[room.mats.ceiling].a, floor: AC.MATERIALS[room.mats.floor].a };
};
AC.capacity = function (room) {
  const g = AC.geometry(room);
  return { wall: 0.4 * g.wallNet, ceiling: 0.7 * g.area.ceiling, floor: 0.5 * g.area.floor };
};
AC.gainPerM2 = (prod, host) => prod.a.map((a, b) => Math.max(0, a - host[prod.where][b]));

/* Riverbero dopo il trattamento, a partire dal riverbero attuale (misurato o da modello). */
AC.rtAfter = function (room, tCur, areas) {
  const V = AC.geometry(room).V, host = AC.hostAlpha(room);
  return tCur.map((T, b) => {
    let A = (0.161 * V) / T;
    for (const p of AC.PRODUCTS) A += (areas[p.id] || 0) * AC.gainPerM2(p, host)[b];
    return (0.161 * V) / A;
  });
};

/* Proposta automatica: aggiunge un pannello alla volta scegliendo quello che riduce di piu' lo scarto per euro. */
AC.propose = function (room, tCur, tTar, enabled, prices) {
  const price = (areas) => AC.PRODUCTS.reduce((s, p) => s + (areas[p.id] || 0) * (prices[p.id] || p.price), 0);
  const miss = (areas) => AC.rtAfter(room, tCur, areas).reduce((s, T, b) => s + Math.max(0, T / tTar[b] - 1.1), 0);
  const c = [AC._propose(room, tCur, tTar, enabled, prices, true), AC._propose(room, tCur, tTar, enabled, prices, false)];
  // se la superficie disponibile non basta scegliendo per costo, conta la resa per metro quadro
  return miss(c[0]) - miss(c[1]) > 0.02 ? c[1] : miss(c[1]) - miss(c[0]) > 0.02 ? c[0] : price(c[0]) <= price(c[1]) ? c[0] : c[1];
};
AC._propose = function (room, tCur, tTar, enabled, prices, perEuro) {
  const V = AC.geometry(room).V, host = AC.hostAlpha(room), cap = AC.capacity(room);
  const need = tCur.map((T, b) => 0.161 * V * (1 / tTar[b] - 1 / T));
  const maxG = tCur.map((T, b) => 0.161 * V * (1 / (0.85 * tTar[b]) - 1 / T));
  const prods = AC.PRODUCTS.filter((p) => enabled[p.id]).map((p) => ({ p, g: AC.gainPerM2(p, host), price: prices[p.id] || p.price }));
  const areas = {}, gain = need.map(() => 0), used = { wall: 0, ceiling: 0, floor: 0 };
  const err = (g) => g.reduce((s, v, b) => s + Math.max(0, need[b] - v) ** 2 + 2 * Math.max(0, v - Math.max(maxG[b], 0)) ** 2, 0);
  const step = AC.PANEL_M2 * Math.max(1, Math.round(Math.max(...need, 0) / 60 / AC.PANEL_M2));
  for (let it = 0; it < 600; it++) {
    const after = tCur.map((T, b) => (0.161 * V) / ((0.161 * V) / T + gain[b]));
    if (after.every((T, b) => T <= tTar[b] * 1.08)) break;
    const e0 = err(gain); let best = null;
    for (const q of prods) {
      if (used[q.p.where] + step > cap[q.p.where]) continue;
      const e1 = err(gain.map((v, b) => v + q.g[b] * step)), score = (e0 - e1) / ((perEuro ? q.price : 1) * step);
      if (score > 1e-9 && (!best || score > best.score)) best = { q, score };
    }
    if (!best) break;
    areas[best.q.p.id] = (areas[best.q.p.id] || 0) + step;
    used[best.q.p.where] += step;
    best.q.g.forEach((v, b) => { gain[b] += v * step; });
  }
  for (const k in areas) areas[k] = Math.round(areas[k] * 100) / 100;
  return areas;
};

/* ---------- Import scansione 3D (OBJ, metri) ---------- */
AC.parseOBJ = function (text, upAxis) {
  const vs = [], faces = [];
  for (const line of text.split('\n')) {
    if (line.charCodeAt(0) === 118 && line.charCodeAt(1) === 32) {
      const p = line.trim().split(/\s+/); vs.push([+p[1], +p[2], +p[3]]);
    } else if (line.charCodeAt(0) === 102 && line.charCodeAt(1) === 32) {
      const p = line.trim().split(/\s+/).slice(1).map((s) => parseInt(s, 10));
      for (let i = 1; i + 1 < p.length; i++) faces.push([p[0], p[i], p[i + 1]]);
    }
  }
  if (vs.length < 8) throw new Error('Il file non contiene una mesh valida.');
  const up = upAxis === 'z' ? 2 : 1, h1 = up === 2 ? 0 : 0, h2 = up === 2 ? 1 : 2;
  const zs = vs.map((v) => v[up]).sort((a, b) => a - b);
  const q = (arr, f) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(f * (arr.length - 1))))];
  const z0 = q(zs, 0.005), H = q(zs, 0.995) - z0;
  // rettangolo di area minima sulla pianta
  const stepN = Math.max(1, Math.floor(vs.length / 20000)), pts = [];
  for (let i = 0; i < vs.length; i += stepN) pts.push([vs[i][h1], vs[i][h2]]);
  let best = null;
  for (let deg = 0; deg < 90; deg++) {
    const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180);
    const us = pts.map((p) => p[0] * c + p[1] * s).sort((a, b) => a - b), ws = pts.map((p) => -p[0] * s + p[1] * c).sort((a, b) => a - b);
    const u0 = q(us, 0.005), u1 = q(us, 0.995), w0 = q(ws, 0.005), w1 = q(ws, 0.995), area = (u1 - u0) * (w1 - w0);
    if (!best || area < best.area) best = { area, c, s, u0, w0, du: u1 - u0, dw: w1 - w0 };
  }
  const swap = best.dw > best.du;
  const plan = pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / 2500)) === 0).map((p) => {
    const u = p[0] * best.c + p[1] * best.s - best.u0, w = -p[0] * best.s + p[1] * best.c - best.w0;
    return swap ? [w, u] : [u, w];
  });
  const cStep = Math.max(1, Math.floor(vs.length / 7000)), cloud = [];
  for (let i = 0; i < vs.length; i += cStep) {
    const u = vs[i][h1] * best.c + vs[i][h2] * best.s - best.u0, w = -vs[i][h1] * best.s + vs[i][h2] * best.c - best.w0;
    cloud.push(swap ? [w, u, vs[i][up] - z0] : [u, w, vs[i][up] - z0]);
  }
  let vol = 0;
  for (const f of faces) {
    const a = vs[(f[0] < 0 ? vs.length + f[0] : f[0] - 1)], b = vs[(f[1] < 0 ? vs.length + f[1] : f[1] - 1)], c = vs[(f[2] < 0 ? vs.length + f[2] : f[2] - 1)];
    if (!a || !b || !c) continue;
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  const r2 = (v) => Math.round(v * 100) / 100;
  return { L: r2(Math.max(best.du, best.dw)), W: r2(Math.min(best.du, best.dw)), H: r2(H), vertices: vs.length, faces: faces.length, meshVolume: Math.abs(vol), plan, cloud };
};

/* ---------- Posizioni consigliate per la misura (criteri ISO 3382-2) ---------- */
AC.recommendPositions = function (room) {
  const { L, W, H } = room, cl = (v, d) => { const m = Math.min(1, d / 3); return Math.round(Math.min(d - m, Math.max(m, v)) * 20) / 20; };
  return { src: [cl(0.18 * L, L), cl(0.42 * W, W), Math.min(1.5, H - 0.5)], mic: [cl(0.64 * L, L), cl(0.6 * W, W), 1.2] };
};
AC.minDistance = (room, T) => 2 * Math.sqrt((room.L * room.W * room.H) / (AC.C * Math.max(0.1, T)));

/* ---------- Disposizione dei pannelli sulle superfici ---------- */
AC.layout = function (room, areas) {
  const { L, W, H } = room, rp = {}, rects = [], notes = [], PA = AC.PANEL_M2;
  for (const p of AC.imageSources(room, 1).paths) rp[p.surface] = p.point;
  const num = (v) => v.toFixed(2).replace('.', ',');
  // bass trap negli angoli, a tutta altezza
  const nTrap = Math.min(4, Math.ceil((areas.trap || 0) / (0.6 * H) - 1e-6));
  const corners = [['front', 'left'], ['front', 'right'], ['back', 'left'], ['back', 'right']].slice(0, nTrap);
  for (const [a, b] of corners) {
    rects.push({ face: a, u: b === 'left' ? 0 : W - 0.4, v: 0, w: 0.4, h: H, type: 'trap' });
    rects.push({ face: b, u: a === 'front' ? 0 : L - 0.4, v: 0, w: 0.4, h: H, type: 'trap' });
  }
  if (nTrap) notes.push({ face: 'Angoli', text: `${nTrap} bass trap da pavimento a soffitto: ` + corners.map(([a, b]) => (a === 'front' ? 'frontale' : 'di fondo') + '-' + (b === 'left' ? 'sinistro' : 'destro')).join(', ') + '.' });
  // tenda sulla parete di fondo
  let curtainW = 0;
  if (areas.curtain > 0) {
    curtainW = Math.min(W - 1, areas.curtain / (H - 0.2));
    rects.push({ face: 'back', u: (W - curtainW) / 2, v: 0.1, w: curtainW, h: H - 0.2, type: 'curtain' });
    notes.push({ face: 'Parete di fondo', text: `tenda larga ${num(curtainW)} m a tutta altezza, centrata.` });
  }
  // pannelli a parete 60 x 120 cm
  const wallA = AC.PRODUCTS.filter((p) => p.where === 'wall' && p.id !== 'trap' && p.id !== 'curtain').reduce((s, p) => s + (areas[p.id] || 0), 0);
  let n = Math.ceil(wallA / PA - 1e-6);
  const m = 0.6, rows = H >= 2.8 ? 2 : 1;
  const walls = [['left', L], ['right', L], ['front', W], ['back', W]].filter((w) => !(w[0] === 'back' && curtainW > 0))
    .map(([id, len]) => ({ id, len, cap: rows * Math.max(0, Math.floor((len - 2 * m) / 0.7)), k: 0 }));
  while (n > 0) {
    const c = walls.filter((w) => w.k < w.cap).sort((a, b) => a.k / a.len - b.k / b.len)[0];
    if (!c) break;
    c.k++; n--;
  }
  for (const w of walls) {
    if (!w.k) continue;
    const used = w.k > w.cap / rows ? 2 : 1, per = [Math.ceil(w.k / used), Math.floor(w.k / used)], bottoms = used === 1 ? [0.9] : [0.3, 1.55];
    const ru = rp[w.id][w.id === 'left' || w.id === 'right' ? 0 : 1], span = w.len - 2 * m; let list = [], snapped = false;
    for (let r = 0; r < used; r++) {
      const c = per[r]; let cs = [];
      for (let i = 0; i < c; i++) cs.push(m + ((i + 0.5) * span) / c);
      if (r) cs = list.slice(0, c);
      else if (c && span / c >= 0.9) { let b = 0; cs.forEach((v, i) => { if (Math.abs(v - ru) < Math.abs(cs[b] - ru)) b = i; }); if (Math.abs(cs[b] - ru) < span / c / 2) snapped = true; if (snapped) cs[b] = Math.min(w.len - 0.35, Math.max(0.35, ru)); }
      for (const u of cs) rects.push({ face: w.id, u: u - 0.3, v: bottoms[r], w: 0.6, h: 1.2, type: 'panel' });
      if (!r) list = cs;
    }
    const name = AC.SURFACES.find((s) => s.id === w.id).name, ref = w.id === 'left' || w.id === 'right' ? 'dalla parete frontale' : 'dalla parete sinistra';
    notes.push({ face: name, text: `${w.k} pannelli 60 × 120 cm in ${used === 1 ? 'una fila, bordo inferiore a 0,90 m da terra' : 'due file, bordi inferiori a 0,30 e 1,55 m da terra'}; centri a ${list.map(num).join(' · ')} m ${ref}` + (used === 2 ? ', seconda fila allineata alla prima' : '') + '.' + (snapped ? ' Un pannello è centrato sul punto di prima riflessione.' : '') });
  }
  if (n > 0) notes.push({ face: 'Pareti', text: `${n} pannelli non trovano posto con questa disposizione: valuta il soffitto o pannelli più spessi.` });
  // soffitto 120 x 60 cm
  const nc = Math.ceil(((areas.baffle || 0) + (areas.ceil || 0)) / PA - 1e-6);
  if (nc > 0) {
    const cols = Math.max(1, Math.min(Math.floor(L / 1.3), Math.ceil(Math.sqrt((nc * L) / W / 2)))), rws = Math.ceil(nc / cols);
    for (let i = 0; i < nc; i++) rects.push({ face: 'ceiling', u: ((i % cols) + 0.5) * (L / cols) - 0.6, v: (Math.floor(i / cols) + 0.5) * (W / rws) - 0.3, w: 1.2, h: 0.6, type: 'ceil' });
    notes.push({ face: 'Soffitto', text: `${nc} pannelli 120 × 60 cm in griglia ${cols} × ${rws}, interasse ${num(L / cols)} m in lunghezza e ${num(W / rws)} m in larghezza.` });
  }
  if (areas.carpet > 0) {
    const cw = Math.min(L - 0.5, Math.sqrt((areas.carpet * L) / W)), ch = Math.min(W - 0.5, areas.carpet / cw);
    const cx = Math.min(L - cw / 2, Math.max(cw / 2, (room.src[0] + room.mic[0]) / 2)), cy = Math.min(W - ch / 2, Math.max(ch / 2, (room.src[1] + room.mic[1]) / 2));
    rects.push({ face: 'floor', u: cx - cw / 2, v: cy - ch / 2, w: cw, h: ch, type: 'carpet' });
    notes.push({ face: 'Pavimento', text: `tappeto di ${num(cw)} × ${num(ch)} m tra sorgente e ascoltatore.` });
  }
  const dots = Object.keys(rp).filter((k) => k !== 'floor').map((k) => ({ face: k, u: rp[k][k === 'front' || k === 'back' ? 1 : 0], v: rp[k][k === 'ceiling' ? 1 : 2] }));
  return { rects, notes, dots };
};
/* Sviluppo della stanza: pianta al centro, pareti ribaltate verso l'esterno. Coordinate in metri. */
AC.unfold = function (room, r) {
  const { L, W, H } = room, w = r.w || 0, h = r.h || 0;
  switch (r.face) {
    case 'left': return [H + r.u, H + W + r.v, w, h];
    case 'right': return [H + r.u, H - r.v - h, w, h];
    case 'front': return [H - r.v - h, H + (W - r.u - w), h, w];
    case 'back': return [H + L + r.v, H + (W - r.u - w), h, w];
    default: return [H + r.u, H + (W - r.v - h), w, h];
  }
};

AC.MICS = [
  { id: 'iphone', name: 'iPhone (microfono integrato)', note: 'Adatto a riverbero e riflessioni da 250 Hz in su. Usa il microfono inferiore, senza custodia che lo copra.' },
  { id: 'ipad', name: 'iPad (microfono integrato)', note: 'Adatto a riverbero e riflessioni da 250 Hz in su. Appoggialo su un supporto, non tenerlo in mano.' },
  { id: 'mac', name: 'MacBook / iMac (microfoni integrati)', note: 'I microfoni a schiera sono direzionali e filtrati: buoni per il riverbero alle medie frequenze, meno per le singole riflessioni.' },
  { id: 'android', name: 'Smartphone Android (microfono integrato)', note: 'La risposta cambia molto da modello a modello e alcuni applicano sempre riduzione del rumore: verifica la dinamica della misura.' },
  { id: 'tabletandroid', name: 'Tablet Android (microfono integrato)', note: 'Come per gli smartphone Android: controlla che la dinamica superi 35 dB in ogni banda.' },
  { id: 'pc', name: 'Portatile Windows (microfono integrato)', note: 'Spesso con soppressione del rumore attiva dal driver: disattivala nelle impostazioni audio prima di misurare.' },
  { id: 'usbmeas', name: 'Microfono di misura USB (es. miniDSP UMIK-1)', note: 'Scelta consigliata: omnidirezionale e con risposta piatta, misura affidabile su tutte le bande.' },
  { id: 'xlrmeas', name: 'Microfono di misura XLR con scheda audio', note: 'Scelta consigliata: omnidirezionale e con risposta piatta. Disattiva compressori e filtri sulla scheda.' },
  { id: 'ext', name: 'Microfono esterno generico (lavalier, USB, da studio)', note: 'Se è cardioide puntalo verso il soffitto: la direttività attenua le riflessioni che arrivano da dietro.' },
  { id: 'other', name: 'Altro', note: 'Indica il modello: verrà riportato nella relazione.' },
];

/* ---------- Registrazioni ---------- */
AC.testSweep = (fs) => AC.genSweep(fs, 4, 60, Math.min(16000, fs * 0.45));
AC.encodeWav = function (x, fs) {
  const buf = new ArrayBuffer(44 + x.length * 2), v = new DataView(buf), str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + x.length * 2, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, fs, true); v.setUint32(28, fs * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 32767, true);
  return buf;
};
/* Da una registrazione qualsiasi ricava la risposta all'impulso: riconosce se contiene lo sweep di test o un impulso. */
AC.autoIR = function (x, fs) {
  const crest = (a) => { let mx = 0, e = 0; for (let i = 0; i < a.length; i++) { const q = a[i] * a[i]; e += q; if (q > mx) mx = q; } return mx / (e / a.length + 1e-30); };
  if (x.length > 30 * fs) return { ir: x, kind: 'impulse' };
  const d = AC.deconvolve(x, AC.testSweep(fs));
  return crest(d) > crest(x) ? { ir: Float32Array.from(d), kind: 'sweep' } : { ir: x, kind: 'impulse' };
};
AC.PRESETS = [
  { id: 'casa', name: 'Stanza domestica', mats: { floor: 'parquet', ceiling: 'intonaco', front: 'intonaco', back: 'intonaco', left: 'intonaco', right: 'intonaco' } },
  { id: 'ufficio', name: 'Ufficio con controsoffitto', mats: { floor: 'linoleum', ceiling: 'controsoffitto', front: 'cartongesso', back: 'cartongesso', left: 'cartongesso', right: 'vetro' } },
  { id: 'aula', name: 'Aula / sala riunioni', mats: { floor: 'linoleum', ceiling: 'intonaco', front: 'intonaco', back: 'intonaco', left: 'intonaco', right: 'intonaco' } },
  { id: 'ristorante', name: 'Ristorante / locale con piastrelle', mats: { floor: 'piastrelle', ceiling: 'intonaco', front: 'intonaco', back: 'intonaco', left: 'intonaco', right: 'vetro' } },
  { id: 'industriale', name: 'Capannone / spazio in cemento', mats: { floor: 'cemento', ceiling: 'cemento', front: 'cemento', back: 'cemento', left: 'cemento', right: 'cemento' } },
  { id: 'studio', name: 'Sala con moquette e tende', mats: { floor: 'moquette', ceiling: 'intonaco', front: 'intonaco', back: 'tenda', left: 'intonaco', right: 'intonaco' } },
];

if (typeof module !== 'undefined') module.exports = AC;
