/* ============================================================
   render-amida.js — تاب «توزيع أرباح الأميدا»
   استثمار بالدولار، نسبة أرباح سنوية تُصرف كل ٤ أشهر (٣ مرات
   في السنة)، نسبة كل شريك جزء مباشر من نسبة الأرباح الكلية (مش
   نسبة من إجمالي الأرباح). كل شريك يختار يستلم نصيبه بالدولار
   أو بالجنيه المصري بسعر صرف متفق عليه مسبقاً، مع استقطاع مبلغ
   ثابت من كل دولار لصالح الشركة عند التحويل للجنيه.
   تاب حساس — الوصول له يُمنح لأشخاص بعينهم أو لدور «مستثمر
   الأميدا»، والبيانات والأرشيف يُحفظوا مركزياً في Supabase فقط.

   ملحوظة تصميم مهمة: نموذج الإدخال (#amidaForm) يُبنى مرة واحدة
   فقط عند التحميل أو عند إضافة/حذف شريك. الكتابة في أي خانة
   تُحدّث الحالة وتعيد رسم منطقة النتائج (#amidaResults) فقط —
   عناصر الإدخال نفسها لا تُعاد كتابتها أبداً أثناء الكتابة، وإلا
   يفقد المتصفح تركيز الخانة بعد كل حرف (مشكلة وقعت فعلاً وأُصلحت).
   ============================================================ */
(function (root) {
'use strict';
const C = root.SonoCharts;
const fmt = C.fmt, esc = C.esc;
const eg = v => fmt(v) + ' جنيه';
const usd = v => '$' + fmt(v);
const numS = s => `<span class="num">${esc(s)}</span>`;
const PS = () => root.SonoPartnersStore;
const AM = () => root.SonoAmidaStore;

let st = null;          /* { principal, annualRate, exchangeRate, deduction, partners:[{id,name,pct,currency}] } */
let saveTimer = null;
let ctxRef = null;      /* { sb, canWrite } — محفوظة لاستخدام wire() في renderResultsOnly */

function ensureRow() {
  if (!st.partners.length) st.partners.push({ id: PS().uid(), name: '', pct: '', currency: 'usd' });
}

function compute() {
  const principal = +st.principal || 0;               /* بالدولار */
  const rate = +st.annualRate || 0;
  const annualTotalUsd = principal * rate / 100;
  const periodTotalUsd = annualTotalUsd / 3;
  const exRate = +st.exchangeRate || 0;
  const ded = +st.deduction || 0;
  const netRate = exRate - ded;

  const partners = st.partners
    .filter(p => p.name && p.pct !== '' && p.pct !== null && isFinite(+p.pct))
    .map(p => {
      const pct = +p.pct;
      const annualUsd = principal * pct / 100;
      const periodUsd = annualUsd / 3;
      const currency = p.currency === 'egp' ? 'egp' : 'usd';
      return {
        name: p.name, pct, currency, annualUsd, periodUsd,
        periodEgpGross: periodUsd * exRate,
        periodEgpDeduction: periodUsd * ded,
        periodEgpNet: periodUsd * netRate
      };
    });
  const sumPct = partners.reduce((s, p) => s + p.pct, 0);
  return { principal, rate, annualTotalUsd, periodTotalUsd, exRate, ded, netRate, partners, sumPct, diff: rate - sumPct };
}

function debSave(sb) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await AM().saveSettings(sb, st); } catch (e) { /* صامت أثناء الكتابة */ }
  }, 700);
}

/* ============================================================
   العرض
   ============================================================ */
async function render(el, ctx) {
  ctx = ctx || {};
  const sb = ctx.sb || null;
  const canWrite = ctx.canWrite !== false;
  ctxRef = { sb, canWrite };

  el.innerHTML = `<p class="note">جارٍ تحميل بيانات الأميدا…</p>`;
  let loadErr = null;
  try {
    st = await AM().loadSettings(sb);
  } catch (e) {
    loadErr = e.message || String(e);
    st = { principal: 0, annualRate: 0, exchangeRate: 75, deduction: 5, partners: [] };
  }
  ensureRow();
  paint(el, loadErr);
}

/* يبني الصفحة كاملة (نموذج + نتائج + أرشيف) — يُستدعى فقط عند: التحميل الأول،
   إضافة/حذف شريك. لا يُستدعى أبداً أثناء الكتابة في خانة نص أو رقم. */
