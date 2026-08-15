/* ============================================================
   render-amida.js — تاب «توزيع أرباح الأميدا»
   استثمار بمبلغ أساسي ونسبة أرباح سنوية تُصرف كل ٤ أشهر (٣ مرات
   في السنة)، ونسبة كل شريك هي نسبة مباشرة من رأس المال (جزء من
   نسبة الأرباح الكلية، مش نسبة من إجمالي الأرباح). تاب حساس —
   الوصول له يُمنح لأشخاص بعينهم من لوحة التحكم، والبيانات
   والأرشيف يُحفظوا مركزياً في Supabase فقط.
   ============================================================ */
(function (root) {
'use strict';
const C = root.SonoCharts;
const fmt = C.fmt, esc = C.esc;
const eg = v => fmt(v) + ' جنيه';
const numS = s => `<span class="num">${esc(s)}</span>`;
const PS = () => root.SonoPartnersStore;
const AM = () => root.SonoAmidaStore;

let st = null;          /* { principal, annualRate, partners:[{id,name,pct}] } */
let saveTimer = null;

function ensureRow() {
  if (!st.partners.length) st.partners.push({ id: PS().uid(), name: '', pct: '' });
}

function compute() {
  const principal = +st.principal || 0;
  const rate = +st.annualRate || 0;
  const annualTotal = principal * rate / 100;
  const periodTotal = annualTotal / 3;
  const partners = st.partners
    .filter(p => p.name && p.pct !== '' && p.pct !== null && isFinite(+p.pct))
    .map(p => {
      const pct = +p.pct;
      const annual = principal * pct / 100;
      return { name: p.name, pct, annual, period: annual / 3 };
    });
  const sumPct = partners.reduce((s, p) => s + p.pct, 0);
  return { principal, rate, annualTotal, periodTotal, partners, sumPct, diff: rate - sumPct };
}

function debSave(sb) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await AM().saveSettings(sb, st); } catch (e) { /* صامت — لن نزعج المستخدم أثناء الكتابة */ }
  }, 700);
}

/* ============================================================
   العرض
   ============================================================ */
async function render(el, ctx) {
  ctx = ctx || {};
  const sb = ctx.sb || null;
  const canWrite = ctx.canWrite !== false;

  el.innerHTML = `<p class="note">جارٍ تحميل بيانات الأميدا…</p>`;
  let loadErr = null;
  try {
    st = await AM().loadSettings(sb);
  } catch (e) {
    loadErr = e.message || String(e);
    st = { principal: 0, annualRate: 0, partners: [] };
  }
  ensureRow();
  paint(el, sb, canWrite, loadErr);
}

