(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => (v == null || !isFinite(v) ? 'n.d.' : v.toFixed(d == null ? 2 : d).replace('.', ','));
  const bandLabel = (fc) => (fc >= 1000 ? fc / 1000 + ' kHz' : fc + ' Hz');
  const surfName = (id) => (AC.SURFACES.find((s) => s.id === id) || { name: '—' }).name;
  const SIGN_NAME = 'Massimiliano Mascioli Trippa', SIGN_ORG = 'Studio M';
  const WHERE = { wall: 'parete', ceiling: 'soffitto', floor: 'pavimento' };
  const KIND = { prima: ['Prima riflessione', 'warn'], precoce: ['Riflessione precoce', ''], tardiva: ['Riflessione tardiva', ''], eco: ['Eco percepibile', 'crit'] };

  const state = {
    room: {
      L: 6, W: 4.5, H: 2.8, windows: 6, doors: 2, people: 0, chairs: 10,
      mats: { floor: 'parquet', ceiling: 'intonaco', front: 'intonaco', back: 'intonaco', left: 'intonaco', right: 'intonaco' },
      src: [1.2, 2.0, 1.4], mic: [4.2, 2.7, 1.2],
    },
    use: 'riunioni', target: null, scan: null, meas: null, photos: [],
    treat: { areas: {}, enabled: Object.fromEntries(AC.PRODUCTS.map((p) => [p.id, !['mel50', 'curtain', 'carpet', 'ceil'].includes(p.id)])), prices: {} },
    etcRange: 60, decayBand: 3, mic: { type: 'iphone', model: '' }, inputId: '', client: '', project: '', touched: {}, view: { yaw: -0.6, pitch: 0.5 }, frSmooth: 6, cal: 120, calibrated: false,
  };
  try {
    const saved = JSON.parse(localStorage.getItem('rilievo-acustico.v1') || 'null');
    if (saved && saved.room && saved.room.mats) { Object.assign(state.room, saved.room); state.use = saved.use || state.use; state.target = saved.target || null; Object.assign(state.treat, saved.treat || {}); Object.assign(state.mic, saved.mic || {}); state.client = saved.client || ''; state.touched = saved.touched || {}; state.inputId = saved.inputId || ''; if (saved.cal) { state.cal = saved.cal; state.calibrated = !!saved.calibrated; } state.project = saved.project || ''; }
  } catch (e) { /* archivio non disponibile */ }
  const save = () => { try { localStorage.setItem('rilievo-acustico.v1', JSON.stringify({ room: state.room, use: state.use, target: state.target, treat: state.treat, mic: state.mic, client: state.client, project: state.project, touched: state.touched, inputId: state.inputId, cal: state.cal, calibrated: state.calibrated })); } catch (e) { /* idem */ } };

  /* ---------- Grafico a linee con tooltip ---------- */
  let chartId = 0;
  function drawChart(el, o) {
    const W = Math.max(280, el.clientWidth || 640), H = o.h || 260, m = { l: 46, r: 14, t: 26, b: 40 };
    const tx = o.x.log ? Math.log : (v) => v, X = (v) => m.l + ((tx(v) - tx(o.x.min)) / (tx(o.x.max) - tx(o.x.min))) * (W - m.l - m.r);
    const Y = (v) => m.t + ((o.y.max - v) / (o.y.max - o.y.min)) * (H - m.t - m.b);
    const id = 'clip' + ++chartId;
    let s = '';
    if (o.series.length > 1 || o.area) {
      s += '<div class="legend">' + o.series.map((q) => `<span><i style="background:var(${q.color})"></i>${esc(q.name)}</span>`).join('') +
        (o.area ? `<span><i class="band" style="background:var(${o.area.color})"></i>${esc(o.area.name)}</span>` : '') + '</div>';
    }
    s += `<svg width="${W}" height="${H}" role="img" aria-label="${esc(o.label)}"><defs><clipPath id="${id}"><rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}"/></clipPath></defs>`;
    for (const t of o.y.ticks) s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)" stroke-width="1"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${String(t).replace('.', ',')}</text>`;
    for (const t of o.x.ticks) s += `<text x="${X(t.v)}" y="${H - m.b + 16}" text-anchor="middle">${esc(t.l)}</text>` + (o.x.log ? `<line x1="${X(t.v)}" x2="${X(t.v)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--line)" stroke-width="1"/>` : '');
    for (const v of o.vlines || []) s += `<line x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--s2)" stroke-width="1" stroke-dasharray="2 3"/>`;
    s += `<line x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}" stroke="var(--line-strong)" stroke-width="1"/>`;
    s += `<text x="${(m.l + W - m.r) / 2}" y="${H - 6}" text-anchor="middle">${esc(o.x.title)}</text><text x="12" y="11">${esc(o.y.title)}</text>`;
    s += `<g clip-path="url(#${id})">`;
    if (o.area) s += `<polygon fill="var(${o.area.color})" fill-opacity="0.16" points="${o.area.hi.map((p) => X(p[0]) + ',' + Y(p[1])).join(' ')} ${o.area.lo.slice().reverse().map((p) => X(p[0]) + ',' + Y(p[1])).join(' ')}"/>`;
    for (const q of o.series) {
      s += `<path fill="none" stroke="var(${q.color})" stroke-width="2" stroke-linejoin="round" ${q.dash ? 'stroke-dasharray="6 4"' : ''} d="${q.pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('')}"/>`;
      if (q.dots) for (const p of q.pts) s += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4" fill="var(${q.color})" stroke="var(--panel)" stroke-width="2"/>`;
    }
    s += '</g>';
    for (const k of o.marks || []) {
      if (k.x > o.x.max) continue;
      const cy = Math.max(m.t + 14, Y(k.y));
      s += `<circle cx="${X(k.x)}" cy="${cy}" r="4.5" fill="var(${k.color})" stroke="var(--panel)" stroke-width="2"/><text class="ink" x="${X(k.x)}" y="${cy - 9}" text-anchor="middle">${esc(k.label)}</text>`;
    }
    s += `<line class="cross" y1="${m.t}" y2="${H - m.b}" stroke="var(--line-strong)" stroke-width="1" visibility="hidden"/></svg><div class="tip" hidden></div>`;
    el.innerHTML = s; el._opts = o;
    const svg = $('svg', el), cross = $('.cross', el), tip = $('.tip', el);
    const move = (ev) => {
      const r = svg.getBoundingClientRect(), px = ev.clientX - r.left;
      if (px < m.l || px > W - m.r) return leave();
      const fr0 = (px - m.l) / (W - m.l - m.r), xv = o.x.log ? o.x.min * Math.pow(o.x.max / o.x.min, fr0) : o.x.min + fr0 * (o.x.max - o.x.min);
      let rows = '', xs = null;
      for (const q of o.series) {
        let best = q.pts[0];
        for (const p of q.pts) if (Math.abs(p[0] - xv) < Math.abs(best[0] - xv)) best = p;
        if (xs == null) xs = best[0];
        rows += `<div><i style="background:var(${q.color})"></i>${esc(q.name)}: ${f(best[1], o.dec == null ? 1 : o.dec)} ${o.unit}</div>`;
      }
      cross.setAttribute('x1', X(xs)); cross.setAttribute('x2', X(xs)); cross.setAttribute('visibility', 'visible');
      tip.innerHTML = `<b>${esc(o.x.fmt(xs))}</b>${rows}`; tip.hidden = false;
      const tw = tip.offsetWidth, left = X(xs) + 12 + tw > W ? X(xs) - 12 - tw : X(xs) + 12;
      tip.style.left = Math.max(0, left) + 'px'; tip.style.top = svg.offsetTop + m.t + 'px';
    };
    const leave = () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move); svg.addEventListener('pointerleave', leave);
  }

  /* ---------- Dati derivati ---------- */
  const model = () => AC.rtModel(state.room);
  const geo = () => AC.geometry(state.room);
  const targetMid = () => state.target || Math.max(0.2, AC.USES.find((u) => u.id === state.use).t(geo().V));
  function current() {
    const mdl = model(), fromMeas = [];
    const t = mdl.map((v, b) => {
      const r = state.meas && state.meas.res.bands[b].rt;
      fromMeas.push(!!r);
      return r || v;
    });
    return { t, fromMeas };
  }
  const mid = (arr) => (arr[2] + arr[3]) / 2;

  function drawPlan(el, dims) {
    const r = state.room, W = Math.max(280, el.clientWidth || 600), pad = 34;
    const sc = Math.min((W - 2 * pad) / r.L, 320 / r.W), w = r.L * sc, h = r.W * sc, ox = (W - w) / 2, oy = pad;
    const P = (x, y) => [ox + x * sc, oy + h - y * sc];
    let s = `<svg width="${W}" height="${h + 2 * pad}" role="img" aria-label="Pianta della stanza con sorgente, microfono e prime riflessioni sulle pareti">`;
    s += `<rect x="${ox}" y="${oy}" width="${w}" height="${h}" fill="var(--bg)" stroke="var(--ink-2)" stroke-width="2"/>`;
    if (state.scan) for (const p of state.scan.plan) { const q = P(p[0], p[1]); s += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="1" fill="var(--muted)"/>`; }
    const first = AC.imageSources(r, 1).paths, S = P(r.src[0], r.src[1]), M = P(r.mic[0], r.mic[1]);
    for (const p of first) {
      if (p.surface === 'floor' || p.surface === 'ceiling') continue;
      const q = P(p.point[0], p.point[1]);
      s += `<polyline fill="none" stroke="var(--s2)" stroke-width="1.5" stroke-dasharray="5 4" points="${S} ${q} ${M}"/><circle cx="${q[0]}" cy="${q[1]}" r="4" fill="var(--s2)" stroke="var(--panel)" stroke-width="2"/>`;
    }
    s += `<line x1="${S[0]}" y1="${S[1]}" x2="${M[0]}" y2="${M[1]}" stroke="var(--s1)" stroke-width="2"/>`;
    s += `<circle cx="${S[0]}" cy="${S[1]}" r="7" fill="var(--s1)" stroke="var(--panel)" stroke-width="2"/><text class="ink" x="${S[0]}" y="${S[1] - 12}" text-anchor="middle">Sorgente</text>`;
    s += `<rect x="${M[0] - 6}" y="${M[1] - 6}" width="12" height="12" fill="var(--ink)" stroke="var(--panel)" stroke-width="2"/><text class="ink" x="${M[0]}" y="${M[1] - 12}" text-anchor="middle">Microfono</text>`;
    s += `<text x="${ox + w / 2}" y="${oy + h + 16}" text-anchor="middle">Parete sinistra · ${f(r.L)} m</text><text x="${ox + w / 2}" y="${oy - 8}" text-anchor="middle">Parete destra</text>`;
    s += `<text transform="translate(${ox - 8},${oy + h / 2}) rotate(-90)" text-anchor="middle">Frontale · ${f(r.W)} m</text><text transform="translate(${ox + w + 16},${oy + h / 2}) rotate(-90)" text-anchor="middle">Fondo</text>`;
    if (dims) {
      const nx = r.mic[0] < r.L / 2 ? 0 : r.L, ny = r.mic[1] < r.W / 2 ? 0 : r.W, a = P(nx, r.mic[1]), b = P(r.mic[0], ny);
      s += `<line x1="${M[0]}" y1="${M[1]}" x2="${a[0]}" y2="${a[1]}" stroke="var(--ink)" stroke-width="1"/><line x1="${M[0]}" y1="${M[1]}" x2="${b[0]}" y2="${b[1]}" stroke="var(--ink)" stroke-width="1"/>`;
      s += `<text class="ink" x="${(M[0] + a[0]) / 2}" y="${M[1] + 14}" text-anchor="middle">${f(Math.abs(nx - r.mic[0]))} m</text><text class="ink" x="${M[0] + 6}" y="${(M[1] + b[1]) / 2 + 4}">${f(Math.abs(ny - r.mic[1]))} m</text>`;
    }
    el.innerHTML = s + '</svg>';
  }

  /* ---------- Fase 1: ambiente ---------- */
  function renderRoom() {
    const g = geo(), r = state.room;
    $('#geo-out').textContent = `Volume ${f(g.V, 1)} m³ · superficie ${f(g.S, 1)} m²`;
    drawPlan($('#plan'), false);
    const first = AC.imageSources(r, 1).paths;
    $('#first-table').innerHTML = '<tr><th>Superficie</th><th class="n">Ritardo</th><th class="n">Percorso in più</th><th class="n">Livello stimato</th><th>Punto di riflessione (x; y; z)</th></tr>' +
      first.map((p) => `<tr><td>${surfName(p.surface)}</td><td class="n">${f(p.delay, 1)} ms</td><td class="n">${f((p.delay / 1000) * AC.C)} m</td><td class="n">${f(p.level, 1)} dB</td><td>${p.point.map((v) => f(Math.abs(v), 2)).join('; ')} m</td></tr>`).join('');
    const ab = AC.absorption(r), mdl = model();
    $('#model-table').innerHTML = '<tr><th>Banda</th>' + AC.BANDS.map((b) => `<th class="n">${bandLabel(b)}</th>`).join('') + '</tr>' +
      '<tr><td>Assorbimento (m²)</td>' + ab.A.map((a) => `<td class="n">${f(a, 1)}</td>`).join('') + '</tr>' +
      '<tr><td>RT60 (s)</td>' + mdl.map((t) => `<td class="n">${f(t)}</td>`).join('') + '</tr>';
    $('#photos').innerHTML = state.photos.map((p, i) => `<figure><img src="${p.url}" alt="${esc(p.caption || 'Foto ' + (i + 1))}"><input type="text" id="cap-${i}" data-cap="${i}" value="${esc(p.caption)}" placeholder="Didascalia" aria-label="Didascalia foto ${i + 1}"></figure>`).join('');
  }

  /* ---------- Fase 2: misura ---------- */
  function renderMic() {
    drawPlan($('#plan2'), true);
    const r = state.room, d = Math.hypot(r.src[0] - r.mic[0], r.src[1] - r.mic[1], r.src[2] - r.mic[2]), dmin = AC.minDistance(r, mid(model()));
    const wx = r.mic[0] < r.L / 2 ? ['parete frontale', r.mic[0]] : ['parete di fondo', r.L - r.mic[0]], wy = r.mic[1] < r.W / 2 ? ['parete sinistra', r.mic[1]] : ['parete destra', r.W - r.mic[1]];
    const out = [
      `<b>Microfono</b>: a ${f(wx[1])} m dalla ${wx[0]} e ${f(wy[1])} m dalla ${wy[0]}, a ${f(r.mic[2])} m da terra (orecchie di una persona seduta). Montalo su un'asta o un treppiede con la capsula rivolta verso il soffitto.`,
      `<b>Sorgente</b>: a ${f(r.src[0])} m dalla parete frontale e ${f(r.src[1])} m dalla parete sinistra, a ${f(r.src[2])} m da terra, dove normalmente si trova chi parla o i diffusori.`,
      `<b>Distanza sorgente–microfono</b>: ${f(d)} m. Il minimo per non misurare solo il suono diretto in questa stanza è ${f(dmin)} m.`,
    ];
    if (d < dmin) out.push('<b>Attenzione</b>: sorgente e microfono sono troppo vicini, allontanali.');
    if (Math.min(wx[1], wy[1]) < 1 && Math.min(r.L, r.W) > 3) out.push('<b>Attenzione</b>: il microfono è a meno di 1 m da una parete, la riflessione vicina altera la misura.');
    if (Math.abs(r.mic[0] / r.L - 0.5) < 0.04 && Math.abs(r.mic[1] / r.W - 0.5) < 0.04) out.push('<b>Attenzione</b>: il centro esatto della stanza va evitato, lì alcune risonanze si annullano. Spostati di almeno 50 cm.');
    out.push('Per un rilievo completo ripeti la misura in altri due punti distanti almeno 2 m tra loro e confronta i risultati.');
    $('#mic-advice').innerHTML = out.map((a) => `<li>${a}</li>`).join('');
    $('#mic-note').textContent = AC.MICS.find((m) => m.id === state.mic.type).note;
  }
  const micLabel = () => AC.MICS.find((m) => m.id === state.mic.type).name + (state.mic.model ? ' · ' + state.mic.model : '');

  function renderMeas() {
    const m = state.meas;
    $('#meas-tag').textContent = m ? m.label : 'Nessuna misura';
    if (!m) return;
    const res = m.res, tm = targetMid();
    const tile = (label, val, unit, sub) => `<div class="tile"><span>${label}</span><b>${val}<small>${unit}</small></b><em>${sub}</em></div>`;
    $('#tiles').innerHTML =
      tile('RT60 a 500–1000 Hz', f(res.rtMid), 's', `obiettivo ${f(tm)} s`) +
      tile('EDT', f(res.edtMid), 's', 'riverbero percepito') +
      tile('C50', f(res.c50, 1), 'dB', res.c50 >= 0 ? 'parlato chiaro' : 'parlato impastato') +
      tile('D50', f(res.d50 * 100, 0), '%', 'energia utile entro 50 ms') +
      tile('Dinamica', f(res.broad.inr, 0), 'dB', res.broad.inr >= 45 ? 'misura affidabile' : res.broad.inr >= 30 ? 'accettabile' : 'rumore troppo alto');
    const refl = AC.matchReflections(res.reflections, state.room), R = state.etcRange;
    drawChart($('#etc-chart'), {
      label: 'Curva energia-tempo con le riflessioni rilevate', h: 280, unit: 'dB',
      x: { min: -2, max: R, title: 'Tempo dopo il suono diretto (ms)', ticks: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ v: (i * R) / 6, l: String(Math.round((i * R) / 6)) })), fmt: (x) => f(x, 1) + ' ms · percorso +' + f((Math.max(0, x) / 1000) * AC.C, 2) + ' m' },
      y: { min: -60, max: 6, title: 'Livello (dB)', ticks: [0, -10, -20, -30, -40, -50, -60] },
      series: [{ name: 'Energia', color: '--s1', pts: res.etc.filter((p) => p[0] >= -2 && p[0] <= R).map((p) => [p[0], Math.max(-60, p[1])]) }],
      marks: refl.map((r, i) => ({ x: r.ms, y: r.dB, label: String(i + 1), color: r.kind === 'eco' ? '--crit' : '--s2' })),
    });
    $('#refl-table').innerHTML = refl.length
      ? '<tr><th class="n">N.</th><th class="n">Ritardo</th><th class="n">Livello</th><th class="n">Percorso in più</th><th>Superficie probabile</th><th>Valutazione</th></tr>' +
        refl.map((r, i) => `<tr><td class="n">${i + 1}</td><td class="n">${f(r.ms, 1)} ms</td><td class="n">${f(r.dB, 1)} dB</td><td class="n">${f(r.extra)} m</td><td>${r.surface ? surfName(r.surface) : 'secondo ordine o arredo'}</td><td><span class="pill ${KIND[r.kind][1]}"><i></i>${KIND[r.kind][0]}</span></td></tr>`).join('')
      : '<tr><td>Nessuna riflessione isolata emerge dal decadimento.</td></tr>';
    const fl = $('#flutter'); fl.hidden = !res.flutter;
    if (res.flutter) fl.textContent = `Flutter echo: ripetizioni ogni ${f(res.flutter.periodMs, 0)} ms, compatibili con due superfici parallele a ${f(res.flutter.distance, 1)} m${flutterPair(res.flutter) ? ' (' + flutterPair(res.flutter) + ')' : ''}.`;
    const b = state.decayBand, d = b < 0 ? res.broad : res.bands[b], tmax = Math.max(0.2, d.curve.length ? d.curve[d.curve.length - 1][0] : 1);
    const stepT = tmax > 2 ? 0.5 : tmax > 0.8 ? 0.2 : 0.1, ticks = [];
    for (let t = 0; t <= tmax + 1e-9; t += stepT) ticks.push({ v: t, l: f(t, 1) });
    drawChart($('#decay-chart'), {
      label: 'Curva di decadimento di Schroeder', h: 240, unit: 'dB',
      x: { min: 0, max: tmax, title: 'Tempo (s)', ticks, fmt: (x) => f(x, 2) + ' s' },
      y: { min: -60, max: 0, title: 'Energia residua (dB)', ticks: [0, -10, -20, -30, -40, -50, -60] },
      series: [{ name: 'Decadimento', color: '--s1', pts: d.curve.filter((p) => p[1] >= -60) }],
    });
    $('#band-table').innerHTML = '<tr><th>Banda</th>' + AC.BANDS.map((x) => `<th class="n">${bandLabel(x)}</th>`).join('') + '</tr>' +
      '<tr><td>RT60 (s)</td>' + res.bands.map((x) => `<td class="n">${f(x.rt)}</td>`).join('') + '</tr>' +
      '<tr><td>Metodo</td>' + res.bands.map((x) => `<td class="n">${x.method || '—'}</td>`).join('') + '</tr>' +
      '<tr><td>EDT (s)</td>' + res.bands.map((x) => `<td class="n">${f(x.edt)}</td>`).join('') + '</tr>' +
      '<tr><td>Dinamica (dB)</td>' + res.bands.map((x) => `<td class="n">${f(x.inr, 0)}</td>`).join('') + '</tr>';
  }
  function flutterPair(fl) {
    const r = state.room, c = [[r.L, 'parete frontale e di fondo'], [r.W, 'pareti laterali'], [r.H, 'pavimento e soffitto']];
    const m = c.find((x) => Math.abs(x[0] - fl.distance) / x[0] < 0.12);
    return m ? m[1] : '';
  }

  /* ---------- Fase 3: intervento ---------- */
  function buildProducts() {
    $('#prod-table').innerHTML = '<tr><th></th><th>Prodotto</th><th>Posa</th><th class="n">α medio</th><th class="n">α 125 Hz</th><th class="n">Prezzo €/m²</th><th class="n">Superficie m²</th><th class="n">Pannelli</th><th class="n">Costo</th></tr>' +
      AC.PRODUCTS.map((p) => `<tr data-p="${p.id}"><td><input type="checkbox" id="en-${p.id}" data-en="${p.id}" aria-label="Usa ${esc(p.name)}"></td><td>${esc(p.name)}</td><td>${WHERE[p.where]}</td><td class="n">${f((p.a[1] + p.a[2] + p.a[3] + p.a[4]) / 4)}</td><td class="n">${f(p.a[0])}</td>` +
        `<td class="n"><input type="number" id="pr-${p.id}" data-price="${p.id}" min="0" step="5" aria-label="Prezzo ${esc(p.name)}"></td><td class="n"><input type="number" id="ar-${p.id}" data-area="${p.id}" min="0" step="0.72" aria-label="Superficie ${esc(p.name)}"></td><td class="n" data-cnt></td><td class="n" data-cost></td></tr>`).join('') +
      '<tr><td></td><td><b>Totale</b></td><td></td><td></td><td></td><td></td><td class="n" id="tot-area"></td><td class="n" id="tot-cnt"></td><td class="n" id="tot-cost"></td></tr>';
    syncProducts();
  }
  function syncProducts() {
    for (const p of AC.PRODUCTS) {
      $('#en-' + p.id).checked = !!state.treat.enabled[p.id];
      $('#pr-' + p.id).value = state.treat.prices[p.id] || p.price;
      $('#ar-' + p.id).value = state.treat.areas[p.id] || 0;
    }
  }
  function totals() {
    let area = 0, cost = 0, cnt = 0; const used = { wall: 0, ceiling: 0, floor: 0 };
    for (const p of AC.PRODUCTS) {
      const a = state.treat.areas[p.id] || 0, c = a * (state.treat.prices[p.id] || p.price), n = Math.ceil(a / AC.PANEL_M2 - 1e-6);
      area += a; cost += c; used[p.where] += a;
      if (p.where !== 'floor' && p.id !== 'curtain' && p.id !== 'ceil') cnt += n;
      const row = $(`tr[data-p="${p.id}"]`);
      if (row) { $('[data-cnt]', row).textContent = a && p.where !== 'floor' && p.id !== 'curtain' && p.id !== 'ceil' ? n : '—'; $('[data-cost]', row).textContent = a ? Math.round(c).toLocaleString('it-IT') + ' €' : '—'; }
    }
    return { area, cost, cnt, used };
  }
  function advice(cur, after, tTar, tot) {
    const out = [], r = state.room, cap = AC.capacity(r);
    if (state.meas) {
      const refl = AC.matchReflections(state.meas.res.reflections, r), first = AC.imageSources(r, 1).paths;
      for (const x of refl) {
        if (x.surface && x.dB > -12 && x.kind !== 'tardiva') {
          const pt = first.find((p) => p.surface === x.surface).point.map((v) => f(Math.abs(v), 1)).join('; ');
          out.push(`<b>${surfName(x.surface)}</b>: riflessione a ${f(x.ms, 1)} ms e ${f(x.dB, 0)} dB. Punto di riflessione a x; y; z = ${pt} m${x.surface === 'floor' ? ' oppure un tappeto tra sorgente e ascoltatore' : ''}.`);
        }
        if (x.kind === 'eco') out.push(`<b>Eco a ${f(x.ms, 0)} ms</b> (percorso più lungo di ${f(x.extra, 1)} m): tratta con materiale spesso la parete opposta alla sorgente, oppure rompi la riflessione con elementi diffondenti.`);
      }
      const fl = state.meas.res.flutter;
      if (fl) out.push(`<b>Flutter echo</b> tra superfici parallele a ${f(fl.distance, 1)} m${flutterPair(fl) ? ' (' + flutterPair(fl) + ')' : ''}: copri almeno una delle due con pannelli sfalsati rispetto alla parete di fronte.`);
    }
    if (after[0] > tTar[0] * 1.2) out.push('<b>Basse frequenze</b>: a 125 Hz il riverbero resta lungo rispetto alle medie. Aggiungi bass trap negli angoli verticali o pannelli da 100 mm distanziati dalla parete.');
    const over = Object.keys(cap).filter((k) => tot.used[k] > cap[k] + 0.01);
    const cw = $('#cap-warn'); cw.hidden = !over.length;
    if (over.length) cw.textContent = 'La superficie prevista supera quella realisticamente disponibile su: ' + over.map((k) => `${WHERE[k]} (massimo circa ${f(cap[k], 1)} m²)`).join(', ') + '.';
    if (tot.area > 0 && after.some((t, b) => t > tTar[b] * 1.2)) out.push('Con i prodotti selezionati l\'obiettivo non è raggiunto in tutte le bande: abilita altri prodotti o aumenta le superfici.');
    if (!tot.area) out.push(cur.t.every((t, b) => t <= tTar[b] * 1.2) ? 'Il riverbero attuale rientra già nell\'obiettivo: non serve aggiungere assorbimento.' : 'Premi «Proponi l\'intervento» per calcolare le superfici necessarie.');
    return out;
  }
  const LTYPES = { panel: ['Pannelli a parete', '--s3', 0.9], ceil: ['Pannelli a soffitto', '--s1', 0.75], trap: ['Bass trap', '--ink', 0.85], curtain: ['Tenda', '--s2', 0.35], carpet: ['Tappeto', '--muted', 0.3] };
  function renderLayout() {
    const r = state.room, lay = AC.layout(r, state.treat.areas), el = $('#layout');
    const Wpx = Math.max(280, el.clientWidth || 800), tw = r.L + 2 * r.H, th = r.W + 2 * r.H, sc = Math.min((Wpx - 44) / tw, 560 / th), ox = (Wpx - tw * sc) / 2;
    const R = (q) => { const u = AC.unfold(r, q); return [ox + u[0] * sc, 20 + u[1] * sc, u[2] * sc, u[3] * sc]; };
    let s = `<svg width="${Wpx}" height="${th * sc + 40}" viewBox="0 0 ${Wpx} ${th * sc + 40}" role="img" aria-label="Sviluppo della stanza con la posizione dei pannelli su pareti e soffitto">`;
    const faces = [['ceiling', r.L, r.W, 'Pianta · soffitto e pavimento'], ['left', r.L, r.H, 'Parete sinistra'], ['right', r.L, r.H, 'Parete destra'], ['front', r.W, r.H, 'Parete frontale'], ['back', r.W, r.H, 'Parete di fondo']];
    for (const [id, w, h] of faces) { const q = R({ face: id, u: 0, v: 0, w, h }); s += `<rect x="${q[0]}" y="${q[1]}" width="${q[2]}" height="${q[3]}" fill="var(--bg)" stroke="var(--ink-2)" stroke-width="${id === 'ceiling' ? 2 : 1}"/>`; }
    for (const q0 of lay.rects) {
      const q = R(q0), t = LTYPES[q0.type];
      s += `<rect x="${q[0].toFixed(1)}" y="${q[1].toFixed(1)}" width="${q[2].toFixed(1)}" height="${q[3].toFixed(1)}" rx="1.5" fill="var(${t[1]})" fill-opacity="${t[2]}" stroke="var(--panel)" stroke-width="1.5"${q0.type === 'carpet' ? ' stroke-dasharray="4 3"' : ''}/>`;
    }
    for (const d of lay.dots) { const q = R({ face: d.face, u: d.u, v: d.v }); s += `<circle cx="${q[0]}" cy="${q[1]}" r="4" fill="var(--s2)" stroke="var(--panel)" stroke-width="2"/>`; }
    const S = R({ face: 'floor', u: r.src[0], v: r.src[1] }), M = R({ face: 'floor', u: r.mic[0], v: r.mic[1] });
    s += `<circle cx="${S[0]}" cy="${S[1]}" r="5" fill="none" stroke="var(--ink)" stroke-width="2"/><text class="ink" x="${S[0] + 9}" y="${S[1] + 4}">S</text><rect x="${M[0] - 4}" y="${M[1] - 4}" width="8" height="8" fill="none" stroke="var(--ink)" stroke-width="2"/><text class="ink" x="${M[0] + 9}" y="${M[1] + 4}">M</text>`;
    for (const [id, w, h, name] of faces) {
      const q = R({ face: id, u: 0, v: 0, w, h });
      if (id === 'front' || id === 'back') s += `<text transform="translate(${id === 'front' ? q[0] - 6 : q[0] + q[2] + 14},${q[1] + q[3] / 2}) rotate(-90)" text-anchor="middle">${name}</text>`;
      else if (id !== 'ceiling') s += `<text x="${q[0] + q[2] / 2}" y="${id === 'right' ? q[1] - 6 : q[1] + q[3] + 14}" text-anchor="middle">${name}</text>`;
    }
    el.innerHTML = s + '</svg>';
    const usedTypes = Object.keys(LTYPES).filter((k) => lay.rects.some((q) => q.type === k));
    $('#layout-legend').innerHTML = usedTypes.map((k) => `<span><i class="sw" style="background:var(${LTYPES[k][1]});opacity:${LTYPES[k][2]}"></i>${LTYPES[k][0]}</span>`).join('') +
      '<span><i class="sw" style="background:var(--s2);border-radius:50%;width:10px"></i>Punto di prima riflessione</span><span>S sorgente · M microfono · al centro la pianta</span>';
    $('#layout-table').innerHTML = lay.notes.length ? '<tr><th>Superficie</th><th>Cosa installare</th></tr>' + lay.notes.map((n) => `<tr><td><b>${n.face}</b></td><td>${esc(n.text)}</td></tr>`).join('') : '<tr><td>Nessun pannello da installare: definisci l\'intervento nella tabella qui sotto.</td></tr>';
    return lay;
  }
  function renderTreat() {
    const cur = current(), tm = targetMid(), tTar = AC.targetCurve(tm), after = AC.rtAfter(state.room, cur.t, state.treat.areas), tot = totals();
    const use = AC.USES.find((u) => u.id === state.use);
    if (document.activeElement !== $('#target')) $('#target').value = tm.toFixed(2);
    $('#target-note').textContent = state.target ? 'Valore impostato a mano.' : `Riferimento: ${use.ref}, per un volume di ${f(geo().V, 0)} m³. Tolleranza ±20%.`;
    const nMeas = cur.fromMeas.filter(Boolean).length;
    $('#base-note').textContent = !state.meas || !nMeas ? 'stato attuale: modello dei materiali' : nMeas === 6 ? 'stato attuale: ' + state.meas.label.toLowerCase() : `stato attuale: misura in ${nMeas} bande, modello nelle altre`;
    const pts = (arr) => arr.map((v, i) => [i, v]), ymax = Math.ceil(Math.max(...cur.t, ...tTar.map((v) => v * 1.2)) * 5) / 5 + 0.2, yt = [];
    for (let v = 0; v <= ymax + 1e-9; v += ymax > 2 ? 0.5 : 0.2) yt.push(Math.round(v * 10) / 10);
    drawChart($('#rt-chart'), {
      label: 'Tempo di riverbero per banda: attuale, obiettivo e dopo l\'intervento', h: 280, unit: 's', dec: 2,
      x: { min: -0.3, max: 5.3, title: 'Banda d\'ottava', ticks: AC.BANDS.map((b, i) => ({ v: i, l: bandLabel(b) })), fmt: (x) => bandLabel(AC.BANDS[Math.round(x)]) },
      y: { min: 0, max: yt[yt.length - 1], title: 'RT60 (s)', ticks: yt },
      area: { name: 'Tolleranza ±20%', color: '--s2', hi: pts(tTar.map((v) => v * 1.2)), lo: pts(tTar.map((v) => v * 0.8)) },
      series: [{ name: 'Attuale', color: '--s1', pts: pts(cur.t), dots: true }, { name: 'Obiettivo', color: '--s2', pts: pts(tTar), dash: true }, { name: 'Dopo l\'intervento', color: '--s3', pts: pts(after), dots: true }],
    });
    $('#rt-table').innerHTML = '<tr><th>Banda</th>' + AC.BANDS.map((b) => `<th class="n">${bandLabel(b)}</th>`).join('') + '</tr>' +
      '<tr><td>Attuale (s)</td>' + cur.t.map((t) => `<td class="n">${f(t)}</td>`).join('') + '</tr>' +
      '<tr><td>Obiettivo (s)</td>' + tTar.map((t) => `<td class="n">${f(t)}</td>`).join('') + '</tr>' +
      '<tr><td>Dopo l\'intervento (s)</td>' + after.map((t) => `<td class="n">${f(t)}</td>`).join('') + '</tr>';
    $('#tot-area').textContent = f(tot.area, 1); $('#tot-cnt').textContent = tot.cnt || '—'; $('#tot-cost').textContent = Math.round(tot.cost).toLocaleString('it-IT') + ' €';
    const ok = after.every((t, b) => t <= tTar[b] * 1.2 && t >= tTar[b] * 0.8 * (b ? 1 : 0.8));
    const tile = (label, val, unit, sub) => `<div class="tile"><span>${label}</span><b>${val}<small>${unit}</small></b><em>${sub}</em></div>`;
    $('#treat-tiles').innerHTML = tile('RT60 attuale', f(mid(cur.t)), 's', '500–1000 Hz') + tile('RT60 dopo l\'intervento', f(mid(after)), 's', ok ? 'entro l\'obiettivo di ' + f(tm) + ' s' : mid(after) > tm ? 'sopra l\'obiettivo di ' + f(tm) + ' s' : 'sotto l\'obiettivo di ' + f(tm) + ' s').replace('class="tile"', 'class="tile ' + (ok ? 'ok' : 'bad') + '"') +
      tile('Superficie trattata', f(tot.area, 1), 'm²', `${tot.cnt} pannelli 120 × 60 cm`) + tile('Costo materiali', Math.round(tot.cost).toLocaleString('it-IT'), '€', 'prezzi indicativi, posa esclusa');
    const adv = advice(cur, after, tTar, tot);
    $('#advice').innerHTML = adv.map((a) => `<li>${a}</li>`).join('');
    return { cur, tTar, after, tot, adv, tm, lay: renderLayout() };
  }

  /* ---------- Fase 4: report ---------- */
  function renderReport(t) {
    const r = state.room, g = geo(), m = state.meas;
    const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    let s = `<dl class="kv">${state.client ? row('Cliente', esc(state.client)) : ''}${state.project ? row('Ambiente', esc(state.project)) : ''}${row('Data', new Date().toLocaleDateString('it-IT'))}${row('Dimensioni', `${f(r.L)} × ${f(r.W)} × ${f(r.H)} m`)}${row('Volume e superficie', `${f(g.V, 1)} m³ · ${f(g.S, 1)} m²`)}` +
      AC.SURFACES.map((x) => row(x.name, AC.MATERIALS[r.mats[x.id]].name)).join('') + row('Vetrate e porte', `${f(r.windows, 1)} m² · ${f(r.doors, 1)} m²`) +
      row('Destinazione d\'uso', AC.USES.find((u) => u.id === state.use).name) + row('RT60 obiettivo', f(t.tm) + ' s a 500–1000 Hz') +
      (state.scan ? row('Scansione', `${state.scan.vertices.toLocaleString('it-IT')} vertici`) : '') + '</dl>';
    if (m) {
      const res = m.res, refl = AC.matchReflections(res.reflections, r);
      s += `<div><h3>Misura · ${esc(m.label)}</h3><dl class="kv">${row('RT60 a 500–1000 Hz', f(res.rtMid) + ' s')}${row('EDT', f(res.edtMid) + ' s')}${row('C50 / D50', f(res.c50, 1) + ' dB / ' + f(res.d50 * 100, 0) + ' %')}${row('Dinamica', f(res.broad.inr, 0) + ' dB')}${row('Microfono', esc(micLabel()))}` +
        row('Riflessioni rilevate', refl.length ? refl.map((x) => `${f(x.ms, 1)} ms (${f(x.dB, 0)} dB${x.surface ? ', ' + surfName(x.surface).toLowerCase() : ''})`).join(' · ') : 'nessuna') +
        row('Echi', refl.some((x) => x.kind === 'eco') ? refl.filter((x) => x.kind === 'eco').map((x) => f(x.ms, 0) + ' ms').join(', ') : 'nessuno') + row('Flutter echo', res.flutter ? `periodo ${f(res.flutter.periodMs, 0)} ms` : 'non rilevato') + '</dl></div>';
    }
    s += '<div><h3>Tempo di riverbero per banda</h3><div class="scroll">' + $('#rt-table').outerHTML.replace('id="rt-table"', '') + '</div></div>';
    const used = AC.PRODUCTS.filter((p) => state.treat.areas[p.id] > 0);
    s += '<div><h3>Intervento</h3>' + (used.length ? '<div class="scroll"><table><tr><th>Prodotto</th><th>Posa</th><th class="n">Superficie</th><th class="n">Costo</th></tr>' +
      used.map((p) => `<tr><td>${esc(p.name)}</td><td>${WHERE[p.where]}</td><td class="n">${f(state.treat.areas[p.id], 1)} m²</td><td class="n">${Math.round(state.treat.areas[p.id] * (state.treat.prices[p.id] || p.price)).toLocaleString('it-IT')} €</td></tr>`).join('') +
      `<tr><td><b>Totale</b></td><td></td><td class="n">${f(t.tot.area, 1)} m²</td><td class="n">${Math.round(t.tot.cost).toLocaleString('it-IT')} €</td></tr></table></div>` : '<p class="note">Nessun intervento definito.</p>') + '</div>';
    s += `<div><h3>Dove installare i pannelli</h3><div class="chart">${$('#layout').innerHTML}</div><div class="scroll">${$('#layout-table').outerHTML.replace('id="layout-table"', '')}</div><ul class="advice">${t.adv.map((a) => `<li>${a}</li>`).join('')}</ul></div>`;
    if (state.photos.length) s += '<div><h3>Foto</h3><div class="photos">' + state.photos.map((p) => `<figure><img src="${p.url}" alt=""><figcaption class="note">${esc(p.caption)}</figcaption></figure>`).join('') + '</div></div>';
    s += '<p class="note">Coefficienti di assorbimento e prezzi sono valori tipici: verifica le schede tecniche dei prodotti scelti. Le misure con microfono non calibrato hanno valore indicativo e non sostituiscono un collaudo secondo UNI EN ISO 3382.</p>';
    s += `<div class="sign"><b>${SIGN_NAME}</b>per ${SIGN_ORG}</div>`;
    $('#report-body').innerHTML = s;
  }

  let lastT = null;
  function autoPropose() {
    if (state.touched.manual) return;
    state.treat.areas = AC.propose(state.room, current().t, AC.targetCurve(targetMid()), state.treat.enabled, state.treat.prices);
    for (const pr of AC.PRODUCTS) { const el = $('#ar-' + pr.id); if (el && document.activeElement !== el) el.value = state.treat.areas[pr.id] || 0; }
  }
  function renderAll() { save(); renderGuide(); renderRoom(); autoPropose(); render3D(); renderMic(); renderMeas(); renderLab(); lastT = renderTreat(); renderVerdict(lastT); renderReport(lastT); }

  /* ---------- Vista 3D ---------- */
  function draw3D(cv, withPanels) {
    const r = state.room, W = cv.clientWidth || 600, Hh = Math.round(Math.min(420, Math.max(240, W * 0.62))), dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = Hh * dpr; cv.style.height = Hh + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, Hh);
    const cs = getComputedStyle(document.documentElement), col = (n) => cs.getPropertyValue(n).trim();
    const cy = Math.cos(state.view.yaw), sy = Math.sin(state.view.yaw), cp = Math.cos(state.view.pitch), sp = Math.sin(state.view.pitch);
    const R = Math.hypot(r.L, r.W, r.H) / 2, sc = Math.min((W / 2 / R) * 0.9, (Hh / 2 / R) * 1.12);
    const pr = (x, y, z) => { x -= r.L / 2; y -= r.W / 2; z -= r.H / 2; const x1 = x * cy - y * sy, y1 = x * sy + y * cy, d = y1 * cp - z * sp, k = 1 / (1 + d / (R * 7)); return [W / 2 + x1 * sc * k, Hh / 2 - (y1 * sp + z * cp) * sc * k]; };
    const N = { front: [-1, 0, 0], back: [1, 0, 0], left: [0, -1, 0], right: [0, 1, 0], floor: [0, 0, -1], ceiling: [0, 0, 1] };
    const far = (id) => { const n = N[id]; return (n[0] * sy + n[1] * cy) * cp - n[2] * sp > 0; };
    const P3 = (face, u, v) => ({ left: [u, 0, v], right: [u, r.W, v], front: [0, u, v], back: [r.L, u, v], ceiling: [u, v, r.H], floor: [u, v, 0] }[face]);
    const quad = (face, u, v, w, h) => [[u, v], [u + w, v], [u + w, v + h], [u, v + h]].map((q) => pr.apply(null, P3(face, q[0], q[1])));
    const path = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };
    const dims = { left: [r.L, r.H], right: [r.L, r.H], front: [r.W, r.H], back: [r.W, r.H], floor: [r.L, r.W], ceiling: [r.L, r.W] };
    const names = { left: 'Parete sinistra', right: 'Parete destra', front: 'Parete frontale', back: 'Parete di fondo' };
    ctx.lineJoin = 'round'; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
    for (const id of Object.keys(N)) {
      const q = quad(id, 0, 0, dims[id][0], dims[id][1]); path(q);
      if (far(id)) { ctx.globalAlpha = id === 'floor' ? 1 : 0.6; ctx.fillStyle = col('--panel'); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.strokeStyle = col('--ink-2'); ctx.lineWidth = far(id) ? 1.5 : 0.6; ctx.stroke();
    }
    if (state.scan && state.scan.cloud) { ctx.fillStyle = col('--muted'); ctx.globalAlpha = 0.55; for (const p of state.scan.cloud) { const q = pr(p[0], p[1], p[2]); ctx.fillRect(q[0], q[1], 1.6, 1.6); } ctx.globalAlpha = 1; }
    if (withPanels) {
      for (const q0 of AC.layout(r, state.treat.areas).rects) {
        const face = q0.face, t = LTYPES[q0.type]; path(quad(face, q0.u, q0.v, q0.w, q0.h));
        if (far(face)) { ctx.globalAlpha = t[2]; ctx.fillStyle = col(t[1]); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = col('--panel'); ctx.lineWidth = 1; ctx.stroke(); }
        else { ctx.strokeStyle = col(t[1]); ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); }
      }
    }
    ctx.fillStyle = col('--muted');
    for (const id of Object.keys(names)) if (far(id)) { const q = pr.apply(null, P3(id, dims[id][0] / 2, r.H)); ctx.fillText(names[id], q[0], q[1] - 6); }
    const mark = (p, label, color, square) => {
      const a = pr(p[0], p[1], p[2]), b = pr(p[0], p[1], 0);
      ctx.strokeStyle = col('--muted'); ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col(color); ctx.strokeStyle = col('--panel'); ctx.lineWidth = 2; ctx.beginPath();
      if (square) ctx.rect(a[0] - 5, a[1] - 5, 10, 10); else ctx.arc(a[0], a[1], 6, 0, 7);
      ctx.fill(); ctx.stroke(); ctx.fillStyle = col('--ink'); ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.fillText(label, a[0], a[1] - 10);
    };
    mark(r.src, 'Sorgente', '--s1', false); mark(r.mic, 'Microfono', '--ink', true);
  }
  function render3D() {
    draw3D($('#view3d'), false); draw3D($('#view3d-b'), true);
    $('#v3d-note').textContent = state.scan ? `I punti grigi sono la scansione (${state.scan.vertices.toLocaleString('it-IT')} vertici); il riquadro è la stanza usata nei calcoli. Se non coincidono, correggi le dimensioni o cambia l'asse verticale.` : 'Stanza ricostruita dalle dimensioni inserite. Carica una scansione per sovrapporre i punti rilevati.';
  }
  function bind3D(cv) {
    let last = null;
    cv.addEventListener('pointerdown', (e) => { last = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      if (!last) return;
      state.view.yaw += (e.clientX - last[0]) * 0.01;
      if (e.pointerType === 'mouse') state.view.pitch = Math.min(1.45, Math.max(0.08, state.view.pitch + (e.clientY - last[1]) * 0.008));
      last = [e.clientX, e.clientY]; render3D();
    });
    const end = () => { last = null; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }

  /* ---------- Percorso guidato ---------- */
  const goStep = (id) => { const b = $(`.steps button[data-step="${id}"]`); if (b) b.click(); };
  function renderGuide() {
    const real = !!(state.meas && state.meas.real), done = { room: !!(state.scan || state.touched.dims), meas: real, treat: real && !!state.touched.seen, report: !!state.touched.pdf };
    $$('.steps button').forEach((b) => b.classList.toggle('done', !!done[b.dataset.step]));
  }
  function renderVerdict(t) {
    const real = state.meas && state.meas.real, use = AC.USES.find((u) => u.id === state.use).name.toLowerCase(), cur = mid(t.cur.t);
    const need = t.cur.t.some((v, b) => v > t.tTar[b] * 1.2);
    $('#verdict').innerHTML = (real ? '' : '<span class="tag">Esempio simulato</span> ') + `Riverbero ${real ? 'misurato' : 'stimato'}: <b>${f(cur)} s</b>. Per ${esc(use)} di ${f(geo().V, 0)} m³ l'obiettivo è <b>${f(t.tm)} s</b>. ` +
      (need ? `Servono circa <b>${f(t.tot.area, 0)} m²</b> di materiale fonoassorbente${t.tot.cnt ? ` (${t.tot.cnt} pannelli)` : ''}.` : 'La stanza è già entro l\'obiettivo.');
  }

  /* ---------- Analisi dettagliata ---------- */
  function renderLab() {
    const m = state.meas, r = state.room;
    const modes = AC.roomModes(r, 200), fs0 = AC.schroeder(r, mid(current().t));
    $('#modes-note').textContent = `frequenza di Schroeder ${f(fs0, 0)} Hz: sotto questa soglia dominano le risonanze`;
    $('#modes-table').innerHTML = '<tr><th class="n">Frequenza</th><th>Tipo</th><th>Direzione (lunghezza, larghezza, altezza)</th><th>Dove si accumula</th></tr>' +
      modes.slice(0, 14).map((x) => `<tr><td class="n">${f(x.f, 1)} Hz</td><td>${x.type}</td><td>${x.n.join(' · ')}</td><td>${x.type === 'assiale' ? (x.n[0] ? 'pareti frontale e di fondo' : x.n[1] ? 'pareti laterali' : 'pavimento e soffitto') : 'angoli e spigoli'}</td></tr>`).join('');
    if (!m) return;
    const res = m.res;
    if (!m._fr || m._frS !== state.frSmooth) { m._fr = AC.freqResponse(res.ir, res.fs, state.frSmooth); m._frS = state.frSmooth; }
    const abs = m.kind === 'sweep' && state.calibrated;
    let off = abs ? 20 * Math.log10(0.8 / Math.SQRT2) + state.cal : -Math.max.apply(null, m._fr.filter((q) => q[0] > 100 && q[0] < 10000).map((q) => q[1]));
    const pts = m._fr.map((q) => [q[0], q[1] + off]), top = Math.ceil(Math.max.apply(null, pts.map((q) => q[1])) / 10) * 10 + 10, yt = [];
    for (let v = top; v >= top - 70; v -= 10) yt.push(v);
    $('#fr-note').textContent = (abs ? 'Livello al microfono durante lo sweep, calibrato sul fonometro di riferimento.' : m.kind === 'sweep' ? 'Curva in dB relativi al massimo. Per leggere i dB SPL calibra il microfono con il fonometro in fondo a questa pagina.' : 'Misura a impulso: curva in dB relativi al massimo. Per i dB SPL serve la misura con lo sweep e il microfono calibrato.') + ' Le linee tratteggiate sono i modi assiali della stanza.';
    drawChart($('#fr-chart'), {
      label: 'Risposta in frequenza', h: 300, unit: abs ? 'dB SPL' : 'dB',
      x: { log: true, min: 20, max: Math.min(20000, res.fs / 2.2), title: 'Frequenza (Hz)', ticks: [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter((v) => v <= res.fs / 2.2).map((v) => ({ v, l: v >= 1000 ? v / 1000 + 'k' : String(v) })), fmt: (x) => f(x, 0) + ' Hz' },
      y: { min: top - 70, max: top, title: abs ? 'SPL (dB)' : 'Livello (dB)', ticks: yt },
      series: [{ name: abs ? 'SPL' : 'Livello', color: '--s1', pts }], vlines: modes.filter((x) => x.type === 'assiale').map((x) => x.f),
    });
    if (!m._sp) m._sp = AC.spectrogram(res.ir, res.fs, res.i0, Math.min(0.8, Math.max(0.25, res.broad.tc)));
    const cv = $('#waterfall'), W = cv.clientWidth || 640, H = 280, dpr = window.devicePixelRatio || 1, sp = m._sp, ml = 46, mb = 24;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d'), cs = getComputedStyle(document.documentElement); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const nb = sp.edges.length - 1, cw = (W - ml - 8) / nb, chh = (H - mb - 8) / sp.z.length;
    ctx.fillStyle = cs.getPropertyValue('--s1').trim();
    sp.z.forEach((row, t) => row.forEach((v, b) => { const a = Math.max(0, Math.min(1, (v + 60) / 60)); if (a > 0.02) { ctx.globalAlpha = a; ctx.fillRect(ml + b * cw, 8 + t * chh, cw + 0.6, chh + 0.6); } }));
    ctx.globalAlpha = 1; ctx.fillStyle = cs.getPropertyValue('--muted').trim(); ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
    const f0 = sp.edges[0], f1 = sp.edges[nb];
    for (const v of [100, 200, 500, 1000, 2000, 5000, 10000]) if (v < f1) ctx.fillText(v >= 1000 ? v / 1000 + 'k' : v, ml + (Math.log(v / f0) / Math.log(f1 / f0)) * (W - ml - 8), H - 7);
    ctx.textAlign = 'right';
    for (let ms = 0; ms <= sp.z.length * sp.dt * 1000; ms += 100) ctx.fillText(ms + ' ms', ml - 6, 12 + (ms / 1000 / sp.dt) * chh);
  }

  /* ---------- Fonometro e analizzatore in tempo reale ---------- */
  let spl = null, splRaw = null;
  const splTiles = (a, eq, mx, z) => { const t = (l, v, sub) => `<div class="tile"><span>${l}</span><b>${v != null && v < 0 ? '—' : v}<small>dB</small></b><em>${sub}</em></div>`; $('#spl-tiles').innerHTML = t('Livello attuale', a < 0 ? '—' : f(a, 1), 'ponderazione A') + t('Leq', f(eq, 1), 'media dall\'avvio, A') + t('Massimo', f(mx, 1), 'ponderazione A') + t('Lineare', z < 0 ? '—' : f(z, 1), 'senza ponderazione'); };
  function drawRta(bands) {
    const cv = $('#rta'), W = cv.clientWidth || 640, H = 220, dpr = window.devicePixelRatio || 1, cs = getComputedStyle(document.documentElement);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const ml = 36, mb = 22, top = 100, bot = 10, bw = (W - ml - 8) / bands.length, Y = (v) => 8 + ((top - Math.max(bot, Math.min(top, v))) / (top - bot)) * (H - mb - 8);
    ctx.font = '11px Inter, system-ui, sans-serif'; ctx.strokeStyle = cs.getPropertyValue('--line').trim(); ctx.fillStyle = cs.getPropertyValue('--muted').trim(); ctx.textAlign = 'right';
    for (let v = 20; v <= 100; v += 20) { ctx.beginPath(); ctx.moveTo(ml, Y(v)); ctx.lineTo(W - 8, Y(v)); ctx.stroke(); ctx.fillText(v, ml - 6, Y(v) + 4); }
    ctx.textAlign = 'center';
    AC.THIRDS.forEach((fc, i) => { if (i % 3 === 1) ctx.fillText(fc >= 1000 ? Math.round(fc / 100) / 10 + 'k' : Math.round(fc), ml + (i + 0.5) * bw, H - 7); });
    ctx.fillStyle = cs.getPropertyValue('--s1').trim();
    bands.forEach((v, i) => { const y = Y(v); ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(ml + i * bw + 1, y, Math.max(1, bw - 2), H - mb - y, [3, 3, 0, 0]); else ctx.rect(ml + i * bw + 1, y, Math.max(1, bw - 2), H - mb - y); ctx.fill(); });
  }
  async function toggleSpl() {
    const btn = $('#btn-spl'), note = $('#spl-note');
    if (spl) { clearInterval(spl.timer); spl.stream.getTracks().forEach((t) => t.stop()); spl.ctx.close(); spl = null; btn.textContent = 'Avvia'; return; }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nomic');
      const stream = await navigator.mediaDevices.getUserMedia(micConstraints());
      listInputs();
      const ctx = new (window.AudioContext || window.webkitAudioContext)(); await ctx.resume();
      const an = ctx.createAnalyser(); an.fftSize = 8192; an.smoothingTimeConstant = 0; ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.frequencyBinCount), df = ctx.sampleRate / an.fftSize, aw = Array.from(buf, (_, k) => Math.pow(10, AC.aWeight(Math.max(1, k * df)) / 10));
      let eSum = 0, n = 0, mx = -Infinity;
      const tick = () => {
        an.getFloatFrequencyData(buf);
        let pa = 0, pz = 0; const bands = new Float64Array(AC.THIRDS.length);
        for (let k = 1; k < buf.length; k++) { const fq = k * df; if (fq < 20 || fq > 20000) continue; const pw = Math.pow(10, buf[k] / 10); pz += pw; pa += pw * aw[k]; const bi = Math.round(10 * Math.log10(fq)) - 14; if (bi >= 0 && bi < bands.length) bands[bi] += pw; }
        splRaw = 10 * Math.log10(pa + 1e-30); const la = splRaw + state.cal; eSum += Math.pow(10, la / 10); n++; mx = Math.max(mx, la);
        splTiles(la, 10 * Math.log10(eSum / n), mx, 10 * Math.log10(pz + 1e-30) + state.cal);
        drawRta(Array.from(bands, (v) => 10 * Math.log10(v + 1e-30) + state.cal));
      };
      spl = { stream, ctx, timer: setInterval(tick, 150) }; btn.textContent = 'Ferma';
      note.textContent = state.calibrated ? 'Fonometro calibrato sul riferimento inserito.' : 'Non calibrato: i valori sono indicativi. Per calibrare, leggi il livello su un fonometro vero mentre c\'è un rumore costante, scrivilo qui sotto e premi «Calibra».';
    } catch (e) { note.textContent = 'Il microfono non è accessibile da questa pagina: il fonometro funziona nella versione dell\'app aperta da un indirizzo https.'; }
  }

  /* ---------- Misura: acquisizione ---------- */
  const status = (msg, err) => { const el = $('#meas-status'); el.hidden = !msg; el.textContent = msg || ''; el.classList.toggle('err', !!err); };
  const busy = (b) => { $$('#s-meas .btnrow button.btn').forEach((x) => { x.disabled = b; }); $('#audio-file').disabled = b; };
  const later = (fn) => new Promise((res, rej) => setTimeout(() => { try { res(fn()); } catch (e) { rej(e); } }, 40));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const micConstraints = () => ({ audio: Object.assign({ echoCancellation: false, noiseSuppression: false, autoGainControl: false }, state.inputId ? { deviceId: { exact: state.inputId } } : {}) });
  async function listInputs() {
    const sel = $('#dev-in');
    if (window.claude || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) { $('#dev-row').hidden = true; return; }
    try {
      const ins = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications');
      sel.innerHTML = '<option value="">Predefinito del sistema</option>' + ins.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || 'Microfono ' + (i + 1) + ' (consenti il microfono per vedere il nome)')}</option>`).join('');
      if (state.inputId && !ins.some((d) => d.deviceId === state.inputId)) state.inputId = '';
      sel.value = state.inputId;
    } catch (e) { /* elenco non disponibile */ }
  }
  window.__buildPdf = () => buildPdf();
  function setMeas(res, label, extra, kind) {
    state.meas = { res, label, real: true, kind }; state.touched.manual = false;
    const tail = extra ? ' ' + extra : '';
    if (res.broad.inr < 25) status('Segnale troppo debole rispetto al rumore di fondo: alza il volume, avvicina la sorgente o ripeti in silenzio.' + tail, true);
    else if (res.bands.some((b) => !b.rt)) status('Misura acquisita. Nelle bande senza dinamica sufficiente il calcolo dell\'intervento usa il modello dei materiali.' + tail);
    else status('Misura acquisita e analizzata.' + tail);
    renderAll();
    if (res.broad.inr >= 25) goStep('treat');
  }
  // archivio delle registrazioni nel browser (IndexedDB)
  let recs = [];
  const idbDo = async (mode, fn) => {
    try {
      const db = await new Promise((res, rej) => { const q = indexedDB.open('rilievo-acustico', 1); q.onupgradeneeded = () => q.result.createObjectStore('rec', { keyPath: 'id' }); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
      return await new Promise((res, rej) => { const tx = db.transaction('rec', mode), rq = fn(tx.objectStore('rec')); tx.oncomplete = () => res(rq && rq.result); tx.onerror = () => rej(tx.error); });
    } catch (e) { return null; }
  };
  const RECKIND = { sweep: 'Sweep di test', impulse: 'Impulso', file: 'File caricato' };
  function renderRecs() {
    $('#rec-wrap').hidden = !recs.length;
    $('#rec-table').innerHTML = '<tr><th>Registrazioni salvate</th><th>Tipo</th><th class="n">Durata</th><th></th></tr>' + recs.map((x) => `<tr><td>${esc(x.name)}</td><td>${RECKIND[x.kind]}</td><td class="n">${f(x.data.length / x.fs, 1)} s</td><td class="n"><button class="btn sm" data-rec="an" data-id="${x.id}">Analizza</button> <button class="btn sm" data-rec="dl" data-id="${x.id}"${window.claude ? ' hidden' : ''}>Scarica WAV</button> <button class="btn sm" data-rec="rm" data-id="${x.id}">Elimina</button></td></tr>`).join('');
  }
  async function keepRec(kind, data, fs, name) {
    const rec = { id: Date.now(), kind, fs, name, data };
    recs.unshift(rec); renderRecs(); await idbDo('readwrite', (s) => s.put(rec));
    return rec;
  }
  function saveWav(rec) {
    if (window.claude) return false;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([AC.encodeWav(rec.data, rec.fs)], { type: 'audio/wav' })); a.download = rec.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return true;
  }
  async function analyzeRec(rec, extra) {
    status('Analisi di ' + rec.name + '…');
    const out = await later(() => {
      if (rec.kind === 'sweep') return { res: AC.analyze(Float32Array.from(AC.deconvolve(rec.data, AC.testSweep(rec.fs))), rec.fs), label: 'Sweep misurato', kind: 'sweep' };
      if (rec.kind === 'impulse') return { res: AC.analyze(rec.data, rec.fs), label: 'Impulso misurato' };
      const a = AC.autoIR(rec.data, rec.fs);
      return { res: AC.analyze(a.ir, rec.fs), label: (a.kind === 'sweep' ? 'Sweep da file' : 'Impulso da file'), kind: a.kind };
    });
    setMeas(out.res, out.label, extra, out.kind);
  }
  const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
  async function record(seconds, withSweep, msg) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nomic');
    const stream = await navigator.mediaDevices.getUserMedia(micConstraints());
    listInputs();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
    for (let n = 3; n > 0; n--) { status(`La registrazione parte tra ${n}…`); await wait(1000); }
    const src = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(4096, 1, 1), mute = ctx.createGain(), chunks = [];
    mute.gain.value = 0;
    proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
    if (withSweep) {
      const sweep = AC.testSweep(ctx.sampleRate), buf = ctx.createBuffer(1, sweep.length, ctx.sampleRate); buf.getChannelData(0).set(sweep);
      const node = ctx.createBufferSource(); node.buffer = buf; node.connect(ctx.destination); node.start(ctx.currentTime + 0.5);
    }
    const t0 = Date.now();
    while (Date.now() - t0 < seconds * 1000) { status(`${msg} ${Math.ceil(seconds - (Date.now() - t0) / 1000)} s`); await wait(250); }
    proc.disconnect(); src.disconnect(); stream.getTracks().forEach((t) => t.stop());
    const fs = ctx.sampleRate; ctx.close();
    const data = new Float32Array(chunks.reduce((n, c) => n + c.length, 0)); let o = 0;
    for (const c of chunks) { data.set(c, o); o += c.length; }
    return { data, fs };
  }
  const micError = (e) => status(e && (e.message === 'nomic' || e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'NotFoundError')
    ? 'Il microfono non è accessibile: consenti l\'uso del microfono quando il browser lo chiede. Se la pagina non è aperta da un indirizzo https, il browser lo blocca.'
    : 'Misura non riuscita: ' + (e && e.message ? e.message : 'errore sconosciuto') + '.', true);
  async function doMeasure(kind) {
    busy(true);
    try {
      const rec = await record(kind === 'sweep' ? 7.5 : 6, kind === 'sweep', kind === 'sweep' ? 'Registrazione in corso, suoni di test in riproduzione: resta in silenzio.' : 'Registrazione in corso: batti le mani una volta sola o fai scoppiare un palloncino, poi silenzio.');
      const kept = await keepRec(kind, rec.data, rec.fs, `misura-${kind === 'sweep' ? 'sweep' : 'impulso'}-${stamp()}.wav`);
      const saved = saveWav(kept);
      await analyzeRec(kept, saved ? `File salvato sul dispositivo: ${kept.name}.` : '');
    } catch (e) { micError(e); }
    busy(false);
  }
  async function doPlay() {
    busy(true);
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)(); await ctx.resume();
      const sweep = AC.testSweep(ctx.sampleRate), buf = ctx.createBuffer(1, sweep.length, ctx.sampleRate); buf.getChannelData(0).set(sweep);
      const node = ctx.createBufferSource(); node.buffer = buf; node.connect(ctx.destination); node.start(ctx.currentTime + 1);
      for (let n = 8; n > 0; n--) { status(`Suoni di test in riproduzione: resta in silenzio e non fermare la registrazione per altri ${n} s.`); await wait(1000); }
      ctx.close(); status('Riproduzione terminata. Questa pagina non registra: ferma la registrazione fatta con l\'altro dispositivo o l\'altra app e scegli il file nel riquadro «Carica audio o video».');
    } catch (e) { status('Riproduzione non riuscita: ' + e.message, true); }
    busy(false);
  }
  async function doFile(file) {
    busy(true); status('Decodifica di ' + file.name + '…');
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = await ctx.decodeAudioData(await file.arrayBuffer()); ctx.close();
      const data = new Float32Array(buf.length);
      for (let c = 0; c < buf.numberOfChannels; c++) { const ch = buf.getChannelData(c); for (let i = 0; i < data.length; i++) data[i] += ch[i] / buf.numberOfChannels; }
      const rec = { id: Date.now(), kind: 'file', fs: buf.sampleRate, name: file.name, data };
      if (data.length <= 60 * buf.sampleRate) await keepRec('file', data, buf.sampleRate, file.name);
      await analyzeRec(rec);
    } catch (e) { status('Non riesco a leggere l\'audio di questo file. Prova con WAV, MP3, M4A o MP4.', true); }
    busy(false);
  }
  function doDemo(first) {
    state.meas = { res: AC.analyze(AC.synthIR(state.room, 48000, 11), 48000), label: 'Esempio simulato' };
    if (!first) { status('Risposta simulata dalla geometria e dai materiali inseriti: non è una misura reale.'); renderAll(); }
  }

  /* ---------- PDF per il cliente ---------- */
  const RGB = { '--s1': [42, 120, 214], '--s2': [235, 104, 52], '--s3': [27, 175, 122], '--crit': [208, 59, 59] };
  const P = (s) => String(s).replace(/<[^>]+>/g, '').replace(/[–—]/g, '-').replace(/€/g, 'EUR').replace(/…/g, '...').replace(/[‘’]/g, "'").replace(/[^\x00-\xff]/g, '');
  const toJpeg = (url) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { const k = Math.min(1, 1200 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res({ data: c.toDataURL('image/jpeg', 0.8), w: c.width, h: c.height }); };
    im.onerror = () => res(null); im.src = url;
  });
  async function buildPdf() {
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), PW = 210, PH = 297, M = 16, CW = PW - 2 * M;
    const r = state.room, g = geo(), t = lastT, m = state.meas, today = new Date().toLocaleDateString('it-IT');
    let y = M;
    const need = (h) => { if (y + h > PH - 20) { doc.addPage(); y = M; } };
    const font = (b, size, col) => { doc.setFont('helvetica', b ? 'bold' : 'normal'); doc.setFontSize(size); const c = col || [16, 24, 28]; doc.setTextColor(c[0], c[1], c[2]); };
    const h2 = (txt) => { need(18); y += 4; doc.setFillColor(14, 96, 115); doc.rect(M, y - 0.4, 2.4, 4.4, 'F'); font(true, 11.5, [11, 53, 64]); doc.text(P(txt), M + 5, y + 3.3); doc.setDrawColor(219, 225, 228); doc.setLineWidth(0.2); doc.line(M, y + 6, PW - M, y + 6); y += 10; };
    const para = (txt, size, col) => { font(false, size || 9.5, col); for (const ln of doc.splitTextToSize(P(txt), CW)) { need(4.6); doc.text(ln, M, y + 3.2); y += 4.6; } y += 1.2; };
    const table = (rows, widths, o) => {
      o = o || {};
      rows.forEach((row, ri) => {
        const head = o.head !== false && ri === 0;
        font(head || (o.boldLast && ri === rows.length - 1) || (o.boldFirst && false), head ? 7.5 : 9, head ? [123, 134, 141] : null);
        const cells = row.map((c, i) => doc.splitTextToSize(P(head ? String(c).toUpperCase() : c), widths[i] * CW - 3));
        const h = Math.max.apply(null, cells.map((c) => c.length)) * 4.2 + 2.4; need(h);
        if (!head && ri % 2 === (o.head === false ? 0 : 1)) { doc.setFillColor(246, 248, 249); doc.rect(M, y, CW, h, 'F'); }
        let x = M;
        cells.forEach((c, i) => { const right = (o.right || []).includes(i); if (o.keyCol && i === 0 && !head) font(false, 9, [71, 84, 92]); else if (!head) font(o.boldLast && ri === rows.length - 1, 9); doc.text(c, right ? x + widths[i] * CW - 1.5 : x + 1.5, y + 4.2, { align: right ? 'right' : 'left' }); x += widths[i] * CW; });
        y += h; if (head) { doc.setDrawColor(150); doc.setLineWidth(0.2); doc.line(M, y, PW - M, y); }
      });
      y += 3;
    };
    const kv = (pairs) => table(pairs, [0.34, 0.66], { head: false, keyCol: true });
    const chart = (o, h) => {
      need(h + 4);
      const x0 = M + 11, x1 = PW - M - 2, y0 = y + 6, y1 = y + h - 9;
      const tx = o.x.log ? Math.log : (v) => v, X = (v) => x0 + ((tx(v) - tx(o.x.min)) / (tx(o.x.max) - tx(o.x.min))) * (x1 - x0), Y = (v) => y0 + ((o.y.max - Math.max(o.y.min, Math.min(o.y.max, v))) / (o.y.max - o.y.min)) * (y1 - y0);
      font(false, 7, [123, 134, 141]); doc.setLineWidth(0.1);
      for (const k of o.y.ticks) { doc.setDrawColor(226); doc.line(x0, Y(k), x1, Y(k)); doc.text(String(k).replace('.', ','), x0 - 1.5, Y(k) + 1, { align: 'right' }); }
      for (const k of o.x.ticks) { doc.text(P(k.l), X(k.v), y1 + 4, { align: 'center' }); if (o.x.log) { doc.setDrawColor(226); doc.line(X(k.v), y0, X(k.v), y1); } }
      doc.text(P(o.x.title), (x0 + x1) / 2, y1 + 8, { align: 'center' }); doc.text(P(o.y.title), M, y + 2.5);
      let lx = M + 34;
      if (o.series.length > 1) for (const q of o.series) { const c = RGB[q.color]; doc.setFillColor(c[0], c[1], c[2]); doc.rect(lx, y + 1, 4, 1, 'F'); doc.text(P(q.name), lx + 5.5, y + 2.5); lx += 9 + doc.getTextWidth(P(q.name)); }
      if (o.area) {
        const pts = o.area.hi.concat(o.area.lo.slice().reverse()).map((p) => [X(p[0]), Y(p[1])]), rel = [];
        for (let i = 1; i < pts.length; i++) rel.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
        doc.setFillColor(252, 228, 218); doc.lines(rel, pts[0][0], pts[0][1], [1, 1], 'F', true);
        doc.rect(lx, y + 0.5, 4, 2.2, 'F'); doc.text(P(o.area.name), lx + 5.5, y + 2.5);
      }
      for (const q of o.series) {
        const c = RGB[q.color]; doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(0.45); doc.setLineDashPattern(q.dash ? [1.6, 1.1] : [], 0);
        const pts = q.pts.filter((p) => p[0] >= o.x.min && p[0] <= o.x.max).map((p) => [X(p[0]), Y(p[1])]);
        for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
        doc.setLineDashPattern([], 0);
        if (q.dots) { doc.setFillColor(c[0], c[1], c[2]); pts.forEach((p) => doc.circle(p[0], p[1], 0.9, 'F')); }
      }
      font(true, 7);
      for (const k of o.marks || []) { if (k.x > o.x.max) continue; const c = RGB[k.color], cy = Math.max(y0 + 3, Y(k.y)); doc.setFillColor(c[0], c[1], c[2]); doc.circle(X(k.x), cy, 0.9, 'F'); doc.text(P(k.label), X(k.x), cy - 1.8, { align: 'center' }); }
      y += h + 2;
    };

    // intestazione: fascia di marca
    doc.setFillColor(11, 53, 64); doc.rect(0, 0, PW, 34, 'F');
    doc.setFillColor(127, 208, 222); doc.roundedRect(M, 9, 14, 14, 2.5, 2.5, 'F');
    doc.setFillColor(11, 53, 64); [[2.6, 5.6, 2.6], [4.7, 3.6, 6.6], [6.8, 2, 10], [8.9, 4.4, 5], [11, 6, 1.8]].forEach((b) => doc.roundedRect(M + b[0], 9 + b[1], 1.2, b[2], 0.6, 0.6, 'F'));
    font(true, 19, [242, 247, 248]); doc.text(P(SIGN_ORG).toUpperCase(), M + 19, 16.5);
    font(false, 9, [159, 195, 204]); doc.text(P(SIGN_NAME), M + 19, 22);
    font(true, 15, [242, 247, 248]); doc.text('Relazione acustica', PW - M, 16.5, { align: 'right' });
    font(false, 9, [159, 195, 204]); doc.text([state.client, state.project, today].filter(Boolean).map(P).join('  ·  '), PW - M, 22, { align: 'right' });
    y = 42;
    // sintesi in quattro riquadri
    const okAfter = t.after.every((v, b) => v <= t.tTar[b] * 1.2);
    const boxes = [['RT60 attuale', f(mid(t.cur.t)) + ' s', state.meas && state.meas.real ? 'misurato, 500-1000 Hz' : 'stimato, 500-1000 Hz'], ['RT60 obiettivo', f(t.tm) + ' s', AC.USES.find((u) => u.id === state.use).name],
      ['RT60 dopo l\'intervento', f(mid(t.after)) + ' s', okAfter ? 'entro la tolleranza' : 'da verificare'], ['Materiale', f(t.tot.area, 1) + ' m²', `${t.tot.cnt} pannelli · ${Math.round(t.tot.cost).toLocaleString('it-IT')} EUR`]];
    const bwd = (CW - 9) / 4;
    boxes.forEach((b, k) => {
      const x = M + k * (bwd + 3);
      doc.setFillColor(238, 242, 243); doc.roundedRect(x, y, bwd, 23, 2, 2, 'F');
      if (k === 2) { doc.setFillColor(okAfter ? 27 : 235, okAfter ? 175 : 104, okAfter ? 122 : 52); doc.rect(x, y + 2, 1.2, 19, 'F'); }
      font(false, 7.5, [69, 82, 90]); doc.text(P(b[0]).toUpperCase(), x + 4, y + 6);
      font(true, 16); doc.text(P(b[1]), x + 4, y + 14.5);
      font(false, 7.5, [123, 134, 141]); doc.text(doc.splitTextToSize(P(b[2]), bwd - 6)[0], x + 4, y + 19.5);
    });
    y += 29;

    h2('Ambiente');
    kv([['Dimensioni', `${f(r.L)} × ${f(r.W)} × ${f(r.H)} m`], ['Volume e superficie', `${f(g.V, 1)} m³ · ${f(g.S, 1)} m²`]]
      .concat(AC.SURFACES.map((x) => [x.name, AC.MATERIALS[r.mats[x.id]].name]))
      .concat([['Vetrate e porte', `${f(r.windows, 1)} m² · ${f(r.doors, 1)} m²`], ['Destinazione d\'uso', AC.USES.find((u) => u.id === state.use).name], ['RT60 obiettivo', f(t.tm) + ' s a 500-1000 Hz']]));

    if (m) {
      const res = m.res, refl = AC.matchReflections(res.reflections, r);
      h2('Misura');
      kv([['Metodo', m.label], ['Microfono', micLabel()], ['Posizione microfono (x; y; z)', r.mic.map((v) => f(v)).join('; ') + ' m'], ['Posizione sorgente (x; y; z)', r.src.map((v) => f(v)).join('; ') + ' m'],
        ['RT60 a 500-1000 Hz', f(res.rtMid) + ' s'], ['EDT', f(res.edtMid) + ' s'], ['C50 / D50', f(res.c50, 1) + ' dB / ' + f(res.d50 * 100, 0) + ' %'], ['Dinamica', f(res.broad.inr, 0) + ' dB'],
        ['Flutter echo', res.flutter ? `periodo ${f(res.flutter.periodMs, 0)} ms` : 'non rilevato']]);
      if ($('#fr-chart')._opts) { need(88); h2('Risposta in frequenza'); chart($('#fr-chart')._opts, 62); para($('#fr-note').textContent, 8.5, [71, 84, 92]); }
      need(95); h2('Riflessioni ed echi');
      chart($('#etc-chart')._opts, 62);
      if (refl.length) table([['N.', 'Ritardo', 'Livello', 'Percorso in più', 'Superficie probabile', 'Valutazione']].concat(refl.map((x, i) => [i + 1, f(x.ms, 1) + ' ms', f(x.dB, 1) + ' dB', f(x.extra) + ' m', x.surface ? surfName(x.surface) : 'secondo ordine o arredo', KIND[x.kind][0]])), [0.07, 0.14, 0.14, 0.17, 0.26, 0.22], { right: [0, 1, 2, 3] });
      else para('Nessuna riflessione isolata emerge dal decadimento.');
    }

    need(100); h2('Tempo di riverbero per banda');
    chart($('#rt-chart')._opts, 66);
    const bw = [0.28].concat(AC.BANDS.map(() => 0.12));
    table([['Banda'].concat(AC.BANDS.map(bandLabel)), ['Attuale (s)'].concat(t.cur.t.map((v) => f(v))), ['Obiettivo (s)'].concat(t.tTar.map((v) => f(v))), ['Dopo l\'intervento (s)'].concat(t.after.map((v) => f(v)))], bw, { right: [1, 2, 3, 4, 5, 6] });

    h2('Intervento proposto');
    const used = AC.PRODUCTS.filter((p) => state.treat.areas[p.id] > 0);
    if (used.length) {
      table([['Prodotto', 'Posa', 'Superficie', 'Costo']].concat(used.map((p) => [p.name, WHERE[p.where], f(state.treat.areas[p.id], 1) + ' m²', Math.round(state.treat.areas[p.id] * (state.treat.prices[p.id] || p.price)).toLocaleString('it-IT') + ' EUR']))
        .concat([['Totale', '', f(t.tot.area, 1) + ' m²', Math.round(t.tot.cost).toLocaleString('it-IT') + ' EUR']]), [0.52, 0.16, 0.16, 0.16], { right: [2, 3], boldLast: true });
      para(`RT60 a 500-1000 Hz: da ${f(mid(t.cur.t))} s a ${f(mid(t.after))} s (obiettivo ${f(t.tm)} s). Prezzi dei materiali indicativi, posa esclusa.`, 9, [71, 84, 92]);

      need(150); h2('Dove installare i pannelli');
      const tw = r.L + 2 * r.H, th = r.W + 2 * r.H, sc = Math.min((CW - 12) / tw, 105 / th), ox = M + (CW - tw * sc) / 2;
      need(th * sc + 20); const oy = y + 5;
      const R = (q) => { const u = AC.unfold(r, q); return [ox + u[0] * sc, oy + u[1] * sc, u[2] * sc, u[3] * sc]; };
      const faces = [['ceiling', r.L, r.W, 'Pianta: soffitto e pavimento'], ['left', r.L, r.H, 'Parete sinistra'], ['right', r.L, r.H, 'Parete destra'], ['front', r.W, r.H, 'Parete frontale'], ['back', r.W, r.H, 'Parete di fondo']];
      doc.setLineWidth(0.25); doc.setDrawColor(71, 84, 92); doc.setFillColor(244, 246, 247);
      for (const fc of faces) { const q = R({ face: fc[0], u: 0, v: 0, w: fc[1], h: fc[2] }); doc.rect(q[0], q[1], q[2], q[3], 'FD'); }
      const FILL = { panel: [27, 175, 122], ceil: [42, 120, 214], trap: [16, 24, 28], curtain: [247, 195, 174], carpet: [205, 210, 213] };
      doc.setDrawColor(255); doc.setLineWidth(0.2);
      for (const q0 of t.lay.rects) { const q = R(q0), c = FILL[q0.type]; doc.setFillColor(c[0], c[1], c[2]); doc.rect(q[0], q[1], q[2], q[3], 'FD'); }
      doc.setFillColor(235, 104, 52);
      for (const d of t.lay.dots) { const q = R({ face: d.face, u: d.u, v: d.v }); doc.circle(q[0], q[1], 0.9, 'F'); }
      font(true, 7);
      const S = R({ face: 'floor', u: r.src[0], v: r.src[1] }), Mi = R({ face: 'floor', u: r.mic[0], v: r.mic[1] });
      doc.setDrawColor(16, 24, 28); doc.setLineWidth(0.4); doc.circle(S[0], S[1], 1.1, 'S'); doc.text('S', S[0] + 2, S[1] + 1); doc.rect(Mi[0] - 1, Mi[1] - 1, 2, 2, 'S'); doc.text('M', Mi[0] + 2, Mi[1] + 1);
      font(false, 7, [71, 84, 92]);
      for (const fc of faces) {
        const q = R({ face: fc[0], u: 0, v: 0, w: fc[1], h: fc[2] });
        if (fc[0] === 'front' || fc[0] === 'back') doc.text(fc[3], fc[0] === 'front' ? q[0] - 1.5 : q[0] + q[2] + 3.5, q[1] + q[3] / 2 + doc.getTextWidth(fc[3]) / 2, { angle: 90 });
        else if (fc[0] !== 'ceiling') doc.text(fc[3], q[0] + q[2] / 2, fc[0] === 'right' ? q[1] - 1.5 : q[1] + q[3] + 3.5, { align: 'center' });
      }
      y = oy + th * sc + 7;
      let lx = M; font(false, 7.5, [71, 84, 92]);
      const lg = (c, name, dot) => { doc.setFillColor(c[0], c[1], c[2]); if (dot) doc.circle(lx + 1.2, y + 1.4, 0.9, 'F'); else doc.rect(lx, y + 0.3, 3.5, 2.2, 'F'); doc.text(name, lx + 5, y + 2.4); lx += 8 + doc.getTextWidth(name); };
      Object.keys(FILL).filter((k) => t.lay.rects.some((q) => q.type === k)).forEach((k) => lg(FILL[k], LTYPES[k][0]));
      lg([235, 104, 52], 'Punto di prima riflessione', true); doc.text('S sorgente, M microfono, al centro la pianta', lx, y + 2.4);
      y += 7;
      if (t.lay.notes.length) table([['Superficie', 'Cosa installare']].concat(t.lay.notes.map((n) => [n.face, n.text])), [0.22, 0.78]);
    } else para('Nessun intervento definito.');
    for (const a of t.adv) para('- ' + a, 9);

    if (state.photos.length) {
      h2('Foto dell\'ambiente');
      const imgs = (await Promise.all(state.photos.map((p) => toJpeg(p.url)))).map((im, i) => im && { im, cap: state.photos[i].caption }).filter(Boolean), w = (CW - 6) / 2;
      for (let i = 0; i < imgs.length; i += 2) {
        const pair = imgs.slice(i, i + 2), hs = pair.map((q) => Math.min(70, (w * q.im.h) / q.im.w)), hmax = Math.max.apply(null, hs);
        need(hmax + 8);
        pair.forEach((q, j) => { const x = M + j * (w + 6); doc.addImage(q.im.data, 'JPEG', x, y, (hs[j] * q.im.w) / q.im.h, hs[j]); font(false, 8, [71, 84, 92]); if (q.cap) doc.text(P(q.cap), x, y + hs[j] + 4); });
        y += hmax + 8;
      }
    }

    h2('Note');
    para('Coefficienti di assorbimento e prezzi sono valori tipici: vanno verificati sulle schede tecniche dei prodotti scelti. Le misure eseguite con microfono non calibrato hanno valore indicativo e non sostituiscono un collaudo secondo UNI EN ISO 3382.', 8.5, [71, 84, 92]);

    // firma
    need(34); y += 10;
    font(false, 9, [71, 84, 92]); doc.text('Data: ' + today, M, y + 14); doc.text('Il tecnico', PW - M - 35, y, { align: 'center' });
    doc.setDrawColor(16, 24, 28); doc.setLineWidth(0.3); doc.line(PW - M - 70, y + 14, PW - M, y + 14);
    font(true, 11); doc.text(P(SIGN_NAME), PW - M - 35, y + 19.5, { align: 'center' });
    font(false, 9, [71, 84, 92]); doc.text('per ' + P(SIGN_ORG), PW - M - 35, y + 24, { align: 'center' });

    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); font(false, 7.5, [123, 134, 141]); doc.text(`${P(SIGN_ORG)} · ${P(SIGN_NAME)}`, M, PH - 9); doc.text(`Pagina ${i} di ${n}`, PW - M, PH - 9, { align: 'right' }); }
    return doc;
  }
  async function downloadPdf() {
    const st = $('#pdf-status'), say = (msg, err) => { st.hidden = !msg; st.textContent = msg || ''; st.classList.toggle('err', !!err); };
    if (!window.jspdf) return say('La libreria per creare il PDF non è stata caricata: controlla la connessione e ricarica la pagina.', true);
    say('Preparazione del PDF…');
    try {
      const doc = await buildPdf(), name = 'Relazione acustica' + (state.client ? ' - ' + state.client.replace(/[\\/:*?"<>|]/g, '') : '') + '.pdf';
      if (window.claude) {
        const dl = await window.claude.use('downloads');
        if (!dl) return say('Il download non è disponibile in questa vista.', true);
        await dl.save({ filename: name, data: doc.output('blob') });
      } else doc.save(name);
      say('PDF scaricato: ' + name); state.touched.pdf = true; renderGuide(); save();
    } catch (e) { say(e && e.code === 'declined' ? 'Download annullato.' : 'Non è stato possibile creare il PDF' + (e && e.message ? ': ' + e.message : '') + '.', true); }
  }

  /* ---------- Eventi ---------- */
  function init() {
    $('#mats').innerHTML = AC.SURFACES.map((s) => `<label>${s.name}<select id="mat-${s.id}" data-mat="${s.id}">${Object.keys(AC.MATERIALS).map((k) => `<option value="${k}">${AC.MATERIALS[k].name}</option>`).join('')}</select></label>`).join('');
    $('#use').innerHTML = AC.USES.map((u) => `<option value="${u.id}">${u.name}</option>`).join('');
    $('#decay-band').innerHTML = '<option value="-1">Banda larga</option>' + AC.BANDS.map((b, i) => `<option value="${i}">${bandLabel(b)}</option>`).join('');
    { const opt = (m) => `<option value="${m.id}">${m.name}</option>`; $('#mic-type').innerHTML = `<optgroup label="Microfoni di misura">${AC.MICS.filter((m) => m.group).map(opt).join('')}</optgroup><optgroup label="Microfoni integrati e generici">${AC.MICS.filter((m) => !m.group).map(opt).join('')}</optgroup>`; }
    $('#mic-type').value = state.mic.type; $('#mic-model').value = state.mic.model; $('#rep-client').value = state.client; $('#rep-project').value = state.project;
    $('#preset').innerHTML += AC.PRESETS.map((x) => `<option value="${x.id}">${x.name}</option>`).join('');
    bind3D($('#view3d')); bind3D($('#view3d-b'));
    const fill = () => {
      $$('[data-k]').forEach((i) => { i.value = state.room[i.dataset.k]; });
      $$('[data-mat]').forEach((i) => { i.value = state.room.mats[i.dataset.mat]; });
      $$('[data-pos]').forEach((i) => { const [a, b] = i.dataset.pos.split('.'); i.value = state.room[a][b]; });
      $('#use').value = state.use; $('#decay-band').value = state.decayBand; $('#etc-range').value = state.etcRange;
    };
    fill(); buildProducts();
    const clampPos = () => { const r = state.room, d = [r.L, r.W, r.H]; for (const k of ['src', 'mic']) r[k] = r[k].map((v, i) => Math.min(d[i] - 0.05, Math.max(0.05, v))); };
    document.addEventListener('input', (ev) => {
      const t = ev.target, v = parseFloat(t.value);
      if (t.dataset.k) { if (!(v >= 0) || (['L', 'W', 'H'].includes(t.dataset.k) && v < 1)) return; state.room[t.dataset.k] = v; clampPos(); state.touched[['L', 'W', 'H'].includes(t.dataset.k) ? 'dims' : 'mats'] = true; }
      else if (t.dataset.pos) { if (!(v >= 0)) return; const [a, b] = t.dataset.pos.split('.'); state.room[a][b] = v; clampPos(); state.touched.pos = true; }
      else if (t.dataset.price) state.treat.prices[t.dataset.price] = v >= 0 ? v : 0;
      else if (t.dataset.area) { state.treat.areas[t.dataset.area] = v >= 0 ? v : 0; state.touched.manual = true; }
      else if (t.dataset.cap != null) { state.photos[+t.dataset.cap].caption = t.value; return; }
      else if (t.id === 'target') state.target = v >= 0.15 ? v : null;
      else if (t.id === 'mic-model') state.mic.model = t.value;
      else if (t.id === 'rep-client') state.client = t.value;
      else if (t.id === 'rep-project') state.project = t.value;
      else return;
      renderAll();
    });
    document.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.dataset.mat) { state.room.mats[t.dataset.mat] = t.value; state.touched.mats = true; }
      else if (t.id === 'preset') { const pz = AC.PRESETS.find((x) => x.id === t.value); if (!pz) return; state.room.mats = Object.assign({}, pz.mats); state.touched.mats = true; fill(); }
      else if (t.dataset.en) state.treat.enabled[t.dataset.en] = t.checked;
      else if (t.id === 'use') { state.use = t.value; state.target = null; }
      else if (t.id === 'mic-type') state.mic.type = t.value;
      else if (t.id === 'dev-in') { state.inputId = t.value; save(); return; }
      else if (t.id === 'etc-range') state.etcRange = +t.value;
      else if (t.id === 'fr-smooth') state.frSmooth = +t.value;
      else if (t.id === 'decay-band') state.decayBand = +t.value;
      else if (t.id === 'photo-file') { for (const file of t.files) state.photos.push({ url: URL.createObjectURL(file), caption: '' }); t.value = ''; }
      else if (t.id === 'audio-file') { if (t.files[0]) doFile(t.files[0]); t.value = ''; return; }
      else if (t.id === 'scan-file' || t.id === 'scan-up') {
        const file = $('#scan-file').files[0], info = $('#scan-info');
        if (!file) return;
        const read = /\.zip$/i.test(file.name)
          ? (window.JSZip ? window.JSZip.loadAsync(file).then((z) => { const e = Object.values(z.files).find((x) => /\.obj$/i.test(x.name) && !/__MACOSX/.test(x.name)); if (!e) throw new Error('Nello ZIP non c\'è nessun file OBJ.'); return e.async('string'); }) : Promise.reject(new Error('Lettore ZIP non caricato.')))
          : file.text();
        info.hidden = false; info.textContent = 'Lettura della scansione…';
        read.then((txt) => {
          const sc = AC.parseOBJ(txt, $('#scan-up').value);
          state.scan = sc; Object.assign(state.room, { L: sc.L, W: sc.W, H: sc.H }); Object.assign(state.room, AC.recommendPositions(state.room)); state.touched.dims = true;
          fill();
          info.textContent = `${file.name}: ${sc.vertices.toLocaleString('it-IT')} vertici. Stanza rilevata: ${f(sc.L)} × ${f(sc.W)} × ${f(sc.H)} m` + (sc.meshVolume > 0.5 * sc.L * sc.W * sc.H && sc.meshVolume < 1.2 * sc.L * sc.W * sc.H ? `, volume della mesh ${f(sc.meshVolume, 1)} m³` : '') + '. Confronta con la vista 3D: se la scansione include altri locali o oggetti esterni, correggi le misure a mano.';
          renderAll();
        }).catch((e) => { info.hidden = false; info.textContent = 'Scansione non leggibile: ' + e.message + ' Esporta in OBJ, con unità in metri.'; });
        return;
      } else return;
      renderAll();
    });
    $$('.steps button').forEach((b) => b.addEventListener('click', () => {
      $$('.steps button').forEach((x) => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
      if (b.dataset.step === 'treat') state.touched.seen = true;
      if (b.dataset.step !== 'lab' && spl) toggleSpl();
      window.scrollTo(0, 0);
      $$('.step').forEach((sec) => { sec.hidden = sec.id !== 's-' + b.dataset.step; });
      renderAll();
    }));
    $('#btn-sweep').addEventListener('click', () => doMeasure('sweep'));
    $('#btn-clap').addEventListener('click', () => doMeasure('impulse'));
    $('#btn-play').addEventListener('click', doPlay);
    document.addEventListener('click', (ev) => {
      const g = ev.target.closest('[data-go]'); if (g) return goStep(g.dataset.go);
      const b = ev.target.closest('[data-rec]'); if (!b) return;
      const rec = recs.find((x) => String(x.id) === b.dataset.id); if (!rec) return;
      if (b.dataset.rec === 'an') analyzeRec(rec).catch((e) => status('Analisi non riuscita: ' + e.message, true));
      else if (b.dataset.rec === 'dl') saveWav(rec);
      else { recs = recs.filter((x) => x !== rec); renderRecs(); idbDo('readwrite', (st) => st.delete(rec.id)); }
    });
    idbDo('readonly', (st) => st.getAll()).then((all) => { recs = (all || []).sort((a, b) => b.id - a.id); renderRecs(); });
    const fb = $('#btn-file');
    ['dragenter', 'dragover'].forEach((n) => fb.addEventListener(n, (e) => { e.preventDefault(); fb.classList.add('drop'); }));
    ['dragleave', 'drop'].forEach((n) => fb.addEventListener(n, (e) => { e.preventDefault(); fb.classList.remove('drop'); }));
    fb.addEventListener('drop', (e) => { const file = e.dataTransfer && e.dataTransfer.files[0]; if (file) doFile(file); });
    $('#btn-demo').addEventListener('click', () => doDemo(false));
    $('#btn-propose').addEventListener('click', () => {
      state.treat.areas = AC.propose(state.room, current().t, AC.targetCurve(targetMid()), state.treat.enabled, state.treat.prices);
      state.touched.manual = false; syncProducts(); renderAll();
    });
    $('#btn-recpos').addEventListener('click', () => { Object.assign(state.room, AC.recommendPositions(state.room)); state.touched.pos = true; fill(); renderAll(); });
    $('#btn-pdf').addEventListener('click', downloadPdf);
    $('#btn-spl').addEventListener('click', toggleSpl);
    listInputs(); if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', listInputs);
    $('#btn-cal').addEventListener('click', () => {
      const ref = parseFloat($('#cal-ref').value), note = $('#spl-note');
      if (!spl || splRaw == null || splRaw < -110) { note.textContent = 'Avvia prima il fonometro, poi calibra mentre c\'è un rumore costante.'; return; }
      if (!(ref > 20 && ref < 130)) { note.textContent = 'Scrivi il livello letto sul fonometro di riferimento, in dBA.'; return; }
      state.cal = ref - splRaw; state.calibrated = true; note.textContent = 'Calibrato: da ora i livelli sono riferiti al fonometro.'; save(); renderLab();
    });
    $$('details').forEach((d) => d.addEventListener('toggle', () => renderAll()));
    splTiles(null, null, null, null); drawRta(AC.THIRDS.map(() => 0));
    if (window.claude) { // pagina pubblicata: niente microfono dal vivo
      $('#live-note').hidden = false; $('#btn-sweep').hidden = true; $('#btn-clap').hidden = true; $('#btn-play').hidden = false;
    }
    let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderAll, 150); });
    doDemo(true);
    syncProducts(); renderAll();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
