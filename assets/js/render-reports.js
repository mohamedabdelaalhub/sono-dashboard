/* ============================================================
   render-reports.js — تاب «التقارير المرفوعة»
   لكل تقرير: بطاقة تعريف تشرح فائدته لصاحب العمل،
   مؤشرات سريعة محسوبة آلياً، ومعاينة للبيانات.
   ============================================================ */
(function (root) {
'use strict';
const C = () => root.SonoCharts;
const fmt = n => (Math.abs(n) >= 1000 || Number.isInteger(n))
  ? Math.round(n).toLocaleString('en-US') : (+n).toFixed(2);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* أسماء عربية للأعمدة في المعاينة */
const LABEL = {
  date:'التاريخ', doctor:'الطبيب', patient:'المريض', fileNo:'رقم الملف', service:'الخدمة',
  qty:'الكمية', price:'السعر', discount:'الخصم', tax:'الضريبة', total:'الإجمالي',
  net:'الصافي', gross:'سعر القائمة', amount:'المبلغ', cost:'التكلفة', value:'القيمة',
  svcValue:'قيمة الخدمة', docPct:'نسبة الطبيب', docAmount:'مبلغ الطبيب',
  channel:'قناة الحجز', insurer:'شركة التأمين', rating:'التقييم', status:'الحالة',
  specialty:'التخصص', dept:'القسم', branch:'الفرع', item:'الصنف', store:'المخزن',
  group:'المجموعة', unit:'الوحدة', balance:'الرصيد', paid:'المدفوع', remaining:'المتبقي',
  method:'طريقة الدفع', revenue:'الإيراد', expense:'المصروف', fees:'الرسوم',
  receipt:'رقم الإيصال', user:'المستخدم', employee:'الموظف', received:'المستلم',
  code:'الكود', name:'الاسم', account:'الحساب', debit:'مدين', credit:'دائن',
  desc:'البيان', entryNo:'رقم القيد', center:'مركز التكلفة', clients:'عدد العملاء',
  time:'الميعاد', toTime:'إلى', fromTime:'من', phone:'التليفون', queue:'رقم الدور',
  bookingNo:'رقم الحجز', online:'أونلاين', visit:'رقم الزيارة', pkg:'العرض',
  avail:'المتاح', used:'المستخدم', left:'المتبقي', reorder:'حد الطلب', min:'الحد الأدنى',
  category:'الفئة', collected:'المحصّل', due:'المطلوب', note:'الملاحظات', barcode:'الباركود',
  nextVisit:'الزيارة القادمة', room:'الغرفة', device:'الجهاز', provider:'مقدم الخدمة'
};
const NUM = ['qty','price','discount','tax','total','net','gross','amount','cost','value',
  'svcValue','docAmount','docPct','balance','paid','remaining','revenue','expense','fees',
  'debit','credit','clients','avail','used','left','received','min','reorder','collected','due'];
const DIM = ['doctor','patient','service','item','store','channel','insurer','status',
  'specialty','dept','branch','method','user','employee','account','center','group','pkg'];

/* ---------- مؤشرات سريعة تُحسب من أي تقرير ---------- */
function quickStats(ds) {
  const rows = ds.rows || [];
  const out = [];
  if (!rows.length) return out;
  out.push({ k: 'عدد السطور', v: fmt(rows.length) });

  NUM.forEach(k => {
    if (!ds.columns.includes(k)) return;
    const vals = rows.map(r => +r[k]).filter(v => isFinite(v));
    if (!vals.length) return;
    const sum = vals.reduce((a, b) => a + b, 0);
    if (k === 'docPct') return;
    if (Math.abs(sum) < 0.001 && vals.every(v => v === 0)) {
      out.push({ k: 'إجمالي ' + (LABEL[k] || k), v: '0', warn: 'العمود موجود لكن كل قيمه صفر' });
    } else out.push({ k: 'إجمالي ' + (LABEL[k] || k), v: fmt(sum) });
  });

  DIM.forEach(k => {
    if (!ds.columns.includes(k)) return;
    const n = new Set(rows.map(r => r[k]).filter(v => v !== null && v !== '')).size;
    if (n > 1) out.push({ k: 'عدد ' + (LABEL[k] || k), v: fmt(n) });
  });

  /* نسبة الخصم إن أمكن */
  if (ds.columns.includes('discount')) {
    const base = ds.columns.includes('gross') ? 'gross' : ds.columns.includes('price') ? 'price' : null;
    if (base) {
      const d = rows.reduce((s, r) => s + (+r.discount || 0), 0);
      const g = rows.reduce((s, r) => s + (+r[base] || 0) * (base === 'price' ? (+r.qty || 1) : 1), 0);
      if (g > 0) out.push({ k: 'نسبة الخصم', v: (d / g * 100).toFixed(1) + '%' });
    }
  }
  return out;
}

/* ---------- أعلى القيم في بُعد معيّن ---------- */
function topBreak(ds) {
  const rows = ds.rows || [];
  const dim = DIM.find(k => ds.columns.includes(k) && new Set(rows.map(r => r[k])).size > 1);
  const val = ['total','net','amount','value','revenue','paid','qty','clients']
    .find(k => ds.columns.includes(k));
  if (!dim || !rows.length) return null;
  const m = new Map();
  rows.forEach(r => {
    const key = r[dim]; if (key === null || key === '') return;
    m.set(key, (m.get(key) || 0) + (val ? (+r[val] || 0) : 1));
  });
  const arr = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (arr.length < 2) return null;
  return { dim: LABEL[dim] || dim, val: val ? (LABEL[val] || val) : 'عدد السطور', rows: arr };
}

/* ============================================================
   الرسم
   ============================================================ */
function render(el, datasets) {
  if (!datasets || !datasets.length) {
    el.innerHTML = `<div class="empty"><b>لم تُرفع تقارير بعد</b>
      ارفع أي تقرير من نظام المركز — اللوحة تتعرّف عليه وتشرح لك فائدته وتستخرج مؤشراته.</div>`;
    return;
  }

  const groups = {};
  datasets.forEach(d => (groups[d.group || 'أخرى'] = groups[d.group || 'أخرى'] || []).push(d));

  el.innerHTML = `
    <div class="card">
      <h2>التقارير المرفوعة</h2>
      <div class="note">${datasets.length} تقرير من ${Object.keys(groups).length} مجال.
        اضغط أي تقرير لتفتح شرحه ومؤشراته.</div>
      <div class="rchips">${datasets.map((d, i) => `
        <button class="rchip" data-go="${i}">${esc(d.name)}
          <span>${d.empty ? 'بلا بيانات' : fmt(d.rows.length) + ' سطر'}</span></button>`).join('')}</div>
    </div>

    ${Object.keys(groups).map(g => `
      <h3 class="gsec">${esc(g)}</h3>
      ${groups[g].map(d => card(d, datasets.indexOf(d))).join('')}`).join('')}`;

  /* فتح وطي */
  el.querySelectorAll('.rhead').forEach(h => h.onclick = () => {
    const b = h.parentElement;
    b.classList.toggle('open');
  });
  el.querySelectorAll('.rchip').forEach(c => c.onclick = () => {
    const t = el.querySelectorAll('.rcard')[+c.dataset.go];
    if (t) { t.classList.add('open'); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
}

function card(ds, idx) {
  const info = ds.info || {};
  const stats = quickStats(ds);
  const top = topBreak(ds);
  const cols = ds.columns.filter(k => LABEL[k]).slice(0, 9);
  const prev = (ds.rows || []).slice(0, 8);
  const per = ds.period && ds.period.from && ds.period.to
    ? root.SonoAnalytics.fmtDateAr(ds.period.from) + ' → ' + root.SonoAnalytics.fmtDateAr(ds.period.to) : '';

  return `
  <div class="rcard ${idx === 0 ? 'open' : ''}">
    <div class="rhead">
      <div>
        <b>${esc(ds.name)}</b>
        <span>${esc(ds.file)}${per ? ' · ' + esc(per) : ''} · ${ds.empty ? 'بلا سطور بيانات' : fmt(ds.rows.length) + ' سطر'}</span>
      </div>
      <span class="rtog">▾</span>
    </div>
    <div class="rbody">
      ${info.what ? `
      <div class="rinfo">
        <div class="ri"><b>ما هذا التقرير</b><p>${esc(info.what)}</p></div>
        <div class="ri"><b>لماذا يهمّك</b><p>${esc(info.why || '')}</p></div>
        ${(info.use || []).length ? `<div class="ri"><b>كيف تستفيد منه</b>
          <ul>${info.use.map(u => `<li>${esc(u)}</li>`).join('')}</ul></div>` : ''}
        ${(info.watch || []).length ? `<div class="ri warn"><b>انتبه إلى</b>
          <ul>${info.watch.map(u => `<li>${esc(u)}</li>`).join('')}</ul></div>` : ''}
      </div>` : ''}

      ${info.privacy ? `<div class="notice" style="margin:0 0 14px">
        <h3>هذا التقرير يحتوي بيانات شخصية</h3>
        <ul><li><span>—</span><div>الأسماء والهواتف تُعرض هنا للمراجعة فقط، ولا تُحفظ في الأرشيف ولا تُرسل للذكاء الاصطناعي.</div></li></ul>
      </div>` : ''}

      ${ds.empty ? '<p class="note">هذا التقرير مرفوع لكنه لا يحتوي سطور بيانات في الفترة المختارة.</p>' : `
        <div class="rstats">${stats.map(s => `
          <div class="rstat ${s.warn ? 'warn' : ''}">
            <span>${esc(s.k)}</span><b>${esc(s.v)}</b>
            ${s.warn ? `<i>${esc(s.warn)}</i>` : ''}</div>`).join('')}</div>

        ${top ? `<div class="grid2" style="margin-top:16px">
          <div><h4 class="rsub">أعلى ${esc(top.dim)} حسب ${esc(top.val)}</h4>
            <div id="rb${idx}"></div></div>
          <div><h4 class="rsub">معاينة البيانات</h4>
            <div class="tscroll" style="max-height:260px;overflow:auto"><table>
              <thead><tr>${cols.map(c => `<th>${esc(LABEL[c])}</th>`).join('')}</tr></thead>
              <tbody>${prev.map(r => `<tr>${cols.map(c => {
                const v = r[c];
                const isNum = NUM.includes(c) && typeof v === 'number';
                return `<td class="${isNum ? 'n' : ''}">${v === null || v === '' ? '—' : esc(isNum ? fmt(v) : String(v).slice(0, 40))}</td>`;
              }).join('')}</tr>`).join('')}</tbody>
            </table></div></div>
        </div>` : ''}`}
    </div>
  </div>`;
}

/* يُستدعى بعد الرسم لملء الرسوم */
function drawCharts(el, datasets) {
  datasets.forEach((ds, i) => {
    const t = topBreak(ds);
    const host = el.querySelector('#rb' + i);
    if (t && host) C().hbars(host, t.rows.map(([k, v]) => ({ label: String(k).slice(0, 30), value: v, title: String(k) })));
  });
}

root.SonoRenderReports = { render, drawCharts, quickStats, topBreak, LABEL };
})(window);
