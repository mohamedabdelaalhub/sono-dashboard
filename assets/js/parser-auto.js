/* ============================================================
   parser-auto.js — محرك قراءة عام مدفوع بسجل التعريفات
   يكتشف نوع التقرير، يجد صف الترويسة (ولو مزدوجاً)،
   يطابق الأعمدة، ويستخرج الصفوف متجاوزاً صفوف الإجمالي.
   ============================================================ */
(function (root) {
'use strict';
const P = () => root.SonoParser;
const REG = () => root.SonoReports;

const TOTAL_RE = /^(الاجمال[يى]?|المجموع|اجمال[يى])\s*$/;

function norm(v) { return P().normAr(v).replace(/[:：]/g, '').trim(); }

/* هل الخلية تطابق أحد أسماء العمود؟ */
function matchKey(cell, cols) {
  const t = norm(cell);
  if (!t) return null;
  for (const k in cols) if (cols[k].some(a => norm(a) === t)) return k;
  return null;
}

/* يبني خريطة أعمدة من صف (مع دمج صف تحته إن كان ترويسة فرعية) */
function mapRow(row, next, cols) {
  const map = {}, hits = new Set();
  const put = (arr) => (arr || []).forEach((c, i) => {
    const k = matchKey(c, cols);
    if (k && map[k] === undefined) { map[k] = i; hits.add(k); }
  });
  put(row);
  const before = hits.size;
  if (next) put(next);
  return { map, hits: hits.size, gained: hits.size - before };
}

/* ============================================================
   الكشف: يجرّب كل تعريف ويعيد الأفضل
   ============================================================ */
const IS_TREASURY = rows => {
  const head = rows.slice(0, 14).map(r => (r || []).map(c => norm(c)).join('|')).join('|');
  return /(^|\|)الوارد(\||$)/.test(head) && /(^|\|)المنصرف(\||$)/.test(head);
};

function detect(rows, fileName) {
  if (IS_TREASURY(rows)) return null;      /* يتولاه SonoParser */
  const head = rows.slice(0, 12).map(r => (r || []).map(c => norm(c)).join(' ')).join(' ');
  const fn = norm(String(fileName || '').replace(/\.\w+$/, ''));
  let best = null;

  REG().list.forEach(def => {
    /* ١) وزن العنوان: كلمة من title في ترويسة الورقة أو اسم الملف */
    const titleHit = (def.title || []).some(t => head.includes(norm(t))) ? 2 : 0;
    const fileHit  = (def.title || []).some(t => fn.includes(norm(t))) ||
                     fn.includes(norm(def.id)) ? 1 : 0;

    /* ٢) ابحث عن أفضل صف ترويسة */
    for (let r = 0; r < Math.min(rows.length, 40); r++) {
      const a = mapRow(rows[r], rows[r + 1], def.cols);
      if (!a.hits) continue;
      const merged = a.gained > 0;
      const need = def.need || [];
      const ok = need.every(k => a.map[k] !== undefined);
      if (!ok) continue;
      /* أعمدة مانعة: وجودها يعني أنه تقرير آخر */
      if ((def.deny || []).some(k => a.map[k] !== undefined)) continue;
      const score = a.hits + titleHit * 12 + fileHit * 8;
      if (ok && (!best || score > best.score))
        best = { def, hdrRow: r, dataRow: r + (merged ? 2 : 1), map: a.map, score, hits: a.hits };
    }
  });
  return best;
}

/* ============================================================
   الاستخراج
   ============================================================ */
function extract(rows, found) {
  const { def, map, dataRow } = found;
  const out = [];
  /* أسماء الأعمدة — لتجاهل صفوف الترويسة المتكررة في التقارير متعددة الأقسام */
  const headNames = new Set();
  Object.keys(def.cols).forEach(k => def.cols[k].forEach(a => headNames.add(norm(a))));
  const numKeys = ['qty','price','discount','tax','total','net','gross','amount','cost',
                   'balance','debit','credit','revenue','expense','paid','remaining',
                   'collected','due','clients','fees','docAmount','docPct','used','left','avail',
                   'value','svcValue','remainValue','remainAmount','pkgRemainValue','pkgUsed',
                   'pkgLeft','pkgAvail','received','min','reorder','runout','price'];
  const dateKeys = ['date','birth'];

  for (let r = dataRow; r < rows.length; r++) {
    const row = rows[r] || [];
    if (!row.some(c => c !== null && String(c).trim())) continue;

    /* تجاوز صفوف الإجمالي والتوقيعات */
    const cells = row.map(c => norm(c));
    if (cells.some(c => TOTAL_RE.test(c))) continue;
    if (cells.some(c => /^توقيع|^يعتمد/.test(c))) continue;
    /* صف ترويسة مكرر */
    const namedCells = cells.filter(c => c && headNames.has(c)).length;
    if (namedCells >= 2) continue;

    const rec = { _row: r };
    let filled = 0;
    for (const k in map) {
      const raw = row[map[k]];
      if (raw === null || raw === undefined || String(raw).trim() === '') { rec[k] = null; continue; }
      if (numKeys.includes(k)) rec[k] = P().toNum(raw);
      else if (dateKeys.includes(k)) { const d = P().parseDate(raw); rec[k] = d ? P().iso(d) : P().cleanAr(raw); }
      else rec[k] = P().cleanAr(raw);
      if (rec[k] !== null && rec[k] !== '') filled++;
    }
    const hasNeed = (def.need || []).some(k => rec[k] !== null && rec[k] !== '' && rec[k] !== undefined);
    if (hasNeed || filled >= 2) out.push(rec);
  }

  /* الخلايا المدمجة تترك فراغات في أعمدة التجميع — نملؤها من الصف السابق */
  const FILL = ['date', 'doctor', 'patient', 'fileNo', 'store', 'group', 'branch',
                'specialty', 'insurer', 'channel', 'center', 'account'];
  const fill = FILL.filter(k => map[k] !== undefined);
  const last = {};
  out.forEach(rec => fill.forEach(k => {
    if (rec[k] === null || rec[k] === '' || rec[k] === undefined) {
      if (last[k] !== undefined) rec[k] = last[k];
    } else last[k] = rec[k];
  }));
  return out;
}

/* الفترة من ترويسة الورقة */
function findPeriod(rows) {
  let from = null, to = null;
  for (let r = 0; r < Math.min(rows.length, 14); r++) {
    const row = rows[r] || [];
    for (let i = 0; i < row.length; i++) {
      const t = norm(row[i]);
      if (t !== 'من' && t !== 'الي' && t !== 'الى') continue;
      let d = null;
      for (let j = i - 1; j >= Math.max(0, i - 10) && !d; j--) d = P().parseDate(row[j]);
      for (let j = i + 1; j <= Math.min(row.length - 1, i + 10) && !d; j++) d = P().parseDate(row[j]);
      if (d) { if (t === 'من') from = from || d; else to = to || d; }
    }
  }
  return { from, to };
}

/* ============================================================
   الواجهة: اقرأ مصنّفاً كاملاً
   ============================================================ */
/* يقرأ كل الشيتات داخل المصنّف ويعيد مصفوفة بكل التقارير المتطابقة
   (شيت لكل تقرير مختلف — مش أول تطابق بس) */
function parseAll(wb, fileName) {
  const out = [];
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    if (!rows.length) continue;
    const found = detect(rows, fileName);
    if (!found) continue;
    const data = extract(rows, found);
    if (!data.length && !found.def.allowEmpty) continue;
    out.push({
      id: found.def.id, name: found.def.name, group: found.def.group,
      info: found.def.info, rows: data, period: findPeriod(rows),
      columns: Object.keys(found.map), file: fileName, sheet: sn,
      confidence: found.score, empty: !data.length
    });
  }
  return out;
}

/* التوافق مع الكود القديم: أول تطابق فقط */
function parse(wb, fileName) {
  return parseAll(wb, fileName)[0] || null;
}

root.SonoAuto = { parse, parseAll, detect, extract, findPeriod };
})(window);
