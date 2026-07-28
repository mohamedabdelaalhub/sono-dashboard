/* ============================================================
   schedule.js — قارئ ومحلّل «جدول العيادات»
   ملف إداري لا مالي: أطباء · تخصصات · درجات علمية · أيام ·
   مواعيد · أسعار كشف · هواتف · خدمات التخصص.
   يقرأ الورقتين (جدول الأيام + جدول التخصصات)، ينظّف البيانات
   بالكامل، ويبني نموذجاً موحّداً يغذّي تاب «جدول العيادات».
   ============================================================ */
(function (root) {
'use strict';

const S = v => (v === null || v === undefined) ? '' : String(v).trim();
const P = () => root.SonoParser;

/* ---------- تنظيف النص العربي ---------- */
function norm(s) {
  let t = S(s);
  try { t = t.normalize('NFKC'); } catch (e) {}
  return t.replace(/[ً-ْٰـ]/g, '')
          .replace(/[​-‏‪-‮﻿]/g, '')
          .replace(/\s+/g, ' ').trim();
}
/* مفتاح مقارنة: يزيل الهمزات والتاء المربوطة ليطابق «الجلديه» بـ«جلدية» */
function key(s) {
  return norm(s).replace(/[أإآٱ]/g, 'ا').replace(/[ىی]/g, 'ي')
                .replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
                .replace(/^(ال)/, '').replace(/[\s\-_]/g, '');
}

/* ============================================================
   قواميس التوحيد
   ============================================================ */
const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const DAY_KEY = {};
DAYS.forEach(d => DAY_KEY[key(d)] = d);
/* أخطاء إملائية شائعة */
[['الاتنين', 'الاثنين'], ['االاتنين', 'الاثنين'], ['الاتنن', 'الاثنين'],
 ['الاربعاء', 'الأربعاء'], ['الاربعا', 'الأربعاء'], ['الجمعه', 'الجمعة'],
 ['الاحد', 'الأحد'], ['الثلاثا', 'الثلاثاء'], ['الخميث', 'الخميس']]
  .forEach(([a, b]) => DAY_KEY[key(a)] = b);

/* التخصصات: الاسم المعتمد ← كل الصيغ التي تعني نفسه */
const SPEC_MAP = [
  ['باطنة',            ['باطنه', 'باطنة', 'الباطنه', 'باطنيه']],
  ['مخ وأعصاب',        ['مخ واعصاب', 'مخ و اعصاب', 'مخ وأعصاب', 'المخ والاعصاب']],
  ['جراحة مخ وأعصاب',  ['جراحه مخ واعصاب', 'جراحة مخ وأعصاب']],
  ['عظام',             ['عظام', 'العظام', 'جراحه عظام']],
  ['جراحة عامة',       ['جراحه', 'جراحة', 'الجراحه', 'جراحه عامه']],
  ['جلدية',            ['جلديه', 'الجلديه', 'جلدية', 'الجلدية', 'جلديه وتجميل']],
  ['أنف وأذن',         ['انف و اذن', 'انف واذن', 'أنف وأذن', 'انف اذن وحنجره']],
  ['نساء وتوليد',      ['نسا و توليد', 'نسا وتوليد', 'نساء وتوليد', 'نساء و توليد']],
  ['نفسية',            ['نفسيه', 'نفسية', 'الطب النفسي']],
  ['أطفال',            ['اطفال', 'أطفال', 'الاطفال']],
  ['علاج طبيعي',       ['علاج طبيعي', 'العلاج الطبيعي', 'علاج طبيعى']],
  ['أورام',            ['اورام', 'أورام', 'الاورام']],
  ['قلب وأوعية دموية', ['قلب', 'قلب و اوعيه دمويه', 'قلب واوعيه دمويه', 'قلب و اوعيه دموية', 'قلب واوعية دموية']],
  ['أسنان',            ['اسنان', 'أسنان', 'الاسنان']],
  ['تجميل',            ['تجميل', 'التجميل']],
  ['جراحة تجميل',      ['جراحه التجميل', 'جراحة التجميل', 'جراحه تجميل', 'جراحة تجميل']],
  ['مسالك بولية',      ['مسالك', 'مسالك بوليه', 'المسالك', 'جراحه مسالك']],
  ['أشعة',             ['اشعه', 'ااشعة', 'اشعة', 'الاشعه']],
  ['معمل تحاليل',      ['معمل', 'تحاليل', 'معمل تحاليل']]
];
const SPEC_KEY = {};
SPEC_MAP.forEach(([std, alts]) => alts.forEach(a => SPEC_KEY[key(a)] = std));

function stdSpec(v) {
  const t = norm(v);
  if (!t) return '';
  return SPEC_KEY[key(t)] || t;
}
function stdDay(v) {
  const t = norm(v);
  if (!t) return '';
  return DAY_KEY[key(t)] || '';
}

/* ---------- الدرجة العلمية ---------- */
const GRADES = [
  ['استشاري', /استشار/],
  ['أخصائي',  /اخصائ|أخصائ/],
  ['نائب',    /نائب|مقيم/],
  ['أستاذ',   /استاذ|أستاذ|بروف/]
];
function grade(txt) {
  const t = norm(txt);
  for (const [nm, re] of GRADES) if (re.test(t)) return nm;
  return '';
}

/* ---------- الخدمات الفرعية داخل «التخصص بالتفصيل» ---------- */
const SUBSVC = [
  ['ليزر', /ليزر|لازر|laser/i], ['حقن', /حقن|فيلر|بوتكس/], ['زراعة', /زراع/],
  ['تقويم', /تقويم/], ['أطفال', /اطفال|أطفال/], ['تجميل', /تجميل/],
  ['جراحة', /جراح/], ['أشعة', /اشع|أشع/]
];
function subServices(txt) {
  const t = norm(txt);
  return SUBSVC.filter(([, re]) => re.test(t)).map(([n]) => n);
}

/* ---------- اسم الطبيب ---------- */
function docName(v) {
  let t = norm(v);
  t = t.replace(/^(د|دكتور|دكتوره|الدكتور|الدكتورة)\s*[\/\\.]?\s*/i, '');
  t = t.replace(/\(([^)]*)\)/g, ' ').replace(/\s+/g, ' ').trim();
  return t;
}
/* مفتاح مطابقة الأطباء عبر التقارير المختلفة */
function docKey(v) {
  return key(docName(v)).replace(/\s/g, '');
}

/* ---------- الهاتف ---------- */
function phone(v) {
  let t = S(v).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c) + '');
  t = t.replace(/\D/g, '');
  if (!t) return '';
  if (t.startsWith('20')) t = t.slice(2);          /* +20 */
  if (t.startsWith('002')) t = t.slice(3);
  t = t.replace(/^0+/, '');                         /* أصفار زائدة */
  if (t.length === 10 && /^1/.test(t)) t = '0' + t; /* 1XXXXXXXXX */
  else if (t.length === 11 && /^01/.test(t)) { /* سليم */ }
  else if (t.length === 9)  t = '01' + t;
  else if (/^1/.test(t))    t = '0' + t;
  return t;
}
const phoneOk = p => /^01[0125]\d{8}$/.test(p);