function paint(el, sb, canWrite, loadErr) {
  const R = compute();
  const badSum = Math.abs(R.diff) > 0.01;

  el.innerHTML = `
    ${loadErr ? `<div class="notice"><h3>تعذّر تحميل الإعداد المحفوظ</h3><ul><li><span>—</span><div>${esc(loadErr)}</div></li></ul></div>` : ''}

    <div class="card" id="amidaBox">
      <h2>إعداد الاستثمار</h2>
      <div class="note">النسبة السنوية تُصرف على ٣ دفعات (كل ٤ أشهر). نسبة كل شريك هي جزء مباشر من نسبة الأرباح الكلية — مش نسبة من إجمالي الأرباح.</div>
      <div class="frow">
        <div class="fld"><label for="amPrincipal">المبلغ الأساسي للاستثمار (جنيه)</label>
          <input type="number" id="amPrincipal" min="0" step="1000" value="${st.principal || ''}" placeholder="1000000" ${canWrite ? '' : 'disabled'}></div>
        <div class="fld narrow"><label for="amRate">نسبة الأرباح السنوية %</label>
          <input type="number" id="amRate" min="0" max="100" step="0.5" value="${st.annualRate || ''}" placeholder="35" ${canWrite ? '' : 'disabled'}></div>
      </div>

      <h2 style="margin-top:18px">توزيع النسبة على الشركاء</h2>
      <div id="amRows">${st.partners.map((p, i) => partnerRow(p, i, canWrite)).join('')}</div>
      ${canWrite ? `<button class="btn ghost sm" id="btnAddAmPartner" type="button">+ إضافة شريك</button>` : ''}

      <div class="note" style="margin-top:10px">
        مجموع نسب الشركاء: <b>${R.sumPct.toFixed(2)}%</b> من ${R.rate.toFixed(2)}%
        ${badSum
          ? (R.diff > 0
              ? ` — متبقّي <b>${R.diff.toFixed(2)}%</b> من الأرباح السنوية غير موزَّع على أي شريك.`
              : ` — <b>تحذير:</b> النسب المدخلة تتجاوز نسبة الأرباح الكلية بمقدار ${Math.abs(R.diff).toFixed(2)}%.`)
          : ' — مطابقة تماماً.'}
      </div>
    </div>

    <div class="kpis">
      <div class="kpi"><div class="lbl">إجمالي الربح السنوي</div><div class="val">${numS(fmt(R.annualTotal))}<span class="unit">جنيه</span></div></div>
      <div class="kpi k4"><div class="lbl">إجمالي التوزيعة الحالية (كل ٤ أشهر)</div><div class="val">${numS(fmt(R.periodTotal))}<span class="unit">جنيه</span></div><div class="foot">١/٣ من الربح السنوي</div></div>
      <div class="kpi k3"><div class="lbl">عدد الشركاء</div><div class="val">${numS(fmt(R.partners.length))}</div></div>
    </div>

    <div class="card" id="amidaResult">
      <h2>نصيب كل شريك</h2>
      ${R.partners.length ? `<div class="tscroll"><table>
        <thead><tr><th>الشريك</th><th>نسبته السنوية</th><th>ربحه السنوي</th><th>نصيبه من توزيعة الـ٤ أشهر</th></tr></thead>
        <tbody>${R.partners.map(p => `<tr>
          <td>${esc(p.name)}</td><td class="n">${p.pct.toFixed(2)}%</td>
          <td class="n">${fmt(p.annual)}</td><td class="n">${fmt(p.period)}</td></tr>`).join('')}
          <tr style="font-weight:700"><td>الإجمالي</td><td class="n">${R.sumPct.toFixed(2)}%</td>
            <td class="n">${fmt(R.partners.reduce((s, p) => s + p.annual, 0))}</td>
            <td class="n">${fmt(R.partners.reduce((s, p) => s + p.period, 0))}</td></tr>
        </tbody></table></div>`
        : '<p class="note">أضف شركاء بنسبهم لعرض نصيب كل واحد.</p>'}
    </div>

    ${canWrite ? `<div class="card">
      <h2>أرشفة وتصدير</h2>
      <div class="note">أرشفة هذا التوزيع تحفظه كتوزيعة فعلية بتاريخ اليوم في سجل دائم مشترك بين كل من لديه صلاحية الوصول لهذا التاب.</div>
      <div class="frow">
        <div class="fld"><label for="amNote">ملاحظة (اختياري)</label>
          <input type="text" id="amNote" placeholder="مثال: توزيعة أغسطس ٢٠٢٦"></div>
        <div class="fld narrow" style="flex:0 0 auto"><label>&nbsp;</label>
          <button class="btn sm" id="btnAmArchive" type="button">أرشفة هذا التوزيع</button></div>
        <div class="fld narrow" style="flex:0 0 auto"><label>&nbsp;</label>
          <button class="btn ghost sm" id="btnAmPdf" type="button">تصدير PDF</button></div>
        <div class="fld narrow" style="flex:0 0 auto"><label>&nbsp;</label>
          <button class="btn ghost sm" id="btnAmXlsx" type="button">تصدير Excel</button></div>
      </div>
      <div id="amMsg"></div>
    </div>` : ''}

    <div class="card">
      <div class="chead">
        <div><h2>سجل التوزيعات السابقة</h2><div class="note">مشترك بين كل من لديه صلاحية الوصول لهذا التاب</div></div>
        <button class="btn ghost sm" id="btnAmRefresh" type="button">تحديث</button>
      </div>
      <div id="amArchiveList"><p class="note">جارٍ التحميل…</p></div>
    </div>`;

  wire(el, sb, canWrite);
  loadArchive(el, sb);
}

function partnerRow(p, i, canWrite) {
  return `<div class="frow prow" data-i="${i}">
    <div class="fld"><label>${i === 0 ? 'اسم الشريك' : '&nbsp;'}</label>
      <input type="text" class="pName" value="${esc(p.name)}" placeholder="اسم الشريك" ${canWrite ? '' : 'disabled'}></div>
    <div class="fld narrow"><label>${i === 0 ? 'نسبته %' : '&nbsp;'}</label>
      <input type="number" class="pPct" min="0" max="100" step="0.5" value="${p.pct === '' ? '' : p.pct}" placeholder="20" ${canWrite ? '' : 'disabled'}></div>
    ${canWrite ? `<div class="fld narrow" style="flex:0 0 auto"><label>&nbsp;</label>
      <button class="btn ghost sm btnDelP" type="button" title="حذف">حذف</button></div>` : ''}
  </div>`;
}

