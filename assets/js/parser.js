/* ============================================================
   parser.js — قراءة ملف الخزينة وتحويله إلى سجلات موحّدة
   يتعامل مع: كتلتين متجاورتين (وارد/منصرف) في نفس الشيت،
   أعمدة متغيّرة المواضع، خدمات متعددة في السطر الواحد،
   وحروف عربية بصيغة Presentation Forms.
   ============================================================ */
(function (root) {
'use strict';

/* ---------- تطبيع النص العربي ---------- */
const AR_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
function normAr(s) {
  if (s === null || s === undefined) return '';
  let t = String(s);
  try { t = t.normalize('NFKC'); } catch (e) {}
  t = t.replace(AR_DIACRITICS, '')
       .replace(/ـ/g, '')                 // تطويل
       .replace(/[​-‏‪-‮﻿]/g, '')
       .replace(/[أإآٱ]/g, 'ا')
       .replace(/[ىیۍ]/g, 'ي')
       .replace(/[کڪ]/g, 'ك')
       .replace(/[گ]/g, 'ج')
       .replace(/ة/g, 'ه')
       .replace(/ؤ/g, 'و')
       .replace(/ئ/g, 'ي')
       .replace(/\s+/g, ' ')
       .trim();
  return t;
}
/* نسخة للعرض: تصلّح صيغ العرض وتنظّف المسافات دون تغيير الحروف */
function cleanAr(s) {
  if (s === null || s === undefined) return '';
  let t = String(s);
  try { t = t.normalize('NFKC'); } catch (e) {}
  return t.replace(/[​-‏‪-‮﻿]/g, '')
          .replace(/ـ/g, '')
          .replace(/\s+/g, ' ')
          .trim();
}

/* ---------- التواريخ ---------- */
function parseDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return startOfDay(v);
  if (typeof v === 'number') {                       // تسلسل إكسل
    if (v < 20000 || v > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return isNaN(d) ? null : startOfDay(d);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);      // DD-MM-YYYY
  if (m) return mk(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);          // YYYY-MM-DD
  if (m) return mk(+m[1], +m[2], +m[3]);
  const d = new Date(s);
  return isNaN(d) ? null : startOfDay(d);

  function mk(y, mo, da) {
    if (mo > 12 && da <= 12) { const t = mo; mo = da; da = t; }
    const d = new Date(y, mo - 1, da);
    return isNaN(d) ? null : d;
  }
}
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

/* ---------- الأرقام ---------- */
const AR_DIGITS = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
                    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' };
function toNum(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  let s = String(v).replace(/[٠-٩۰-۹]/g, c => AR_DIGITS[c]).replace(/[,\s٬]/g, '').replace(/[^\d.\-]/g, '');
  if (!s || s === '-' || s === '.') return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

/* ---------- قاموس ترويسات الأعمدة ---------- */
const HEAD = {
  date    : ['التاريخ', 'تاريخ'],
  amount  : ['السعر/القيمه', 'السعر / القيمه', 'السعر', 'القيمه', 'المبلغ', 'قيمه'],
  bayan   : ['البيان', 'بيان', 'الوصف'],
  notes   : ['الملاحظات', 'ملاحظات', 'ملاحظه'],
  service : ['الخدمه', 'خدمه', 'الخدمات'],
  patient : ['المريض', 'اسم المريض', 'العميل'],
  fileNo  : ['رقم الملف', 'كود المريض', 'رقم المريض'],
  receipt : ['رقم الايصال', 'الايصال', 'رقم الفاتوره'],
  branch  : ['الفرع', 'فرع'],
  seq     : ['م', 'مسلسل', 'م.']
};
function headKey(cell) {
  const t = normAr(cell).replace(/[:：]/g, '').trim();
  if (!t) return null;
  for (const k in HEAD) if (HEAD[k].some(a => normAr(a) === t)) return k;
  return null;
}

/* ---------- تحديد كتلتي الوارد والمنصرف ---------- */
const IN_MARK  = ['الوارد', 'ايرادات', 'الايرادات', 'المقبوضات'];
const OUT_MARK = ['المنصرف', 'مصروفات', 'المصروفات', 'المدفوعات'];

function scanSheet(rows) {
  /* 1) إيجاد صف الترويسة: أكثر صف يحوي مفاتيح معروفة */
  let hdrRow = -1, best = 0;
  for (let r = 0; r < Math.min(rows.length, 60); r++) {
    let n = 0;
    (rows[r] || []).forEach(c => { if (headKey(c)) n++; });
    if (n > best) { best = n; hdrRow = r; }
  }
  if (hdrRow < 0 || best < 3) return null;

  /* 2) إيجاد صف العلامات (الوارد/المنصرف) فوق الترويسة */
  let inCol = -1, outCol = -1;
  for (let r = Math.max(0, hdrRow - 6); r <= hdrRow; r++) {
    (rows[r] || []).forEach((c, i) => {
      const t = normAr(c);
      if (!t) return;
      if (inCol  < 0 && IN_MARK.some(m  => normAr(m) === t)) inCol  = i;
      if (outCol < 0 && OUT_MARK.some(m => normAr(m) === t)) outCol = i;
    });
  }

  /* 3) تقسيم الأعمدة إلى كتل: حدّ الكتلة = أول تكرار لمفتاح ترويسة */
  const width = rows.reduce((m, r) => Math.max(m, (r || []).length), 0);
  const hdr = rows[hdrRow] || [];
  const cuts = [0];
  let seen = new Set();
  for (let i = 0; i < width; i++) {
    const k = headKey(hdr[i]);
    if (!k) continue;
    if (seen.has(k)) { cuts.push(i); seen = new Set(); }
    seen.add(k);
  }
  const blocks = cuts.map((a, i) => ({ a, b: (i + 1 < cuts.length ? cuts[i + 1] - 1 : width) }));

  /* 4) خريطة الأعمدة + تحديد نوع كل كتلة */
  blocks.forEach(bl => {
    bl.map = {};
    for (let i = bl.a; i <= bl.b; i++) {
      const k = headKey(hdr[i]);
      if (k && bl.map[k] === undefined) bl.map[k] = i;
    }
    const inSide  = inCol  >= bl.a && inCol  <= bl.b;
    const outSide = outCol >= bl.a && outCol <= bl.b;
    if (inSide && !outSide)       bl.kind = 'in';
    else if (outSide && !inSide)  bl.kind = 'out';
    else bl.kind = (bl.map.service !== undefined || bl.map.patient !== undefined) ? 'in' : 'out';
  });
  /* لو كتلتان بنفس النوع ولا علامات: الكتلة ذات «الخدمة/المريض» هي الوارد */
  if (blocks.length === 2 && blocks[0].kind === blocks[1].kind) {
    const score = b => (b.map.service !== undefined ? 2 : 0) + (b.map.patient !== undefined ? 2 : 0) +
                       (b.map.fileNo !== undefined ? 1 : 0);
    const s0 = score(blocks[0]), s1 = score(blocks[1]);
    if (s0 !== s1) { blocks[s0 > s1 ? 0 : 1].kind = 'in'; blocks[s0 > s1 ? 1 : 0].kind = 'out'; }
  }
  return { hdrRow, blocks };
}

/* ---------- تصنيف المصروفات ---------- */
const EXPENSE_RULES = [
  { cat: 'أتعاب أطباء',      group: 'متغيّر', re: /^اتعاب\s*(د|دكتور|دكتوره|طبيب)?\s*\/?\s*/ , doctor: true },
  { cat: 'مرتبات وأجور',     group: 'ثابت',  re: /مرتب|رواتب|اجور|حوافز|مكافا|بدلات|تامينات اجتماعي/ },
  { cat: 'إيجارات',          group: 'ثابت',  re: /ايجار/ },
  { cat: 'كهرباء ومرافق',    group: 'شبه ثابت', re: /كهرب|مياه|غاز|تليفون|هاتف|انترنت|مرافق|فاتوره ميا/ },
  { cat: 'نظافة ومغسلة',     group: 'شبه ثابت', re: /نظاف|مغسل|غسيل مفروش|مواد تنظيف/ },
  { cat: 'مستلزمات طبية',    group: 'متغيّر', re: /مستلزم|مستهلك|ادويه|دواء|عقاقير|صيدلي/ },
  { cat: 'تحاليل وأشعة خارجية', group: 'متغيّر', re: /تحاليل خارج|اشعه خارج|معمل خارج|outsourc/i },
  { cat: 'صيانة وقطع غيار',  group: 'متغيّر', re: /صيان|قطع غيار|اصلاح/ },
  { cat: 'أدوات كتابية ومطبوعات', group: 'متغيّر', re: /ادوات كتابي|مطبوع|قرطاسي/ },
  { cat: 'دعاية وتسويق',     group: 'متغيّر', re: /دعاي|تسويق|اعلان|سوشيال|ماركيت/ },
  { cat: 'ضيافة وأخرى إدارية', group: 'متغيّر', re: /ضياف|بوفيه|اكرامي|انتقالات|مواصلات|بنزين/ },
  { cat: 'سلف ومسحوبات',     group: 'غير تشغيلي', re: /سلف|مسحوب|عهده/ },
  { cat: 'مردودات',          group: 'غير تشغيلي', re: /مردود|استرجاع|ترجيع/ },
  { cat: 'موردون وفواتير',   group: 'متغيّر', re: /مورد|فاتوره|توريد|شراء/ },
  { cat: 'ضرائب ورسوم',      group: 'ثابت',  re: /ضريب|رسوم|دمغه|تراخيص/ }
];
function classifyExpense(bayanRaw, notesRaw) {
  /* التصنيف يعتمد على «البيان» أولاً؛ الملاحظات تُستخدم فقط إذا كان البيان فارغاً،
     لأن الملاحظات تحتوي غالباً على تفاصيل الحالة وليس نوع المصروف. */
  const b = normAr(bayanRaw);
  const hay = b || normAr(notesRaw);
  if (!hay) return { cat: 'غير مصنّف', group: 'غير مصنّف', doctor: null };
  for (const r of EXPENSE_RULES) {
    if (r.re.test(hay)) {
      let doctor = null;
      if (r.doctor) {
        doctor = cleanAr(bayanRaw || notesRaw)
                 .replace(/^\s*اتعاب\s*(د|دكتور[ةه]?|طبيب)?\s*[\/.]?\s*/i, '')
                 .split(/\s+عن\s+الحال|\n/)[0].trim();
        if (!doctor) doctor = 'غير محدد';
      }
      return { cat: r.cat, group: r.group, doctor };
    }
  }
  return { cat: 'غير مصنّف', group: 'غير مصنّف', doctor: null };
}

/* ---------- تصنيف الخدمات ---------- */
const SERVICE_RULES = [
  { cat: 'أشعة وسونار',   re: /سونار|اشعه|موجات صوتي|فيلم|دوبلر|رنين|مقطعي|x-?ray|\bct\b|\bmri\b|ultrasound/i },
  { cat: 'تحاليل معملية', re: /تحليل|تحاليل|صوره دم|وظائف (كبد|كلي)|قياس سكر|سكر صائم|سكر عشوائ|هرمون|عينه|مسحه|مزرعه|زرع بول/ },
  { cat: 'أسنان',         re: /اسنان|ضرس|خلع سن|حشو|تلبيس|عصب|جير|بورسلين|لثه|تقويم|لبني/ },
  { cat: 'جلدية وتجميل',  re: /ليزر|بوتوكس|فيلر|ميزوثيرابي|ديرما|بلازما|تقشير|جلدي|سنط|شعر|نضاره|كربوكسي/ },
  { cat: 'صحة نفسية',     re: /نفسي|نفسيه|سلوكي|ادمان/ },
  { cat: 'تغذية',         re: /تغذي|حميه|رجيم|سمنه/ },
  { cat: 'علاج طبيعي',    re: /علاج طبيعي|تاهيل|تدليك|باكدج علاج|كهربي علاجي|تمارين/ },
  { cat: 'كشوفات واستشارات', re: /كشف|كشوف|استشار|متابعه|اعاده كشف/ },
  { cat: 'تمريض وإجراءات', re: /حقن|كانيول|كانول|محلول|وريد|غيار|تمريض|ضغط الدم|جبس|غرز|خراج|غسيل|شفط|قسطر|سحب|درزه|قطب|خياطه|كمادات|اكسجين|نبضه|استئصال|حساسي|نيبولايزر|بخار|جبيره|جبيرة|فك /}
];
/* أسماء التحاليل تصل غالباً بالإنجليزية — أي نص لاتيني بالكامل يُعتبر تحليلاً معملياً */
const LATIN_ONLY = /^[\x20-\x7E ]+$/;
function classifyService(name) {
  const t = normAr(name);
  if (!t) return 'غير محدد';
  for (const r of SERVICE_RULES) if (r.re.test(t)) return r.cat;
  if (LATIN_ONLY.test(t) && /[A-Za-z]{2,}/.test(t)) return 'تحاليل معملية';
  return 'خدمات أخرى';
}

/* ---------- مفردات المستهلكات (من حقل الملاحظات) ---------- */
const CONSUMABLES = [
  { item: 'كانيولا',        re: /كانيول|كانول/ },
  { item: 'سرنجة',          re: /سرنج|سرنجه|syringe/i },
  { item: 'محلول وريدي',    re: /محلول|رينجر|جلوكوز|ملح/ },
  { item: 'جهاز وريد',      re: /جهاز وريد|درب|set/i },
  { item: 'شاش وضمادات',    re: /شاش|ضماد|رباط/ },
  { item: 'لاصق طبي',       re: /لاصق|لازق|لزق|بلاستر/ },
  { item: 'قطن وكحول',      re: /قطن|كحول|سبرت|ديتول|مطهر/ },
  { item: 'قفازات',         re: /جلوفز|جلافز|قفاز|جوانت/ },
  { item: 'أمبولات وأدوية', re: /امبول|ديكسا|كيتولاك|دانست|فيال|حقنه دواء/ },
  { item: 'مشرط',           re: /مشرط|بلاده|blade/i },
  { item: 'خيوط جراحية',    re: /خيط|خيوط|قطب جراحي/ },
  { item: 'جبس',            re: /جبس|جبيره/ }
];
function mineConsumables(text) {
  const t = normAr(text);
  const out = [];
  if (!t) return out;
  CONSUMABLES.forEach(c => {
    const m = t.match(new RegExp('(\\d+)?\\s*' + c.re.source + '\\s*(\\d+)?', c.re.flags.replace('i', '') + 'i'));
    if (m) out.push({ item: c.item, qty: toNum(m[1]) || toNum(m[2]) || 1 });
  });
  return out;
}

/* ---------- المحلّل الرئيسي ---------- */
function parseWorkbook(wb, fileName) {
  const income = [], expense = [], warnings = [];
  let sheetsUsed = 0;

  wb.SheetNames.forEach(sn => {
    const ws = wb.Sheets[sn];
    if (!ws) return;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    if (!rows.length) return;
    const scan = scanSheet(rows);
    if (!scan) { warnings.push('الشيت «' + sn + '» لم يُتعرَّف على ترويسته وتم تخطّيه.'); return; }
    sheetsUsed++;

    scan.blocks.forEach(bl => {
      const m = bl.map;
      if (m.amount === undefined || m.date === undefined) return;

      for (let r = scan.hdrRow + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const amt = toNum(row[m.amount]);
        const dt  = parseDate(row[m.date]);
        if (amt === null || !dt) continue;                     // يستبعد صفوف الإجماليات
        const bayan = cleanAr(row[m.bayan]);
        if (/^الاجمال[يى]?$/.test(normAr(bayan))) continue;

        if (bl.kind === 'in') {
          const svcRaw = cleanAr(row[m.service]);
          const parts  = svcRaw ? svcRaw.split(/[,،;؛]+/).map(s => s.trim()).filter(Boolean) : [];
          const note   = cleanAr(row[m.notes]);
          income.push({
            date    : iso(dt),
            amount  : amt,
            method  : bayan || 'غير محدد',
            services: parts.length ? parts : ['غير محدد'],
            patient : cleanAr(row[m.patient]),
            fileNo  : row[m.fileNo] !== undefined && row[m.fileNo] !== null ? String(row[m.fileNo]).trim() : '',
            receipt : row[m.receipt] !== undefined && row[m.receipt] !== null ? String(row[m.receipt]).trim() : '',
            branch  : cleanAr(row[m.branch]),
            note    : note,
            supplies: mineConsumables(note),
            src     : fileName
          });
        } else {
          const note = cleanAr(row[m.notes]);
          const cl   = classifyExpense(bayan, note);
          expense.push({
            date  : iso(dt),
            amount: amt,
            bayan : bayan || '(بدون بيان)',
            note  : note,
            cat   : cl.cat,
            group : cl.group,
            doctor: cl.doctor,
            voucher: row[m.receipt] !== undefined && row[m.receipt] !== null ? String(row[m.receipt]).trim() : '',
            branch: cleanAr(row[m.branch]),
            src   : fileName
          });
        }
      }
    });
  });

  if (!income.length && !expense.length)
    warnings.push('لم يُعثر على أي سطور بيانات صالحة في هذا الملف.');
  return { income, expense, warnings, sheetsUsed };
}

root.SonoParser = {
  parseWorkbook, normAr, cleanAr, parseDate, toNum, iso,
  classifyService, classifyExpense, mineConsumables
};
})(window);