/* ============================================================
   قراءة المواعيد  «11 - 9.30» = من ٩:٣٠ إلى ١١
   تُجرَّب القراءتان وتُختار المنطقية (نهاية بعد بداية ومدة ≤ 14 ساعة)
   ============================================================ */
function hhmm(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.round(m % 60)).padStart(2, '0'); }

function toMin(tok, pm) {
  const m = String(tok).match(/(\d{1,2})(?:[.:](\d{1,2}))?/);
  if (!m) return null;
  let h = +m[1]; const mi = m[2] ? (+m[2] < 10 && m[2].length === 1 ? +m[2] * 10 : +m[2]) : 0;
  if (h > 24) return null;
  if (pm === 'pm' && h < 12) h += 12;
  if (pm === 'am' && h === 12) h = 0;
  return h * 60 + mi;
}
/* تحويل ساعة غامضة إلى ساعة عيادة منطقية (٩ ص → ١٢ م) */
function clinicize(m) { return (m < 9 * 60) ? m + 12 * 60 : m; }

function parseRange(txt) {
  const t = norm(txt);
  if (!t || t === '-') return null;
  if (/on\s*call|طوارئ|تحت الطلب/i.test(t)) return { onCall: true, raw: t };
  const pm = /(^|\s)م(\s|$)|pm/i.test(t) ? 'pm' : (/(^|\s)ص(\s|$)|am/i.test(t) ? 'am' : null);
  const nums = t.match(/\d{1,2}(?:[.:]\d{1,2})?/g);
  if (!nums || !nums.length) return null;
  if (nums.length === 1) {
    const a = clinicize(toMin(nums[0], pm));
    return a === null ? null : { from: a, to: null, raw: t, single: true };
  }
  const A = toMin(nums[0], pm), B = toMin(nums[1], pm);
  if (A === null || B === null) return null;
  const cand = [[B, A], [A, B]];
  for (const [s0, e0] of cand) {
    const s = clinicize(s0), e = clinicize(e0);
    if (e > s && (e - s) <= 14 * 60) return { from: s, to: e, raw: t };
  }
  /* لفّ بعد منتصف الليل — بحد أقصى ١٢ ساعة */
  const s = clinicize(B);
  let e = clinicize(A);
  if (e <= s) e += 12 * 60;
  if (e - s > 12 * 60) e = s + 12 * 60;
  return { from: s, to: Math.min(e, 24 * 60), raw: t, wrap: true };
}
/* عدة نطاقات مفصولة بـ \ أو / */
function parseRanges(txt) {
  const t = norm(txt);
  if (!t) return [];
  return t.split(/[\\\/]+|،|,/).map(x => x.trim()).filter(Boolean)
          .map(parseRange).filter(Boolean);
}