function wire(el, sb, canWrite) {
  if (!canWrite) return;
  const principalEl = el.querySelector('#amPrincipal'), rateEl = el.querySelector('#amRate');
  const reflow = () => { st.principal = principalEl.value === '' ? '' : +principalEl.value;
                          st.annualRate = rateEl.value === '' ? '' : +rateEl.value;
                          debSave(sb); paint(el, sb, canWrite, null); };
  principalEl.addEventListener('input', reflow);
  rateEl.addEventListener('input', reflow);

  el.querySelectorAll('.prow').forEach(row => {
    const i = +row.dataset.i;
    row.querySelector('.pName').addEventListener('input', e => { st.partners[i].name = e.target.value; debSave(sb); });
    row.querySelector('.pPct').addEventListener('input', e => {
      st.partners[i].pct = e.target.value === '' ? '' : +e.target.value; debSave(sb); paint(el, sb, canWrite, null);
    });
    const del = row.querySelector('.btnDelP');
    if (del) del.addEventListener('click', () => {
      st.partners.splice(i, 1); ensureRow(); debSave(sb); paint(el, sb, canWrite, null);
    });
  });

  const addBtn = el.querySelector('#btnAddAmPartner');
  if (addBtn) addBtn.addEventListener('click', () => {
    st.partners.push({ id: PS().uid(), name: '', pct: '' }); debSave(sb); paint(el, sb, canWrite, null);
  });

  const msg = el.querySelector('#amMsg');
  const say = (text, ok) => { if (msg) msg.innerHTML = `<p class="note" style="color:${ok ? 'var(--moss)' : 'var(--clay)'}">${esc(text)}</p>`; };

  const archBtn = el.querySelector('#btnAmArchive');
  if (archBtn) archBtn.addEventListener('click', async () => {
    const R = compute();
    if (!R.partners.length) { say('أضف شريكاً واحداً على الأقل قبل الأرشفة.', false); return; }
    archBtn.disabled = true;
    try {
      const AU = root.SonoAuth;
      const u = AU ? AU.user() : null;
      await AM().addArchive(sb, {
        principal: R.principal, annualRate: R.rate,
        partners: R.partners.map(p => ({ name: p.name, pct: p.pct, annual: p.annual, period: p.period })),
        periodTotal: R.periodTotal, annualTotal: R.annualTotal,
        note: el.querySelector('#amNote').value.trim(), createdBy: u ? (u.name || u.email) : ''
      });
      say('تمت الأرشفة بنجاح.', true);
      loadArchive(el, sb);
    } catch (e) { say(e.message || String(e), false); }
    finally { archBtn.disabled = false; }
  });

  const pdfBtn = el.querySelector('#btnAmPdf');
  if (pdfBtn) pdfBtn.addEventListener('click', async () => {
    const R = compute();
    if (!root.SonoExport) { say('وحدة التصدير غير محمّلة.', false); return; }
    pdfBtn.disabled = true;
    try {
      await root.SonoExport.toPdfFromNodes([el.querySelector('#amidaResult')], {
        clinic: 'توزيع أرباح الأميدا', branch: '',
        section: `استثمار ${fmt(R.principal)} جنيه — ${R.rate}% سنوياً`,
        range: 'توزيعة كل ٤ أشهر: ' + eg(R.periodTotal),
        fileName: `توزيع-أرباح-الأميدا-${new Date().toISOString().slice(0, 10)}.pdf`
      });
    } catch (e) { say(e.message || String(e), false); }
    finally { pdfBtn.disabled = false; }
  });

  const xlsxBtn = el.querySelector('#btnAmXlsx');
  if (xlsxBtn) xlsxBtn.addEventListener('click', () => {
    try { exportXlsx(compute()); } catch (e) { say(e.message || String(e), false); }
  });

  const refreshBtn = el.querySelector('#btnAmRefresh');
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadArchive(el, sb));
}

function exportXlsx(R) {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const rows = [
    ['توزيع أرباح الأميدا'],
    ['المبلغ الأساسي للاستثمار', R.principal],
    ['نسبة الأرباح السنوية %', R.rate],
    ['إجمالي الربح السنوي', R.annualTotal],
    ['إجمالي التوزيعة الحالية (كل ٤ أشهر)', R.periodTotal],
    ['تاريخ التصدير', new Date().toLocaleString('ar-EG')], [],
    ['الشريك', 'نسبته السنوية %', 'ربحه السنوي', 'نصيبه من توزيعة الـ٤ أشهر'],
    ...R.partners.map(p => [p.name, p.pct, p.annual, p.period])
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [26, 16, 18, 22].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'توزيع الأميدا');
  XLSX.writeFile(wb, `توزيع-أرباح-الأميدا-${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
}

async function loadArchive(el, sb) {
  const box = el.querySelector('#amArchiveList');
  if (!box) return;
  try {
    const rows = await AM().listArchive(sb);
    if (!rows.length) { box.innerHTML = '<p class="note">لا توجد توزيعات مؤرشفة بعد.</p>'; return; }
    box.innerHTML = `<div class="tscroll"><table>
      <thead><tr><th>التاريخ</th><th>المبلغ الأساسي</th><th>النسبة السنوية</th><th>إجمالي التوزيعة</th><th>ملاحظة</th><th>بواسطة</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${esc(new Date(r.created_at).toLocaleDateString('ar-EG'))}</td>
        <td class="n">${fmt(r.principal)}</td><td class="n">${(+r.annual_rate).toFixed(2)}%</td>
        <td class="n">${fmt(r.period_total)}</td><td>${esc(r.note || '—')}</td><td>${esc(r.created_by || '—')}</td>
      </tr>`).join('')}</tbody></table></div>`;
  } catch (e) {
    box.innerHTML = `<p class="note" style="color:var(--clay)">${esc(e.message || String(e))}</p>`;
  }
}

root.SonoRenderAmida = { render };
})(window);
