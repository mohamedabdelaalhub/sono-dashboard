/* ============================================================
   charts.js — رسوم SVG خفيفة بلا مكتبات خارجية
   ============================================================ */
(function (root) {
'use strict';
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- التلميح ---------- */
let tip;
function ensureTip() { if (!tip) { tip = document.getElementById('tip'); } return tip; }
function showTip(e, html) {
  const t = ensureTip(); if (!t) return;
  t.innerHTML = html; t.style.opacity = 1;
  const p = 16, w = t.offsetWidth, h = t.offsetHeight;
  let x = e.clientX + p, y = e.clientY + p;
  if (x + w > innerWidth - 8) x = e.clientX - w - p;
  if (y + h > innerHeight - 8) y = e.clientY - h - p;
  t.style.left = x + 'px'; t.style.top = y + 'px';
}
function hideTip() { const t = ensureTip(); if (t) t.style.opacity = 0; }

/* ============================================================
   شريط حركة الخزينة: الوارد فوق الخط، المنصرف تحته، والرصيد خط متقطع
   ============================================================ */
function ribbon(el, data, opts) {
  opts = opts || {};
  if (!data.length) { el.innerHTML = '<p class="note">لا توجد بيانات.</p>'; return; }
  const W = 1160, H = 300, PT = 18, PB = 28, mid = PT + (H - PT - PB) * 0.60;
  const maxI = Math.max(...data.map(d => d.inc), 1);
  const maxO = Math.max(...data.map(d => d.out), 1);
  const upH = mid - PT - 6, dnH = H - PB - mid - 6;
  const n = data.length, step = W / n, bw = Math.min(step * 0.62, 46);
  let bars = '', ticks = '', pts = [];
  let run = opts.opening || 0;
  const netMax = Math.max(Math.abs(run + data.reduce((s, d) => s + d.inc - d.out, 0)), 1);

  data.forEach((d, i) => {
    const cx = W - (i * step + step / 2), x = cx - bw / 2;   /* من اليمين لليسار */
    const hi = d.inc / maxI * upH, ho = d.out / maxO * dnH;
    bars += `<rect class="bar" data-i="${i}" x="${x}" y="${mid - hi}" width="${bw}" height="${hi}" rx="3" fill="var(--petrol)"/>`;
    if (ho > 0) bars += `<rect class="bar" data-i="${i}" x="${x}" y="${mid}" width="${bw}" height="${ho}" rx="3" fill="var(--clay)"/>`;
    bars += `<rect class="hit" data-i="${i}" x="${cx - step / 2}" y="${PT}" width="${step}" height="${H - PT - PB}" fill="transparent"/>`;
    if (n <= 40 || i % Math.ceil(n / 30) === 0)
      ticks += `<text class="tick" x="${cx}" y="${H - PB + 15}" text-anchor="middle">${esc(d.lab)}</text>`;
    run += d.inc - d.out;
    pts.push([cx, mid - (run / netMax) * upH * 0.9]);
  });
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="حركة الخزينة">
    <line class="axis" x1="0" y1="${mid}" x2="${W}" y2="${mid}" stroke="var(--ink)" stroke-width="1.4"/>
    ${bars}<path class="netline" d="${path}"/>${ticks}</svg>`;

  const svg = el.querySelector('svg');
  svg.querySelectorAll('.hit').forEach(h => {
    h.addEventListener('mousemove', e => {
      const d = data[+h.dataset.i];
      svg.classList.add('dim');
      svg.querySelectorAll('.bar').forEach(b => b.classList.toggle('on', b.dataset.i === h.dataset.i));
      showTip(e, `<div class="t">${esc(d.full)}</div>
        الوارد <b>${fmt(d.inc)}</b><br>المنصرف <b>${fmt(d.out)}</b><br>
        الصافي <b>${fmt(d.inc - d.out)}</b>` +
        (d.rcpt !== undefined ? `<br>الإيصالات <b>${fmt(d.rcpt)}</b>` : '') +
        (d.pat !== undefined ? ` · المرضى <b>${fmt(d.pat)}</b>` : ''));
    });
    h.addEventListener('mouseleave', () => { svg.classList.remove('dim'); hideTip(); });
  });
}

/* ============================================================
   أشرطة أفقية
   ============================================================ */
function hbars(el, rows, opts) {
  opts = opts || {};
  if (!rows.length) { el.innerHTML = '<p class="note">لا توجد بيانات.</p>'; return; }
  const max = Math.max(...rows.map(r => r.value), 1);
  el.innerHTML = rows.map((r, i) => `
    <div class="hrow${opts.onClick ? ' hclick' : ''}" data-idx="${i}" title="${esc(r.title || r.label)}">
      <div class="nm">${esc(r.label)}</div>
      <div class="track"><div class="fill" style="width:${(r.value / max * 100).toFixed(1)}%;background:${r.color || 'var(--petrol)'}"></div></div>
      <div class="amt">${opts.raw ? fmt(r.value) : fmt(r.value)}${opts.suffix || ''}</div>
    </div>`).join('');
  /* اختياري بحت: لو مفيش onClick يفضل السلوك زي ما هو تماماً */
  if (opts.onClick) {
    el.querySelectorAll('.hrow').forEach(node => {
      node.addEventListener('click', () => opts.onClick(rows[+node.dataset.idx], +node.dataset.idx));
    });
  }
}

/* ============================================================
   دونات + مفتاح
   ============================================================ */
const PALETTE = ['var(--petrol)', 'var(--plum)', 'var(--amber)', 'var(--moss)', 'var(--clay)',
                 '#4A6D8C', '#8C6D4A', '#5E7180', '#3E8E7E', '#A65D8C'];
function donut(el, rows, opts) {
  opts = opts || {};
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const R = 74, r0 = 46, cx = 90, cy = 90;
  let a0 = -Math.PI / 2, arcs = '';
  rows.forEach((row, i) => {
    const a1 = a0 + (row.value / total) * Math.PI * 2;
    const big = (a1 - a0) > Math.PI ? 1 : 0;
    const p = (rr, a) => [(cx + rr * Math.cos(a)).toFixed(2), (cy + rr * Math.sin(a)).toFixed(2)];
    const [x1, y1] = p(R, a0), [x2, y2] = p(R, a1), [x3, y3] = p(r0, a1), [x4, y4] = p(r0, a0);
    arcs += `<path d="M${x1} ${y1} A${R} ${R} 0 ${big} 1 ${x2} ${y2} L${x3} ${y3} A${r0} ${r0} 0 ${big} 0 ${x4} ${y4} Z"
             fill="${row.color || PALETTE[i % PALETTE.length]}" data-i="${i}"/>`;
    a0 = a1;
  });
  el.innerHTML = `<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center">
    <svg viewBox="0 0 180 180" style="width:180px;flex:0 0 auto">${arcs}
      <text x="90" y="86" text-anchor="middle" class="tick" style="font-size:11px">الإجمالي</text>
      <text x="90" y="103" text-anchor="middle" style="font-family:'Hiragino Kaku','BigVesta Arabic',ui-monospace,monospace;font-size:14px;fill:var(--ink);font-weight:600">${fmt(total)}</text>
    </svg>
    <div style="flex:1;min-width:190px">${rows.map((row, i) => `
      <div class="dl"><i style="background:${row.color || PALETTE[i % PALETTE.length]}"></i>
        <span>${esc(row.label)}</span>
        <span class="p">${(row.value / total * 100).toFixed(1)}%</span>
        <span class="v">${fmt(row.value)}</span></div>`).join('')}</div></div>`;
}

/* ============================================================
   مقياس نصف دائري للنتيجة
   ============================================================ */
function gauge(el, score) {
  const R = 58, cx = 70, cy = 70, sw = 13;
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
  const a1 = a0 + span * (score / 100);
  const col = score >= 75 ? 'var(--moss)' : score >= 50 ? 'var(--amber)' : 'var(--clay)';
  const arc = (from, to, color, width) => {
    const big = (to - from) > Math.PI ? 1 : 0;
    const p = a => [(cx + R * Math.cos(a)).toFixed(2), (cy + R * Math.sin(a)).toFixed(2)];
    const [x1, y1] = p(from), [x2, y2] = p(to);
    return `<path d="M${x1} ${y1} A${R} ${R} 0 ${big} 1 ${x2} ${y2}" fill="none"
            stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  };
  el.innerHTML = `<svg viewBox="0 0 140 128" style="width:140px">
    ${arc(a0, a0 + span, 'var(--paper)', sw)}
    ${score > 0 ? arc(a0, a1, col, sw) : ''}
    <text x="70" y="76" text-anchor="middle" style="font-family:'Hiragino Kaku','BigVesta Arabic',ui-monospace,monospace;font-size:30px;font-weight:600;fill:${col}">${score}</text>
    <text x="70" y="94" text-anchor="middle" class="tick">من 100</text></svg>`;
}

/* ============================================================
   خط بسيط للاتجاه
   ============================================================ */
function sparkline(el, values, color) {
  if (!values.length) { el.innerHTML = ''; return; }
  const W = 240, H = 46, mx = Math.max(...values), mn = Math.min(...values);
  const rg = (mx - mn) || 1;
  const pts = values.map((v, i) => [
    (W * i / Math.max(values.length - 1, 1)).toFixed(1),
    (H - 4 - ((v - mn) / rg) * (H - 8)).toFixed(1)
  ]);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
    <polyline fill="none" stroke="${color || 'var(--petrol)'}" stroke-width="2"
      points="${pts.map(p => p.join(',')).join(' ')}"/></svg>`;
}

/* ============================================================
   خط اتجاه بمحاور — لاتجاه الإنفاق أو أي متسلسلة زمنية
   points: [{x:'2026-03-11', y:420, full:'...'}]
   ============================================================ */
function line(el, points, opts) {
  opts = opts || {};
  if (!points || !points.length) { el.innerHTML = '<p class="note">لا توجد بيانات.</p>'; return; }
  const W = 1160, H = 260, PL = 46, PR = 16, PT = 14, PB = 30;
  const iw = W - PL - PR, ih = H - PT - PB;
  const maxY = Math.max(...points.map(p => p.y), 1);
  const n = points.length;
  const xAt = i => PL + (n > 1 ? iw * i / (n - 1) : iw / 2);
  const yAt = v => PT + ih - (v / maxY) * ih;
  const pts = points.map((p, i) => [xAt(i), yAt(p.y)]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = path + ` L${pts[pts.length - 1][0].toFixed(1)} ${(PT + ih).toFixed(1)}` +
               ` L${pts[0][0].toFixed(1)} ${(PT + ih).toFixed(1)} Z`;
  const gridN = 4;
  let grid = '';
  for (let g = 0; g <= gridN; g++) {
    const y = PT + ih * g / gridN;
    grid += `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${W - PR}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
      <text class="tick" x="${PL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${fmt(maxY * (1 - g / gridN))}</text>`;
  }
  const step = Math.max(1, Math.ceil(n / 12));
  let ticks = '';
  points.forEach((p, i) => {
    if (i % step === 0 || i === n - 1)
      ticks += `<text class="tick" x="${xAt(i).toFixed(1)}" y="${H - PB + 16}" text-anchor="middle">${esc(p.x)}</text>`;
  });
  const dots = pts.map((p, i) => `<circle class="hit" data-i="${i}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="9" fill="transparent"/>
    <circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="${opts.color || 'var(--petrol)'}"/>`).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'اتجاه')}">
    ${grid}
    <path d="${area}" fill="${opts.color || 'var(--petrol)'}" opacity=".08"/>
    <path d="${path}" fill="none" stroke="${opts.color || 'var(--petrol)'}" stroke-width="2.2"/>
    ${dots}${ticks}</svg>`;
  const svg = el.querySelector('svg');
  svg.querySelectorAll('.hit').forEach(h => {
    h.addEventListener('mousemove', e => {
      const p = points[+h.dataset.i];
      showTip(e, `<div class="t">${esc(p.full || p.x)}</div>${esc(opts.label || 'القيمة')} <b>${fmt(p.y)}</b>`);
    });
    h.addEventListener('mouseleave', hideTip);
  });
}

/* ============================================================
   أعمدة متراكمة — لمقارنة عدة قيم على نفس الفئة (مثال: رسمي/فعلي)
   cats: ['يناير','فبراير']، series: [{label:'رسمي',color,values:[..]}, ...]
   ============================================================ */
function stackedBar(el, cats, series, opts) {
  opts = opts || {};
  if (!cats || !cats.length || !series || !series.length) { el.innerHTML = '<p class="note">لا توجد بيانات.</p>'; return; }
  const W = 1160, H = 280, PT = 14, PB = 34, PL = 46, PR = 16;
  const iw = W - PL - PR, ih = H - PT - PB;
  const totals = cats.map((c, i) => series.reduce((s, sr) => s + (sr.values[i] || 0), 0));
  const maxT = Math.max(...totals, 1);
  const n = cats.length, step = iw / n, bw = Math.min(step * 0.56, 64);
  let bars = '', ticks = '';
  cats.forEach((c, i) => {
    const cx = PL + step * i + step / 2;
    let y = PT + ih;
    series.forEach((sr, si) => {
      const v = sr.values[i] || 0;
      const h = (v / maxT) * ih;
      y -= h;
      bars += `<rect class="hit" data-i="${i}" data-s="${si}" x="${(cx - bw / 2).toFixed(1)}" y="${y.toFixed(1)}"
        width="${bw.toFixed(1)}" height="${Math.max(h, 0).toFixed(1)}" rx="3" fill="${sr.color || PALETTE[si % PALETTE.length]}"/>`;
    });
    ticks += `<text class="tick" x="${cx.toFixed(1)}" y="${H - PB + 16}" text-anchor="middle">${esc(c)}</text>`;
  });
  const legend = series.map((sr, si) => `<div class="dl"><i style="background:${sr.color || PALETTE[si % PALETTE.length]}"></i><span>${esc(sr.label)}</span></div>`).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img">
    <line x1="${PL}" y1="${PT + ih}" x2="${W - PR}" y2="${PT + ih}" stroke="var(--ink)" stroke-width="1.2"/>
    ${bars}${ticks}</svg>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px">${legend}</div>`;
  const svg = el.querySelector('svg');
  svg.querySelectorAll('.hit').forEach(h => {
    h.addEventListener('mousemove', e => {
      const i = +h.dataset.i, si = +h.dataset.s, sr = series[si];
      showTip(e, `<div class="t">${esc(cats[i])} — ${esc(sr.label)}</div>القيمة <b>${fmt(sr.values[i] || 0)}</b>`);
    });
    h.addEventListener('mouseleave', hideTip);
  });
}

root.SonoCharts = { ribbon, hbars, donut, gauge, sparkline, line, stackedBar, PALETTE, showTip, hideTip, fmt, esc };
})(window);