/* ============================================================
   كشف الملف
   ============================================================ */
/* تسميات الترويسة كما تظهر في الملف — بما فيها الأخطاء الإملائية */
const HEAD_LABELS = new Set(['التخصص', 'النخصص', 'الاسم', 'التخصص بالتفصيل', 'النخصص بالتفصيل',
  'سعر الكشف', 'المواعيد', 'رقم التلفون', 'رقم التليفون', 'الايام', 'الأيام',
  'الخدمات الخاصه بالتخصص', 'الخدمات الخاصة بالتخصص', 'م'].map(key));
const isHeadCell = v => HEAD_LABELS.has(key(v));
/* صف ترويسة: فيه تسميتان فأكثر داخل نطاق البلوك */
function isHeadRow(row, c0) {
  let n = 0;
  for (let i = c0; i < c0 + 8; i++) if (isHeadCell(row[i])) n++;
  return n >= 2;
}
/* اسم شخص لا تخصص */
const looksLikeName = v => /^\s*(د|دكتور|دكتوره|الدكتور|الدكتورة)\s*[\/\\.]/.test(String(v || ''));
/* نص وصفي لا اسم شخص */
const DESC_ONLY = /^(اخصائي|أخصائي|استشاري|استشارى|نائب|مقيم|طبيب)\b/;
const HEAD_ROW = /التخصص|النخصص/;
function isSchedule(wb) {
  const names = wb.SheetNames.map(n => key(n));
  const hit = names.some(n => /جدولالايام|جدولالأيام|جدولالتخصات|جدولالتخصصات|clinicschedule/.test(n));
  if (hit) return true;
  /* أو: ورقة فيها الأعمدة الست المميّزة */
  return wb.SheetNames.some(sn => {
    const r = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null });
    return r.slice(0, 6).some(row => {
      const line = (row || []).map(c => key(c)).join('|');
      return /التخصص/.test((row || []).map(c => norm(c)).join('|')) &&
             /سعرالكشف/.test(line) && /المواعيد/.test(line);
    });
  });
}

/* ---------- ورقة «جدول التخصصات»: صف لكل طبيب ---------- */
function readRoster(rows) {
  const out = [];
  let spec = '';
  const idx = { spec: 0, name: 1, detail: 2, price: 3, days: 4, hours: 5, phone: 6, svc: 7 };
  rows.forEach(row => {
    row = row || [];
    if (isHeadRow(row, 0)) return;                       /* صف ترويسة */
    const a = norm(row[idx.spec]);
    if (a && !isHeadCell(a) && !looksLikeName(row[idx.spec])) spec = a;
    if (isHeadCell(row[idx.name])) return;
    const nm = docName(row[idx.name]);
    if (!nm || isHeadCell(nm) || DESC_ONLY.test(nm)) return;
    out.push({
      spec: stdSpec(spec), specRaw: spec, name: nm, nameRaw: norm(row[idx.name]),
      detail: norm(row[idx.detail]), price: numOr0(row[idx.price]),
      daysRaw: norm(row[idx.days]), hoursRaw: norm(row[idx.hours]),
      phone: phone(row[idx.phone]), phoneRaw: norm(row[idx.phone]),
      services: norm(row[idx.svc])
    });
  });
  return out;
}
function numOr0(v) { const n = P().toNum(v); return n === null ? 0 : n; }

