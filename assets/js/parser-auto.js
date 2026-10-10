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
      if (!a.hits || (a.hits < 2 && !titleHit && !fileHit)) continue;
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
function extract(rows, found, worksheet) {
  const { def, map, dataRow } = found;
  const out = [];
  // Resolve only actual Excel merge ranges. Blank insurer/channel cells are not carry-forward values.
  const mergedValues = new Map();
  if (def.id === 'statusDetail') (worksheet && worksheet['!merges'] || []).forEach(m => {
    Object.values(map).filter(c => c >= m.s.c && c <= m.e.c).forEach(c => {
      if (['total','price','qty','discount','tax'].some(k => map[k] === c)) return;
      const value = (rows[m.s.r] || [])[m.s.c];
      for (let r = m.s.r; r <= m.e.r; r++) mergedValues.set(r + '|' + c, value);
    });
  });
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

    // The exported status report includes unlabelled subtotals and a final total.
    // Those rows have money but no service; they are checks, never transactions.
    if (def.id === 'statusDetail' && !P().cleanAr(row[map.service])) continue;
    const rec = { _row: r };
    let filled = 0;
    for (const k in map) {
      let raw = row[map[k]];
      if ((raw === null || raw === undefined || raw === '') && mergedValues.has(r + '|' + map[k])) raw = mergedValues.get(r + '|' + map[k]);
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
  const fill = def.id === 'statusDetail' ? [] : FILL.filter(k => map[k] !== undefined);
  const last = {};
  out.forEach(rec => fill.forEach(k => {
    if (rec[k] === null || rec[k] === '' || rec[k] === undefined) {
      if (last[k] !== undefined) rec[k] = last[k];
    } else last[k] = rec[k];
  }));
  return out;
}

/* ============================================================
   «الإيراد اليومي»: ورقة واحدة فيها عدة جداول متجاورة
   (طرق الدفع · الخدمات · المصروفات بالبند · الأطباء والحالات · الملخص والأرصدة).
   المحرّك العام يقرأ جدولاً واحداً، وهذه الدالة تقرأ الباقي بتوقيع ترويسة كل جدول.
   لا تُخمَّن أعمدة: كل جدول يُقبل فقط إن وُجدت ترويسته كاملة.
   ============================================================ */
const SUMMARY_LABELS = {
  revenueTotal: 'اجمالي الايرادات', expenseTotal: 'اجمالي المصروفات', net: 'الصافي',
  opening: 'رصيد ما قبله', closing: 'الرصيد الحالي',
  bankTotal: 'اجمالي الائتمان والحوالات البنكيه', feesTotal: 'اجمالي الرسوم شامله الضريبه'
};
const DEPT_RE = /^(خدمات|المعمل|معمل|الاشعه|اشعه)/;

function dailySections(rows) {
  const out = { services: [], doctors: [], expenses: [], summary: {},
                servicesTotal: null, doctorsTotal: null };
  const cells = r => (rows[r] || []).map(c => norm(c));
  const colOf = (arr, label, from) => {
    const i = arr.indexOf(norm(label), from || 0);
    return i;
  };
  const nearest = (arr, label, anchor) => {
    let best = -1;
    arr.forEach((c, j) => { if (c === norm(label) && (best < 0 || Math.abs(j - anchor) < Math.abs(best - anchor))) best = j; });
    return best;
  };
  const isTotal = c => TOTAL_RE.test(norm(c));
  const text = (row, c) => P().cleanAr((row || [])[c]);
  const money = (row, c) => P().toNum((row || [])[c]);

  for (let r = 0; r < rows.length; r++) {
    const h = cells(r);
    if (!h.some(Boolean)) continue;

    /* جدول الخدمات */
    const cs = colOf(h, 'الخدمة');
    if (cs >= 0 && h.includes(norm('تكلفة الخدمات')) && !out.services.length) {
      const cv = nearest(h, 'القيمة', cs), cc = nearest(h, 'تكلفة الخدمات', cs);
      if (cv >= 0) {
        /* صفوف الخدمات تتخلّلها صفوف ملخص في أعمدة أخرى، فلا نتوقف عند الفراغ بل عند صف الإجمالي */
        for (let k = r + 1; k < rows.length; k++) {
          const row = rows[k] || [];
          if (isTotal(row[cs])) { out.servicesTotal = { value: money(row, cv), cost: cc >= 0 ? money(row, cc) : null }; break; }
          const name = text(row, cs), val = money(row, cv);
          if (name && val !== null) out.services.push({ name, value: val, cost: cc >= 0 ? (money(row, cc) || 0) : null });
        }
      }
    }

    /* جدول الأطباء والحالات */
    const cd = colOf(h, 'الدكتور');
    if (cd >= 0 && h.includes(norm('عدد الحالات')) && h.includes(norm('القيمة المحصلة')) && !out.doctors.length) {
      const cn = nearest(h, 'عدد الحالات', cd), cc = nearest(h, 'القيمة المحصلة', cd), cp = nearest(h, 'نسبة الدكتور', cd);
      let gap = 0;
      for (let k = r + 1; k < rows.length; k++) {
        const row = rows[k] || [];
        if (isTotal(row[cd])) {
          out.doctorsTotal = { cases: money(row, cn), collected: money(row, cc), share: cp >= 0 ? money(row, cp) : null };
          break;
        }
        const name = text(row, cd);
        if (!name) { if (++gap > 1) break; continue; }
        gap = 0;
        out.doctors.push({ name, cases: money(row, cn) || 0, collected: money(row, cc) || 0,
                           share: cp >= 0 ? (money(row, cp) || 0) : 0, dept: DEPT_RE.test(norm(name)) });
      }
    }

    /* جدول المصروفات بالبند (الملاحظات لا تُقرأ: قد تحمل أسماء مرضى) */
    const ci = colOf(h, 'المصروف');
    if (ci >= 0 && h.includes(norm('الطريقة')) && !out.expenses.length) {
      const cv = nearest(h, 'القيمة', ci);
      if (cv >= 0) {
        let gap = 0;
        for (let k = r + 1; k < rows.length; k++) {
          const row = rows[k] || [];
          const item = text(row, ci), val = money(row, cv);
          if (!item && val === null) { if (++gap > 1) break; continue; }
          gap = 0;
          if (item && val !== null) out.expenses.push({ item, amount: val });
        }
      }
    }
  }

  /* الملخص والأرصدة: رقم بجوار تسمية معروفة */
  for (let r = 0; r < Math.min(rows.length, 80); r++) {
    const row = rows[r] || [], h = cells(r);
    Object.keys(SUMMARY_LABELS).forEach(key => {
      if (out.summary[key] !== undefined) return;
      const i = h.indexOf(norm(SUMMARY_LABELS[key]));
      if (i < 0) return;
      let best = null;
      row.forEach((c, j) => {
        if (j === i || Math.abs(j - i) > 12) return;
        const n = P().toNum(c);
        if (n === null || typeof c === 'string' && /[^\d.,\-\s٠-٩۰-۹]/.test(c)) return;
        if (!best || Math.abs(j - i) < Math.abs(best.j - i) || (Math.abs(j - i) === Math.abs(best.j - i) && j < i)) best = { n, j };
      });
      if (best) out.summary[key] = best.n;
    });
  }
  return out;
}

/* الفترة من ترويسة الورقة
   التقارير العربية تُقرأ من اليمين: التاريخ يقع يسار كلمة «من»/«إلى» (أو في الصف التالي)،
   لذلك نبحث أولاً يساراً بمسافة محدودة ثم في الصف التالي ثم يميناً. */
function findPeriod(rows) {
  let from = null, to = null;
  const REACH = 15;
  for (let r = 0; r < Math.min(rows.length, 14); r++) {
    const row = rows[r] || [];
    for (let i = 0; i < row.length; i++) {
      const t = norm(row[i]);
      if (t !== 'من' && t !== 'الي' && t !== 'الى') continue;
      let hit = null;
      /* يسار العلامة في نفس الصف: أقرب تاريخ */
      const near = (rw, lo, hi) => {
        let b = null;
        (rw || []).forEach((c, j) => {
          if (j < lo || j > hi) return;
          const d = P().parseDate(c);
          if (d && (!b || Math.abs(j - i) < Math.abs(b.j - i))) b = { d, j };
        });
        return b;
      };
      hit = near(rows[r], Math.max(0, i - REACH), i - 1) ||
            near(rows[r + 1], Math.max(0, i - REACH), i + 2) ||
            near(rows[r], i + 1, i + REACH) ||
            near(rows[r + 1], i + 1, i + REACH);
      if (hit) { if (t === 'من') from = from || hit.d; else to = to || hit.d; }
    }
  }
  if (from && to && from > to) { const x = from; from = to; to = x; }
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
    const data = extract(rows, found, ws);
    const warnings = [];
    const sections = found.def.id === 'dailyRevenue' ? dailySections(rows) : null;
    if (found.def.id === 'statusDetail') {
      const totalIndex = found.map.total;
      const lastRow = rows.slice().reverse().find(row => (row || []).some(v => v !== null && v !== '')) || [];
      const declared = !P().cleanAr(lastRow[found.map.service]) ? P().toNum(lastRow[totalIndex]) : null;
      const actual = data.reduce((sum, r) => sum + (P().toNum(r.total) || 0), 0);
      if (declared !== null && Math.abs(declared - actual) > 0.01)
        warnings.push('إجمالي بنود الخدمات ' + actual.toFixed(2) + ' لا يطابق إجمالي الملف ' + declared.toFixed(2) + '.');
    }
    if (!data.length && !found.def.allowEmpty) continue;
    out.push({
      id: found.def.id, name: found.def.name, group: found.def.group,
      info: found.def.info, rows: data, period: findPeriod(rows), sections,
      warnings, columns: Object.keys(found.map), file: fileName, sheet: sn,
      confidence: found.score, empty: !data.length
    });
  }
  return out;
}

/* التوافق مع الكود القديم: أول تطابق فقط */
function parse(wb, fileName) {
  return parseAll(wb, fileName)[0] || null;
}

root.SonoAuto = { parse, parseAll, detect, extract, findPeriod, dailySections };
})(window);

