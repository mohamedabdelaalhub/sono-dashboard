/* ============================================================
   parser-pdf.js — قراءة تقارير PDF
   يستخرج النص بإحداثياته ويعيد بناء الصفوف والأعمدة،
   ثم يمرّرها على نفس منطق التعرّف المستخدم مع الإكسل.
   ملاحظة: ملفات PDF الممسوحة ضوئياً (صور) لا تحتوي نصاً
   ولا يمكن قراءتها بدون OCR — وتظهر رسالة واضحة بذلك.
   ============================================================ */
(function (root) {
'use strict';
const P = () => root.SonoParser;

const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let libPromise = null;
function loadLib() {
  if (root.pdfjsLib) return Promise.resolve(root.pdfjsLib);
  if (libPromise) return libPromise;
  libPromise = new Promise((res, rej) => {
    let done = false;
    const finish = (ok, e) => { if (done) return; done = true; ok ? res(root.pdfjsLib) : rej(e); };
    const s = document.createElement('script');
    s.src = PDFJS_SRC;
    s.onload = () => {
      if (root.pdfjsLib) { root.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC; finish(true); }
      else finish(false, new Error('لم تُحمّل مكتبة قراءة PDF بشكل صحيح.'));
    };
    s.onerror = () => finish(false, new Error('تعذّر تحميل مكتبة قراءة PDF. تأكد من الإنترنت.'));
    document.head.appendChild(s);
    setTimeout(() => finish(false, new Error('انتهت مهلة تحميل مكتبة قراءة PDF.')), 20000);
  });
  return libPromise;
}

/* ============================================================
   استخراج الصفوف: نجمّع القطع النصية حسب إحداثي y ثم نرتّبها بـ x
   الورقة عربية RTL فنرتّب من الأكبر x إلى الأصغر.
   ============================================================ */
async function extractRows(buf) {
  const pdfjsLib = await loadLib();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages = [];
  let charCount = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items
      .filter(i => i.str && i.str.trim())
      .map(i => ({ s: i.str.trim(), x: i.transform[4], y: Math.round(i.transform[5]) }));
    charCount += items.reduce((n, i) => n + i.s.length, 0);
    if (!items.length) { pages.push([]); continue; }

    /* ١) اجمع في صفوف بتسامح رأسي 3 نقاط */
    const buckets = [];
    items.forEach(it => {
      let b = buckets.find(x => Math.abs(x.y - it.y) <= 3);
      if (!b) { b = { y: it.y, cells: [] }; buckets.push(b); }
      b.cells.push(it);
    });
    buckets.sort((a, b) => b.y - a.y);

    /* ٢) استخرج أعمدة الصفحة بتجميع إحداثيات x المتقاربة.
       بدون هذه الخطوة تنزلق الأعمدة كلما كانت خانة فارغة. */
    const xs = items.map(i => i.x).sort((a, b) => a - b);
    const TOL = 12;
    const cols = [];
    xs.forEach(x => {
      const c = cols[cols.length - 1];
      if (c && x - c.last <= TOL) { c.sum += x; c.n++; c.last = x; c.c = c.sum / c.n; }
      else cols.push({ sum: x, n: 1, last: x, c: x });
    });
    /* الورقة عربية RTL: العمود الأول هو الأيمن (أكبر x) */
    const centers = cols.map(c => c.c).sort((a, b) => b - a);

    /* ٣) ضع كل خلية في عمودها حسب أقرب مركز */
    pages.push(buckets.map(b => {
      const row = new Array(centers.length).fill('');
      b.cells.forEach(cell => {
        let best = 0, bd = Infinity;
        centers.forEach((c, i) => { const d = Math.abs(c - cell.x); if (d < bd) { bd = d; best = i; } });
        row[best] = row[best] ? row[best] + ' ' + cell.s : cell.s;
      });
      /* احذف الأعمدة الفارغة من نهاية الصف فقط */
      let end = row.length; while (end > 0 && row[end - 1] === '') end--;
      return row.slice(0, end);
    }));
  }
  await doc.destroy();
  return { pages, charCount, numPages: doc.numPages };
}

/* ============================================================
   المحلّل
   ============================================================ */
async function parse(buf, fileName) {
  const { pages, charCount, numPages } = await extractRows(buf);

  if (charCount < 40) {
    const e = new Error(
      `«${fileName}» ملف PDF ممسوح ضوئياً (صورة) ولا يحتوي نصاً قابلاً للقراءة.\n` +
      'الحل: صدّر التقرير من نظام المركز بصيغة Excel أو PDF نصّي بدل الطباعة والمسح.');
    e.scanned = true;
    throw e;
  }

  /* صفوف كل الصفحات معاً — كل صف مصفوفة خلايا مثل شيت إكسل */
  const rows = [].concat(...pages);

  /* جرّب قارئ بيان الحالة أولاً ثم قارئ الخزينة، بنفس منطق الإكسل */
  const fakeWb = toWorkbook(rows, fileName);

  if (root.SonoStatusParser) {
    const st = root.SonoStatusParser.parse(fakeWb, fileName);
    if (st && st.rows.length) return { kind: 'status', status: st.rows, period: st.period,
                                       warnings: st.warnings, numPages };
  }
  const tr = P().parseWorkbook(fakeWb, fileName);
  if (tr.income.length || tr.expense.length)
    return { kind: 'treasury', income: tr.income, expense: tr.expense,
             warnings: tr.warnings, numPages };

  return { kind: 'unknown', rows, numPages, sample: rows.slice(0, 25) };
}

/* يلفّ الصفوف في كائن يشبه مصنّف إكسل ليعمل معه نفس القارئ */
function toWorkbook(rows, name) {
  const ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.slice()));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (name || 'PDF').slice(0, 28));
  return wb;
}

root.SonoPdfParser = { parse, extractRows, loadLib };
})(window);