/* ---------- ورقة «جدول الأيام»: شبكة أسبوعية ---------- */
function readGrid(rows, validSpecs) {
  const VALID = validSpecs || new Set();
  const isSpecCell = v => {
    const k = key(v);
    return !!k && (SPEC_KEY[k] !== undefined || VALID.has(k));
  };
  const out = [];
  if (!rows.length) return out;
  /* بداية كل بلوك = عمود «التخصص» في صف الترويسة، واليوم = اسم اليوم فوقه */
  const blocks = [];
  const SPEC_HEAD = new Set(['التخصص', 'النخصص'].map(key));
  let hdr = -1;
  for (let i = 0; i < Math.min(rows.length, 8); i++)
    if ((rows[i] || []).filter(c => SPEC_HEAD.has(key(c))).length) { hdr = i; break; }
  if (hdr >= 0) {
    (rows[hdr] || []).forEach((c, i) => {
      if (!SPEC_HEAD.has(key(c))) return;
      let day = '';
      for (let r = 0; r <= hdr && !day; r++)
        for (let j = Math.max(0, i - 1); j < i + 7 && !day; j++) day = stdDay((rows[r] || [])[j]);
      if (day) blocks.push({ day, c0: i });
    });
  }
  if (!blocks.length) {
    /* احتياطي: أسماء الأيام في الصف الأول */
    (rows[0] || []).forEach((c, i) => { const d = stdDay(c); if (d) blocks.push({ day: d, c0: i }); });
  }
  if (!blocks.length) {
    const order = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    order.forEach((d, i) => blocks.push({ day: d, c0: i * 7 }));
  }
  blocks.forEach(b => {
    let spec = '';
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      if (isHeadRow(row, b.c0)) continue;                /* صف ترويسة */
      const a = norm(row[b.c0]);
      if (a && !isHeadCell(a) && isSpecCell(a)) spec = a;
      if (isHeadCell(row[b.c0 + 1])) continue;
      /* الاسم في عموده. وإن كان فارغاً وخلية التخصص تحمل اسماً،
         فالصف كله مزاح خانة لليسار — نزيح معه كل الأعمدة. */
      let off = 1;
      if (!norm(row[b.c0 + 1]) && a && !isSpecCell(a) && !isHeadCell(a)) off = 0;
      const nameCell = row[b.c0 + off];
      const nm = docName(nameCell);
      if (!nm || isHeadCell(nm) || isSpecCell(nm) || DESC_ONLY.test(nm)) continue;
      /* الاسم قد يقع في عمود التخصص حين تكون الخلايا مدمجة */
      out.push({
        day: b.day, spec: stdSpec(spec), name: nm, nameRaw: norm(nameCell),
        detail: norm(row[b.c0 + off + 1]), price: numOr0(row[b.c0 + off + 2]),
        hoursRaw: norm(row[b.c0 + off + 3]), phone: phone(row[b.c0 + off + 4])
      });
    }
  });
  return out;
}

/* ============================================================
   الدمج: بناء سجل طبيب موحّد
   ============================================================ */