function paint(el, loadErr) {
  const { canWrite } = ctxRef;
  el.innerHTML = `
    ${loadErr ? `<div class="notice"><h3>تعذّر تحميل الإعداد المحفوظ</h3><ul><li><span>—</span><div>${esc(loadErr)}</div></li></ul></div>` : ''}

    <div class="card" id="amidaBox">
      <h2>إعداد الاستثمار</h2>
      <div class="note">المبلغ الأساسي بالدولار. النسبة السنوية تُصرف على ٣ دفعات (كل ٤ أشهر). نسبة كل شريك جزء مباشر من نسبة الأرباح الكلية.</div>
      <div class="frow">
        <div class="fld"><label for="amPrincipal">المبلغ الأساسي للاستثمار (دولار)</label>
          <input type="number" id="amPrincipal" min="0" step="1000" value="${st.principal || ''}" placeholder="100000" ${canWrite ? '' : 'disabled'}></div>
        <div class="fld narrow"><label for="amRate">نسبة الأرباح السنوية %</label>
          <input type="number" id="amRate" min="0" max="100" step="0.5" value="${st.annualRate || ''}" placeholder="35" ${canWrite ? '' : 'disabled'}></div>
      </div>

      <h2 style="margin-top:18px">تحويل الجنيه المصري</h2>
      <div class="note">تُستخدم فقط للشركاء اللي بيختاروا يستلموا نصيبهم بالجنيه. سعر الصرف المتفق عليه، وقيمة تُخصم من كل دولار لصالح الشركة.</div>
      <div class="frow">
        <div class="fld narrow"><label for="amExRate">سعر الصرف (جنيه لكل دولار)</label>
          <input type="number" id="amExRate" min="0" step="0.5" value="${st.exchangeRate || ''}" placeholder="75" ${canWrite ? '' : 'disabled'}></div>
        <div class="fld narrow"><label for="amDed">الاستقطاع لصالح الشركة (جنيه لكل دولار)</label>
          <input type="number" id="amDed" min="0" step="0.5" value="${st.deduction || ''}" placeholder="5" ${canWrite ? '' : 'disabled'}></div>
        <div class="fld narrow"><label>&nbsp;</label>
          <div class="note" id="amNetRateNote" style="margin:0">السعر الصافي: <b>${((+st.exchangeRate || 0) - (+st.deduction || 0)).toFixed(2)}</b> جنيه/دولار</div></div>
      </div>

      <h2 style="margin-top:18px">توزيع النسبة على الشركاء</h2>
      <div id="amRows">${st.partners.map((p, i) => partnerRow(p, i, canWrite)).join('')}</div>
      ${canWrite ? `<button class="btn ghost sm" id="btnAddAmPartner" type="button">+ إضافة شريك</button>` : ''}
    </div>

    <div id="amidaResults"></div>

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

  wireForm(el);
  renderResultsOnly(el);
  loadArchive(el);
}

function partnerRow(p, i, canWrite) {
  return `<div class="frow prow" data-i="${i}">
    <div class="fld"><label>${i === 0 ? 'اسم الشريك' : '&nbsp;'}</label>
      <input type="text" class="pName" value="${esc(p.name)}" placeholder="اسم الشريك" ${canWrite ? '' : 'disabled'}></div>
    <div class="fld narrow"><label>${i === 0 ? 'نسبته %' : '&nbsp;'}</label>
      <input type="number" class="pPct" min="0" max="100" step="0.5" value="${p.pct === '' ? '' : p.pct}" placeholder="20" ${canWrite ? '' : 'disabled'}></div>
    <div class="fld narrow"><label>${i === 0 ? 'يستلم بـ' : '&nbsp;'}</label>
      <select class="pCur" ${canWrite ? '' : 'disabled'}>
        <option value="usd" ${p.currency !== 'egp' ? 'selected' : ''}>دولار</option>
        <option value="egp" ${p.currency === 'egp' ? 'selected' : ''}>جنيه مصري</option>
      </select></div>
    ${canWrite ? `<div class="fld narrow" style="flex:0 0 auto"><label>&nbsp;</label>
      <button class="btn ghost sm btnDelP" type="button" title="حذف">حذف</button></div>` : ''}
  </div>`;
}

/* ---------- نموذج الإدخال: يُوصَّل مرة واحدة فقط عند البناء ---------- */
function wireForm(el) {
  const { sb, canWrite } = ctxRef;
  if (!canWrite) return;

  const principalEl = el.querySelector('#amPrincipal'), rateEl = el.querySelector('#amRate');
  const exRateEl = el.querySelector('#amExRate'), dedEl = el.querySelector('#amDed');

  const onGlobalInput = () => {
    st.principal = principalEl.value === '' ? '' : +principalEl.value;
    st.annualRate = rateEl.value === '' ? '' : +rateEl.value;
    st.exchangeRate = exRateEl.value === '' ? '' : +exRateEl.value;
    st.deduction = dedEl.value === '' ? '' : +dedEl.value;
    const note = el.querySelector('#amNetRateNote');
    if (note) note.innerHTML = `السعر الصافي: <b>${((+st.exchangeRate || 0) - (+st.deduction || 0)).toFixed(2)}</b> جنيه/دولار`;
    debSave(sb);
    renderResultsOnly(el);
  };
  [principalEl, rateEl, exRateEl, dedEl].forEach(i => i.addEventListener('input', onGlobalInput));

  el.querySelectorAll('.prow').forEach(row => {
    const i = +row.dataset.i;
    row.querySelector('.pName').addEventListener('input', e => {
      st.partners[i].name = e.target.value; debSave(sb); renderResultsOnly(el);
    });
    row.querySelector('.pPct').addEventListener('input', e => {
      st.partners[i].pct = e.target.value === '' ? '' : +e.target.value; debSave(sb); renderResultsOnly(el);
    });
    row.querySelector('.pCur').addEventListener('change', e => {
      st.partners[i].currency = e.target.value; debSave(sb); renderResultsOnly(el);
    });
    const del = row.querySelector('.btnDelP');
    if (del) del.addEventListener('click', () => {
      st.partners.splice(i, 1); ensureRow(); debSave(sb); paint(el, null);
    });
  });

  const addBtn = el.querySelector('#btnAddAmPartner');
  if (addBtn) addBtn.addEventListener('click', () => {
    st.partners.push({ id: PS().uid(), name: '', pct: '', currency: 'usd' }); debSave(sb); paint(el, null);
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
        principal: R.principal, annualRate: R.rate, exchangeRate: R.exRate, deduction: R.ded,
        partners: R.partners.map(p => ({
          name: p.name, pct: p.pct, currency: p.currency, annualUsd: p.annualUsd, periodUsd: p.periodUsd,
          periodEgpNet: p.periodEgpNet
        })),
        periodTotal: R.periodTotalUsd, annualTotal: R.annualTotalUsd,
        note: el.querySelector('#amNote').value.trim(), createdBy: u ? (u.name || u.email) : ''
      });
      say('تمت الأرشفة بنجاح.', true);
      loadArchive(el);
    } catch (e) { say(e.message || String(e), false); }
    finally { archBtn.disabled = false; }
  });

  const pdfBtn = el.querySelector('#btnAmPdf');
  if (pdfBtn) pdfBtn.addEventListener('click', async () => {
    const R = compute();
    if (!root.SonoExport) { say('وحدة التصدير غير محمّلة.', false); return; }
    pdfBtn.disabled = true;
    try {
      await root.SonoExport.toPdfFromNodes([el.querySelector('#amidaResults')], {
        clinic: 'توزيع أرباح الأميدا', branch: '',
        section: `استثمار ${usd(R.principal)} — ${R.rate}% سنوياً`,
        range: 'توزيعة كل ٤ أشهر: ' + usd(R.periodTotalUsd),
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
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadArchive(el));
}

/* ---------- منطقة النتائج فقط: تُعاد كتابتها بحرّية أثناء الكتابة ---------- */
function renderResultsOnly(el) {
  const box = el.querySelector('#amidaResults');
  if (!box) return;
  const R = compute();
  const badSum = Math.abs(R.diff) > 0.01;

  box.innerHTML = `
    <div class="note" style="margin:4px 0 14px">
      مجموع نسب الشركاء: <b>${R.sumPct.toFixed(2)}%</b> من ${R.rate.toFixed(2)}%
      ${badSum
        ? (R.diff > 0
            ? ` — متبقّي <b>${R.diff.toFixed(2)}%</b> من الأرباح السنوية غير موزَّع على أي شريك.`
            : ` — <b>تحذير:</b> النسب المدخلة تتجاوز نسبة الأرباح الكلية بمقدار ${Math.abs(R.diff).toFixed(2)}%.`)
        : ' — مطابقة تماماً.'}
    </div>

    <div class="kpis">
      <div class="kpi"><div class="lbl">إجمالي الربح السنوي</div><div class="val">${numS(fmt(R.annualTotalUsd))}<span class="unit">دولار</span></div></div>
      <div class="kpi k4"><div class="lbl">إجمالي التوزيعة الحالية (كل ٤ أشهر)</div><div class="val">${numS(fmt(R.periodTotalUsd))}<span class="unit">دولار</span></div><div class="foot">١/٣ من الربح السنوي</div></div>
      <div class="kpi k3"><div class="lbl">عدد الشركاء</div><div class="val">${numS(fmt(R.partners.length))}</div></div>
    </div>

    <div class="card">
      <h2>نصيب كل شريك</h2>
      ${R.partners.length ? `<div class="tscroll"><table>
        <thead><tr><th>الشريك</th><th>نسبته السنوية</th><th>يستلم بـ</th><th>نصيبه من توزيعة الـ٤ أشهر (دولار)</th>
          <th>سعر الصرف المطبَّق</th><th>الاستقطاع لصالح الشركة</th><th>الصافي المستحق بالجنيه</th></tr></thead>
        <tbody>${R.partners.map(p => `<tr>
          <td>${esc(p.name)}</td><td class="n">${p.pct.toFixed(2)}%</td>
          <td>${p.currency === 'egp' ? 'جنيه مصري' : 'دولار'}</td>
          <td class="n">${usd(p.periodUsd)}</td>
          <td class="n">${p.currency === 'egp' ? R.exRate.toFixed(2) : '—'}</td>
          <td class="n">${p.currency === 'egp' ? eg(p.periodEgpDeduction) : '—'}</td>
          <td class="n">${p.currency === 'egp' ? eg(p.periodEgpNet) : '—'}</td></tr>`).join('')}
        </tbody></table></div>`
        : '<p class="note">أضف شركاء بنسبهم لعرض نصيب كل واحد.</p>'}
    </div>`;
}

function exportXlsx(R) {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const rows = [
    ['توزيع أرباح الأميدا'],
    ['المبلغ الأساسي للاستثمار (دولار)', R.principal],
    ['نسبة الأرباح السنوية %', R.rate],
    ['سعر الصرف (جنيه/دولار)', R.exRate],
    ['الاستقطاع لصالح الشركة (جنيه/دولار)', R.ded],
    ['السعر الصافي بعد الاستقطاع', R.netRate],
    ['إجمالي الربح السنوي (دولار)', R.annualTotalUsd],
    ['إجمالي التوزيعة الحالية كل ٤ أشهر (دولار)', R.periodTotalUsd],
    ['تاريخ التصدير', new Date().toLocaleString('ar-EG')], [],
    ['الشريك', 'نسبته السنوية %', 'يستلم بـ', 'نصيبه من التوزيعة (دولار)', 'الاستقطاع (جنيه)', 'الصافي بالجنيه'],
    ...R.partners.map(p => [p.name, p.pct, p.currency === 'egp' ? 'جنيه مصري' : 'دولار', p.periodUsd,
      p.currency === 'egp' ? p.periodEgpDeduction : '', p.currency === 'egp' ? p.periodEgpNet : ''])
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [26, 16, 12, 20, 16, 16].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'توزيع الأميدا');
  XLSX.writeFile(wb, `توزيع-أرباح-الأميدا-${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
}

async function loadArchive(el) {
  const { sb } = ctxRef;
  const box = el.querySelector('#amArchiveList');
  if (!box) return;
  try {
    const rows = await AM().listArchive(sb);
    if (!rows.length) { box.innerHTML = '<p class="note">لا توجد توزيعات مؤرشفة بعد.</p>'; return; }
    box.innerHTML = `<div class="tscroll"><table>
      <thead><tr><th>التاريخ</th><th>المبلغ الأساسي</th><th>النسبة السنوية</th><th>سعر الصرف</th><th>إجمالي التوزيعة</th><th>ملاحظة</th><th>بواسطة</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${esc(new Date(r.created_at).toLocaleDateString('ar-EG'))}</td>
        <td class="n">${usd(r.principal)}</td><td class="n">${(+r.annual_rate).toFixed(2)}%</td>
        <td class="n">${r.exchange_rate ? (+r.exchange_rate).toFixed(2) : '—'}</td>
        <td class="n">${usd(r.period_total)}</td><td>${esc(r.note || '—')}</td><td>${esc(r.created_by || '—')}</td>
      </tr>`).join('')}</tbody></table></div>`;
  } catch (e) {
    box.innerHTML = `<p class="note" style="color:var(--clay)">${esc(e.message || String(e))}</p>`;
  }
}

root.SonoRenderAmida = { render };
})(window);
