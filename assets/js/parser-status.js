/* ============================================================
   parser-status.js — قارئ «تقرير بيان الحالة المجمع»
   خدمات مجمّعة تحت كل طبيب/قسم، بكميات وأسعار وخصومات وضرائب.
   يكمّل تقرير الخزينة: يعطي إيراد كل طبيب وتحليل الخصومات.
   ============================================================ */
(function (root) {
'use strict';
const P = root.SonoParser;

const HEAD = {
  net    : ['الصافي', 'الصافى', 'صافي', 'صافى', 'الاجمالي بعد الخصم'],
  discount: ['اجمالي الخصم', 'اجمالى الخصم', 'الخصم', 'خصم'],
  tax    : ['اجمالي الضريبة', 'اجمالى الضريبة', 'الضريبة', 'ضريبه'],
  gross  : ['اجمالي السعر', 'اجمالى السعر', 'السعر', 'اجمالي قبل الخصم'],
  qty    : ['الكميه', 'الكمية', 'كميه', 'العدد'],
  service: ['الخدمه', 'الخدمة', 'خدمه', 'البيان'],
  doctor : ['الدكتور', 'الطبيب', 'دكتور', 'القسم']
};
function headKey(cell) {
  const t = P.normAr(cell).replace(/[:：]/g, '').trim();
  if (!t) return null;
  for (const k in HEAD) if (HEAD[k].some(a => P.normAr(a) === t)) return k;
  return null;
}

const TOTAL_RE = /^الاجمال[يى]?$/;

/* هل هذا الشيت من نوع «بيان الحالة»؟ */
function detect(rows) {
  for (let r = 0; r < Math.min(rows.length, 60); r++) {
    const keys = new Set();
    (rows[r] || []).forEach(c => { const k = headKey(c); if (k) keys.add(k); });
    /* البصمة المميّزة: خدمة + كمية + (خصم أو صافي) — وبلا عمود تاريخ */
    if (keys.has('service') && keys.has('qty') && (keys.has('discount') || keys.has('net'))) {
      const hasDate = (rows[r] || []).some(c => /^التاريخ$/.test(P.normAr(c)));
      if (!hasDate) return r;
    }
  }
  return -1;
}

/* استخراج الفترة من الترويسة: «من … إلى …» */
function findPeriod(rows) {
  let from = null, to = null;
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const row = rows[r] || [];
    for (let i = 0; i < row.length; i++) {
      const t = P.normAr(row[i]).replace(/[:：]/g, '').trim();
      if (t === 'من' || t === 'الي' || t === 'إلى' || t === 'الى') {
        /* الورقة عربية RTL: التاريخ يسبق تسميته على يساره. خذ أقرب تاريخ صالح. */
        let d = null;
        for (let j = i - 1; j >= Math.max(0, i - 8) && !d; j--) d = P.parseDate(row[j]);
        for (let j = i + 1; j <= Math.min(row.length - 1, i + 8) && !d; j++) d = P.parseDate(row[j]);
        if (d) { if (t === 'من') from = from || d; else to = to || d; }
      }
    }
  }
  return { from, to };
}

/* تنظيف اسم الطبيب: «د/ احمد سمير ( استشاري )» → الاسم + الدرجة */
const NON_DOCTOR = /^(الاشعه|الاشعة|المعمل|خدمات تمريضيه|خدمات تمريضية|الصيدليه|الصيدلية|التمريض|المخزن)$/;
function splitDoctor(raw) {
  const clean = P.cleanAr(raw);
  if (!clean) return { name: '', grade: '', isDept: false };
  const m = clean.match(/\(([^)]*)\)\s*$/);
  const grade = m ? P.cleanAr(m[1]) : '';
  let name = (m ? clean.slice(0, m.index) : clean)
    .replace(/^\s*(د\s*[\/\\.]|دكتور[ةه]?|ا\s*\/|أ\s*\/|م\s*\/)\s*/i, '')
    .replace(/\s{2,}/g, ' ').trim();
  const isDept = NON_DOCTOR.test(P.normAr(name || clean));
  if (!name) name = clean;
  return { name, grade, isDept };
}

/* ---------- المحلّل ---------- */
function parse(wb, fileName) {
  const out = { rows: [], period: {}, warnings: [], grand: null };
  let found = false;

  wb.SheetNames.forEach(sn => {
    const ws = wb.Sheets[sn];
    if (!ws) return;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    const hdr = detect(rows);
    if (hdr < 0) return;
    found = true;

    const map = {};
    (rows[hdr] || []).forEach((c, i) => { const k = headKey(c); if (k && map[k] === undefined) map[k] = i; });

    const per = findPeriod(rows);
    if (per.from) out.period.from = out.period.from || per.from;
    if (per.to)   out.period.to   = out.period.to   || per.to;

    let curDoctor = '', curGrade = '', curDept = false;

    for (let r = hdr + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const svcRaw = map.service !== undefined ? P.cleanAr(row[map.service]) : '';
      const net    = map.net      !== undefined ? P.toNum(row[map.net])      : null;
      const gross  = map.gross    !== undefined ? P.toNum(row[map.gross])    : null;
      const disc   = map.discount !== undefined ? P.toNum(row[map.discount]) : null;
      const tax    = map.tax      !== undefined ? P.toNum(row[map.tax])      : null;
      const qty    = map.qty      !== undefined ? P.toNum(row[map.qty])      : null;
      const docRaw = map.doctor   !== undefined ? P.cleanAr(row[map.doctor]) : '';

      /* بداية مجموعة طبيب/قسم جديدة */
      if (docRaw) {
        const d = splitDoctor(docRaw);
        curDoctor = d.name; curGrade = d.grade; curDept = d.isDept;
      }

      if (net === null && gross === null) continue;

      /* صف الإجمالي: إما إجمالي المجموعة أو الإجمالي العام */
      if (TOTAL_RE.test(P.normAr(svcRaw)) ||
          (map.discount !== undefined && TOTAL_RE.test(P.normAr(row[map.discount])))) {
        if (!svcRaw && net !== null) out.grand = net;   /* الإجمالي العام في آخر السطر */
        continue;
      }
      if (!svcRaw) continue;

      out.rows.push({
        service : svcRaw,
        cat     : P.classifyService(svcRaw),
        doctor  : curDoctor || 'غير محدد',
        grade   : curGrade,
        isDept  : curDept,
        qty     : qty || 0,
        gross   : gross !== null ? gross : (net || 0) + (disc || 0),
        discount: disc || 0,
        tax     : tax || 0,
        net     : net !== null ? net : (gross || 0) - (disc || 0),
        src     : fileName
      });
    }
  });

  if (!found) return null;                      /* ليس من هذا النوع */
  if (!out.rows.length) out.warnings.push('تُعرِّف الملف كتقرير بيان حالة لكنه بلا سطور صالحة.');

  /* تحقّق من مطابقة الإجمالي */
  if (out.grand !== null) {
    const sum = out.rows.reduce((s, x) => s + x.net, 0);
    if (Math.abs(sum - out.grand) > 1)
      out.warnings.push(`إجمالي السطور ${Math.round(sum)} لا يطابق إجمالي الملف ${Math.round(out.grand)}.`);
  }
  return out;
}

root.SonoStatusParser = { parse, detect, splitDoctor };
})(window);