function build(roster, grid, fileName) {
  const docs = new Map();
  const notes = [];

  const put = (r, src) => {
    const k = docKey(r.name);
    if (!k) return null;
    let o = docs.get(k);
    if (!o) {
      o = { key: k, name: r.name, specs: new Set(), grade: '', detail: '',
            subs: new Set(), prices: new Set(), phones: new Set(),
            days: new Map(), services: new Set(), src: new Set() };
      docs.set(k, o);
    }
    if (r.spec) o.specs.add(r.spec);
    if (r.detail && r.detail.length > o.detail.length) o.detail = r.detail;
    const g = grade(r.detail) || grade(r.nameRaw);
    if (g && !o.grade) o.grade = g;
    subServices(r.detail).forEach(s => o.subs.add(s));
    if (r.services) r.services.split(/[,،\-\/]+/).map(x => norm(x)).filter(Boolean)
                     .forEach(s => o.services.add(s));
    if (r.price >= 50) o.prices.add(r.price);
    if (r.phone) o.phones.add(r.phone);
    o.src.add(src);
    return o;
  };

  /* ١) الورقة الرئيسية: صف لكل طبيب مع قائمة أيامه */
  roster.forEach(r => {
    const o = put(r, 'التخصصات');
    if (!o) return;
    const days = (r.daysRaw || '').split(/[-–—]+/).map(x => stdDay(x)).filter(Boolean);
    const ranges = parseRanges(r.hoursRaw);
    const uniqDays = [...new Set(days)];
    uniqDays.forEach((d, i) => {
      const rg = ranges.length === uniqDays.length ? ranges[i] : (ranges[0] || null);
      const cur = o.days.get(d);
      if (!cur || (!cur.from && rg && rg.from)) o.days.set(d, mkSlot(d, rg, r.hoursRaw));
    });
    if (!uniqDays.length && /on\s*call/i.test(r.daysRaw || '')) o.onCall = true;
  });

  /* ٢) الشبكة الأسبوعية: تؤكّد الأيام وتضيف مواعيد اليوم بدقة */
  grid.forEach(r => {
    const o = put(r, 'الأيام');
    if (!o) return;
    const rg = parseRanges(r.hoursRaw)[0] || null;
    const cur = o.days.get(r.day);
    if (!cur || (rg && rg.from && !cur.from)) o.days.set(r.day, mkSlot(r.day, rg, r.hoursRaw));
  });

  /* ٣) دمج الاسم المختصر مع الكامل حين يتطابق الهاتف ويكون أحدهما بداية الآخر */
  const arr = [...docs.values()];
  arr.forEach(a => {
    if (a.merged) return;
    arr.forEach(b => {
      if (a === b || b.merged || a.merged) return;
      const pa = [...a.phones].filter(phoneOk), pb = [...b.phones].filter(phoneOk);
      const samePhone = pa.some(x => pb.indexOf(x) >= 0);
      if (!samePhone) return;
      const ka = a.key, kb = b.key;
      const prefix = ka.indexOf(kb) === 0 || kb.indexOf(ka) === 0;
      const ta = a.name.split(' '), tb = b.name.split(' ');
      const shared = ta.filter(t => t.length > 2 && tb.indexOf(t) >= 0).length;
      if (!prefix && shared < 2) return;
      /* ادمج الأقصر داخل الأطول */
      const [keep, drop] = a.name.length >= b.name.length ? [a, b] : [b, a];
      drop.specs.forEach(x => keep.specs.add(x));
      drop.subs.forEach(x => keep.subs.add(x));
      drop.services.forEach(x => keep.services.add(x));
      drop.prices.forEach(x => keep.prices.add(x));
      drop.phones.forEach(x => keep.phones.add(x));
      drop.src.forEach(x => keep.src.add(x));
      drop.days.forEach((v, k) => { if (!keep.days.has(k)) keep.days.set(k, v); });
      if (!keep.grade && drop.grade) keep.grade = drop.grade;
      if (drop.detail.length > keep.detail.length) keep.detail = drop.detail;
      drop.merged = true;
      keep.aliases = (keep.aliases || []).concat([drop.name]);
      docs.delete(drop.key);
    });
  });

  /* ٤) الإخراج النهائي + التنظيف */
  const list = [...docs.values()].map(o => {
    const days = DAYS.filter(d => o.days.has(d)).map(d => o.days.get(d));
    const prices = [...o.prices].sort((a, b) => a - b);
    const phones = [...o.phones];
    const specs = [...o.specs];
    return {
      key: o.key, name: o.name, aliases: o.aliases || [],
      spec: specs[0] || 'غير محدّد', specs,
      grade: o.grade || 'غير محدّد',
      detail: o.detail,
      subs: [...o.subs], services: [...o.services],
      price: prices[0] || 0, priceMax: prices[prices.length - 1] || 0, prices,
      phone: phones.find(phoneOk) || phones[0] || '', phones,
      days, dayNames: days.map(d => d.day),
      hours: days.map(d => d.label).filter(Boolean).join(' · '),
      weeklyMin: days.reduce((s, d) => s + (d.mins || 0), 0),
      onCall: !!o.onCall || days.some(d => d.onCall),
      sources: [...o.src]
    };
  }).sort((a, b) => (a.spec || '').localeCompare(b.spec, 'ar') || a.name.localeCompare(b.name, 'ar'));

  return { doctors: list, file: fileName, notes };
}

function mkSlot(day, rg, raw) {
  if (!rg) return { day, from: null, to: null, label: norm(raw) || '—', mins: 0, raw: norm(raw) };
  if (rg.onCall) return { day, from: null, to: null, onCall: true, label: 'تحت الطلب', mins: 0, raw: rg.raw };
  if (rg.to === null || rg.to === undefined)
    return { day, from: rg.from, to: null, label: 'من ' + hhmm(rg.from), mins: 0, raw: rg.raw };
  return { day, from: rg.from, to: rg.to, label: hhmm(rg.from) + ' – ' + hhmm(rg.to),
           mins: Math.max(0, rg.to - rg.from), raw: rg.raw };
}

/* ============================================================
   الواجهة: اقرأ مصنّفاً
   ============================================================ */
function parse(wb, fileName) {
  if (!isSchedule(wb)) return null;
  let roster = [], grid = [];
  const sheets = wb.SheetNames.map(sn => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null, blankrows: true });
    const head = (rows[0] || []).map(c => norm(c));
    return { sn, rows, isGrid: /جدولالايام|جدولالأيام/.test(key(sn)) || head.some(c => stdDay(c)) };
  }).filter(x => x.rows.length);
  /* الجدول الرئيسي أولاً: منه نعرف التخصصات الصحيحة قبل قراءة الشبكة */
  sheets.filter(x => !x.isGrid).forEach(x => { roster = roster.concat(readRoster(x.rows)); });
  const validSpecs = new Set(roster.map(r => key(r.specRaw)).filter(Boolean));
  sheets.filter(x => x.isGrid).forEach(x => { grid = grid.concat(readGrid(x.rows, validSpecs)); });
  if (!roster.length && !grid.length) return null;
  const out = build(roster, grid, fileName);
  if (!out.doctors.length) return null;
  out.kind = 'schedule';
  out.name = 'جدول عيادات المركز';
  out.savedAt = new Date().toISOString();
  Object.assign(out, summarize(out.doctors));
  return out;
}

/* ============================================================
   التحليل: تغطية · فجوات · تعارضات
   ============================================================ */
function summarize(docs) {
  const specs = new Map();
  docs.forEach(d => d.specs.forEach(s => {
    const o = specs.get(s) || { spec: s, docs: [], days: new Set(), prices: [] };
    o.docs.push(d.name);
    d.dayNames.forEach(x => o.days.add(x));
    if (d.price) o.prices.push(d.price);
    specs.set(s, o);
  }));
  const specList = [...specs.values()].map(o => {
    const ps = o.prices.slice().sort((a, b) => a - b);
    return { spec: o.spec, docCount: o.docs.length, docs: o.docs,
             dayCount: o.days.size, days: DAYS.filter(d => o.days.has(d)),
             minPrice: ps[0] || 0, maxPrice: ps[ps.length - 1] || 0,
             priceSpread: ps.length > 1 ? ps[ps.length - 1] - ps[0] : 0 };
  }).sort((a, b) => b.dayCount - a.dayCount || b.docCount - a.docCount);

  /* مصفوفة تخصص × يوم */
  const matrix = specList.map(s => ({
    spec: s.spec,
    cells: DAYS.map(d => docs.filter(x => x.specs.indexOf(s.spec) >= 0 && x.dayNames.indexOf(d) >= 0))
  }));

  const perDay = DAYS.map(d => ({
    day: d,
    docs: docs.filter(x => x.dayNames.indexOf(d) >= 0),
    specs: [...new Set(docs.filter(x => x.dayNames.indexOf(d) >= 0).map(x => x.spec))]
  }));

  /* التعارضات */
  const conflicts = [];
  docs.forEach(d => {
    if (d.prices.length > 1) conflicts.push({ type: 'سعر', doctor: d.name,
      detail: `سعر كشف مختلف في الجدول: ${d.prices.join(' / ')} جنيه.` });
    if (d.phones.length > 1) conflicts.push({ type: 'هاتف', doctor: d.name,
      detail: `أكثر من رقم: ${d.phones.join(' / ')}.` });
    if (!d.phone) conflicts.push({ type: 'هاتف', doctor: d.name, detail: 'لا يوجد رقم هاتف.' });
    else if (!phoneOk(d.phone)) conflicts.push({ type: 'هاتف', doctor: d.name,
      detail: `رقم غير مطابق للصيغة المصرية: ${d.phone}.` });
    if (!d.price) conflicts.push({ type: 'سعر', doctor: d.name, detail: 'لا يوجد سعر كشف.' });
    if (!d.days.length && !d.onCall) conflicts.push({ type: 'أيام', doctor: d.name, detail: 'غير مجدول في أي يوم.' });
    if (d.specs.length > 1) conflicts.push({ type: 'تخصص', doctor: d.name,
      detail: `مسجَّل تحت أكثر من تخصص: ${d.specs.join(' · ')}.` });
    const hinted = stdSpec(d.detail);
    if (d.detail && SPEC_KEY[key(d.detail)] && hinted && d.specs.indexOf(hinted) < 0)
      conflicts.push({ type: 'تخصص', doctor: d.name,
        detail: `مُدرج تحت «${d.spec}» بينما تخصصه المكتوب «${hinted}» — راجع التصنيف.` });
    if (d.grade === 'غير محدّد') conflicts.push({ type: 'درجة', doctor: d.name, detail: 'الدرجة العلمية غير مذكورة.' });
  });

  /* رقم واحد لطبيبين مختلفين */
  const byPhone = {};
  docs.forEach(d => { if (phoneOk(d.phone)) (byPhone[d.phone] = byPhone[d.phone] || []).push(d.name); });
  Object.keys(byPhone).filter(p => byPhone[p].length > 1).forEach(p =>
    conflicts.push({ type: 'هاتف', doctor: byPhone[p].join(' و'),
      detail: `الرقم ${p} مسجَّل لأكثر من طبيب — غالباً خطأ نسخ.` }));

  /* تداخل مواعيد نفس الطبيب في نفس اليوم عبر تخصصين */
  const overlaps = [];
  const byDay = {};
  docs.forEach(d => d.days.forEach(s => {
    if (!s.from || !s.to) return;
    (byDay[s.day] = byDay[s.day] || []).push({ doc: d, slot: s });
  }));

  const gaps = specList.filter(s => s.dayCount <= 2)
                       .map(s => ({ spec: s.spec, dayCount: s.dayCount, docCount: s.docCount,
                                    days: s.days, missing: DAYS.filter(d => s.days.indexOf(d) < 0) }));
  const solo = specList.filter(s => s.docCount === 1);

  return {
    specialties: specList, matrix, perDay, conflicts, overlaps, gaps, solo,
    stats: {
      doctors: docs.length,
      specialties: specList.length,
      slots: docs.reduce((s, d) => s + d.days.length, 0),
      grades: [...new Set(docs.map(d => d.grade))],
      minPrice: Math.min.apply(null, docs.filter(d => d.price).map(d => d.price).concat([0])) || 0,
      maxPrice: Math.max.apply(null, docs.map(d => d.price).concat([0])),
      avgPrice: docs.filter(d => d.price).length
                ? docs.reduce((s, d) => s + d.price, 0) / docs.filter(d => d.price).length : 0,
      weeklyHours: docs.reduce((s, d) => s + d.weeklyMin, 0) / 60,
      busiestDay: DAYS.map(d => ({ d, n: docs.filter(x => x.dayNames.indexOf(d) >= 0).length }))
                      .sort((a, b) => b.n - a.n)[0],
      thinnestDay: DAYS.map(d => ({ d, n: docs.filter(x => x.dayNames.indexOf(d) >= 0).length }))
                       .sort((a, b) => a.n - b.n)[0]
    }
  };
}

/* ============================================================
   المخطّط مقابل الفعلي
   يقارن الجدول بتقارير الأداء المرفوعة (أيام عمل · إيراد · حجوزات)
   ============================================================ */
function versusActual(sch, datasets, A) {
  if (!sch || !sch.doctors.length) return null;
  const idx = {};
  sch.doctors.forEach(d => idx[d.key] = d);

  const act = {};       /* key → { rev, visits, days:Set, bookings, name } */
  const touch = (nm, f) => {
    const k = docKey(nm);
    if (!k) return null;
    const o = act[k] || (act[k] = { key: k, name: docName(nm), rev: 0, visits: 0,
                                    days: new Set(), bookings: 0, done: 0, price: [] });
    if (f) f(o);
    return o;
  };

  const REV = { statusDetail: 'total', statusSummary: 'net', receipts: 'amount',
                doctorLaser: 'collected', patientBalance: 'amount' };
  (datasets || []).forEach(ds => {
    const rows = ds.rows || [];
    if (REV[ds.id]) rows.forEach(r => touch(r.doctor, o => {
      const v = +r[REV[ds.id]] || 0;
      o.rev += v; o.visits++;
      if (typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) o.days.add(r.date);
      const p = +r.price || 0; if (p > 0) o.price.push(p);
    }));
    if (ds.id === 'doctorDays') rows.forEach(r => touch(r.doctor, o => {
      if (typeof r.date === 'string') o.days.add(r.date);
    }));
    if (ds.id === 'bookings') rows.forEach(r => touch(r.doctor, o => {
      o.bookings++;
      if (/تم|كشف|حضر|انته/.test(String(r.status || ''))) o.done++;
    }));
    if (ds.id === 'visitList') rows.forEach(r => touch(r.doctor, o => { o.visits++; }));
  });
  (A && A.doctors || []).forEach(d => touch(d.doctor, o => { o.fees = (o.fees || 0) + d.fees; }));

  const hasActual = Object.keys(act).length > 0;
  if (!hasActual) return { hasActual: false };

  /* طول الفترة بالأسابيع — حتى تُقارن أيام الجدول الأسبوعية بالأيام الفعلية */
  const allDates = [];
  Object.keys(act).forEach(k => act[k].days.forEach(d => allDates.push(d)));
  allDates.sort();
  const span = allDates.length
    ? (new Date(allDates[allDates.length - 1]) - new Date(allDates[0])) / 86400000 + 1 : 7;
  const weeks = Math.max(1, span / 7);
  const DOW = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const rows = sch.doctors.map(d => {
    const a = act[d.key];
    const perWeek = d.days.length;                      /* أيام الجدول في الأسبوع */
    const expected = perWeek * weeks;                   /* المتوقّع خلال الفترة */
    const worked = a ? a.days.size : 0;                 /* أيام عمل فعلية */
    const workedDow = a ? [...new Set([...a.days].map(x => {
      const dt = new Date(x); return isNaN(dt) ? null : DOW[dt.getDay()];
    }).filter(Boolean))] : [];
    const hit = d.dayNames.filter(x => workedDow.indexOf(x) >= 0);
    const off = workedDow.filter(x => d.dayNames.indexOf(x) < 0);
    const adherence = perWeek ? hit.length / perWeek : null;
    const attend = expected ? worked / expected : null;
    const avgPrice = a && a.price.length ? a.price.reduce((s, x) => s + x, 0) / a.price.length : 0;
    const rev = a ? a.rev : 0;
    return {
      name: d.name, spec: d.spec, grade: d.grade,
      plannedDays: perWeek, plannedWeekly: d.weeklyMin / 60,
      expectedDays: Math.round(expected),
      listPrice: d.price, actualPrice: avgPrice,
      priceGap: avgPrice && d.price ? (avgPrice - d.price) / d.price : null,
      workedDays: worked, workedDow, hitDays: hit, offDays: off,
      adherence, attend,
      revenue: rev, visits: a ? a.visits : 0,
      bookings: a ? a.bookings : 0, done: a ? a.done : 0,
      perPlannedDay: expected ? rev / expected : 0,
      perWorkedDay: worked ? rev / worked : 0,
      matched: !!a,
      status: !a ? 'مجدول بلا أي نشاط'
            : (rev === 0) ? 'حاضر بلا إيراد'
            : (attend !== null && attend < 0.5) ? 'حضور أقل من نصف المخطط'
            : (attend !== null && attend > 1.6) ? 'يعمل أكثر مما في الجدول'
            : (off.length && adherence !== null && adherence < 0.6) ? 'أيامه الفعلية غير أيام الجدول'
            : 'مطابق'
    };
  }).sort((a, b) => b.revenue - a.revenue);

  /* أطباء يعملون وليسوا في الجدول */
  const extra = Object.keys(act).filter(k => !idx[k])
    .map(k => ({ name: act[k].name, revenue: act[k].rev, visits: act[k].visits, days: act[k].days.size }))
    .filter(x => x.revenue > 0 || x.visits > 0)
    .sort((a, b) => b.revenue - a.revenue);

  return {
    hasActual: true, rows, extra, weeks, spanDays: Math.round(span),
    idle : rows.filter(r => !r.matched || r.revenue === 0),
    under: rows.filter(r => r.matched && r.attend !== null && r.attend < 0.5),
    over : rows.filter(r => r.matched && r.attend !== null && r.attend > 1.6),
    misfit: rows.filter(r => r.matched && r.offDays.length && r.adherence !== null && r.adherence < 0.6),
    priceGaps: rows.filter(r => r.priceGap !== null && Math.abs(r.priceGap) > 0.15)
  };
}

root.SonoSchedule = { parse, isSchedule, versusActual, summarize,
                      DAYS, stdSpec, stdDay, docKey, docName, phone, phoneOk,
                      grade, parseRange, parseRanges, hhmm, norm, key };
})(window);
