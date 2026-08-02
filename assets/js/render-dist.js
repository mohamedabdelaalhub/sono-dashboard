/* ============================================================
   render-dist.js — تاب «توزيع الأرباح»
   يعرض الدخل/الإيراد والمصروفات وصافي الربح من نفس تحليل الخزينة
   (state.A)، ويتيح إعداد الشركاء ونسبهم وحساب توزيع صافي الربح.
   إعدادات الشركاء تُحفظ محلياً في متصفح المستخدم فقط.
   ============================================================ */
(function (root) {
'use strict';
const C = root.SonoCharts;
const fmt = C.fmt, esc = C.esc;
const eg  = v => fmt(v) + ' جنيه';
const pc  = v => (isFinite(v) ? (v * 100).toFixed(1) : '0.0') + '%';
const numS = s => `<span class="num">${esc(s)}</span>`;

const PS = () => root.SonoPartnersStore;

/* ---------- حالة محلية للتاب ---------- */
let st = null;   /* { mode, retainPct, partners:[{id,name,pct}] } */

function ensureRow() {
  if (!st.partners.length) st.partners.push({ id: PS().uid(), name: '', pct: '' });
}

/* ============================================================
   العرض
   ============================================================ */
function render(el, A) {
  st = PS().load();
  ensureRow();

  const k = (A && A.kpi) || null;
  const fin = !!(k && (k.revenue > 0 || k.cost > 0));

  el.innerHTML = `
    ${fin ? `<div class="kpis">
      <div class="kpi">
        <div class="lbl">إجمالي الدخل / الإيراد</div>
        <div class="val">${numS(fmt(k.revenue))}<span class="unit">جنيه</span></div>
        <div class="foot">${eg(k.revPerDay)} في اليوم</div>
      </div>
      <div class="kpi k5">
        <div class="lbl">إجمالي المصروفات</div>
        <div class="val">${numS(fmt(k.cost))}<span class="unit">جنيه</span></div>
        <div class="foot">${pc(k.costRatio)} من الإيراد</div>
      </div>
      <div class="kpi k4">
        <div class="lbl">صافي الربح</div>
        <div class="val">${numS(fmt(k.net))}<span class="unit">جنيه</span></div>
        <div class="foot">هامش ${pc(k.margin)}</div>
      </div>
    </div>` : `<div class="notice">
      <h3>لا توجد بيانات إيراد أو مصروف بعد</h3>
      <ul><li><span>—</span><div>ارفع ملف الخزينة أو الدخل والمصروفات لعرض الإيراد والمصروفات وصافي الربح هنا، ثم يمكنك حساب توزيع الأرباح.</div></li></ul>
    </div>`}

    <div class="card" id="distBox">
      <h2>إعداد توزيع الأرباح</h2>
      <div class="note">حدّد طريقة التوزيع وأضف الشركاء ونسبهم، ثم اضغط «توزيع» لحساب نصيب كل شريك من صافي الربح. الإعدادات تُحفظ في هذا المتصفح تلقائياً.</div>

      <div class="frow">
        <label class="toggle" style="flex:1;min-width:220px">
          <input type="radio" name="distMode" id="modeFull" value="full" ${st.mode === 'full' ? 'checked' : ''}>
          <div><b>توزيع كامل 100%</b><span>كل صافي الربح يُوزَّع على الشركاء حسب نسبهم.</span></div>
        </label>
        <label class="toggle" style="flex:1;min-width:220px">
          <input type="radio" name="distMode" id="modeRetain" value="retain" ${st.mode === 'retain' ? 'checked' : ''}>
          <div><b>احتفاظ بنسبة قبل التوزيع</b><span>جزء من الصافي يُحجز أولاً (مثلاً للاستثمار)، والباقي يُوزَّع على الشركاء.</span></div>
        </label>
        <label class="toggle" style="flex:1;min-width:220px">
          <input type="radio" name="distMode" id="modeAmount" value="amount" ${st.mode === 'amount' ? 'checked' : ''}>
          <div><b>استقطاع مبلغ ثابت</b><span>مبلغ محدد بالجنيه يُخصم أولاً من الصافي، والباقي يُوزَّع على الشركاء.</span></div>
        </label>
      </div>

      <div class="fld narrow" id="retainFld" style="max-width:220px;${st.mode === 'retain' ? '' : 'display:none'}">
        <label for="retainPct">نسبة الاحتفاظ من الصافي %</label>
        <input type="number" id="retainPct" min="0" max="100" step="0.5" value="${st.retainPct || 0}">
      </div>

      <div class="fld narrow" id="retainAmtFld" style="max-width:220px;${st.mode === 'amount' ? '' : 'display:none'}">
        <label for="retainAmount">المبلغ المُستقطَع (جنيه)</label>
        <input type="number" id="retainAmount" min="0" step="1" value="${st.retainAmount || 0}">
      </div>

      <div class="note" style="margin-top:6px;margin-bottom:8px"><b>الشركاء ونسبة كل شريك</b></div>
      <div id="partnersRows">${st.partners.map(partnerRow).join('')}</div>

      <div class="frow" style="margin-top:2px;align-items:center">
        <button class="btn ghost sm" id="btnAddPartner" type="button">+ إضافة شريك</button>
        <span class="note" id="pctTotalNote" style="margin:0"></span>
      </div>

      <div class="frow" style="margin-top:14px">
        <button class="btn" id="btnDistribute" type="button" ${fin ? '' : 'disabled'}>توزيع</button>
      </div>
      <div id="distMsg"></div>
    </div>

    <div id="distResult"></div>
  `;

  wire(el, A);
  updateTotalNote(el);
}

function partnerRow(p) {
  return `<div class="frow prow" data-id="${esc(p.id)}" style="margin-bottom:8px">
    <div class="fld" style="flex:2;min-width:200px;margin-bottom:0">
      <input type="text" class="pName" placeholder="اسم الشريك" value="${esc(p.name || '')}">
    </div>
    <div class="fld narrow" style="min-width:120px;margin-bottom:0">
      <input type="number" class="pPct" placeholder="النسبة %" min="0" max="100" step="0.5" value="${p.pct === '' || p.pct == null ? '' : esc(String(p.pct))}">
    </div>
    <button class="btn ghost sm pDel" type="button" title="حذف الشريك">حذف</button>
  </div>`;
}

/* ============================================================
   الأحداث
   ============================================================ */
function wire(el, A) {
  const rowsEl = el.querySelector('#partnersRows');
  const retainFld = el.querySelector('#retainFld');
  const retainAmtFld = el.querySelector('#retainAmtFld');

  el.querySelectorAll('input[name=distMode]').forEach(r => r.onchange = () => {
    const checked = el.querySelector('input[name=distMode]:checked');
    st.mode = checked ? checked.value : 'full';
    retainFld.style.display = st.mode === 'retain' ? '' : 'none';
    retainAmtFld.style.display = st.mode === 'amount' ? '' : 'none';
    persist(el);
  });

  el.querySelector('#retainPct').oninput = e => {
    st.retainPct = clampPct(e.target.value);
    persist(el);
  };

  el.querySelector('#retainAmount').oninput = e => {
    const v = +e.target.value;
    st.retainAmount = isFinite(v) ? Math.max(0, v) : 0;
    persist(el);
  };

  el.querySelector('#btnAddPartner').onclick = () => {
    const p = { id: PS().uid(), name: '', pct: '' };
    st.partners.push(p);
    rowsEl.insertAdjacentHTML('beforeend', partnerRow(p));
    bindRow(rowsEl.querySelector(`.prow[data-id="${cssEsc(p.id)}"]`), el);
    const inp = rowsEl.querySelector(`.prow[data-id="${cssEsc(p.id)}"] .pName`);
    if (inp) inp.focus();
    updateTotalNote(el);
    persist(el);
  };

  rowsEl.querySelectorAll('.prow').forEach(row => bindRow(row, el));

  el.querySelector('#btnDistribute').onclick = () => doDistribute(el, A);
}

function bindRow(row, el) {
  if (!row) return;
  const id = row.dataset.id;
  const find = () => st.partners.find(p => p.id === id);
  row.querySelector('.pName').oninput = e => { const p = find(); if (p) p.name = e.target.value; persist(el); };
  row.querySelector('.pPct').oninput  = e => { const p = find(); if (p) p.pct = e.target.value === '' ? '' : clampPct(e.target.value); updateTotalNote(el); persist(el); };
  row.querySelector('.pDel').onclick  = () => {
    st.partners = st.partners.filter(p => p.id !== id);
    row.remove();
    if (!st.partners.length) {
      ensureRow();
      const rowsEl = el.querySelector('#partnersRows');
      rowsEl.insertAdjacentHTML('beforeend', partnerRow(st.partners[0]));
      bindRow(rowsEl.querySelector('.prow'), el);
    }
    updateTotalNote(el);
    persist(el);
  };
}

function clampPct(v) {
  v = +v;
  if (!isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}
function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }

function persist(el) { PS().save(st); }

function updateTotalNote(el) {
  const total = st.partners.reduce((s, p) => s + (isFinite(+p.pct) ? +p.pct : 0), 0);
  const note = el.querySelector('#pctTotalNote');
  if (!note) return;
  const off = Math.abs(total - 100) > 0.05;
  note.innerHTML = `إجمالي النسب المُدخلة: <b class="${off ? '' : ''}" style="color:${off ? 'var(--clay)' : 'var(--moss)'}">${total.toFixed(1)}%</b>${off ? ' — المفروض يساوي 100% من المبلغ القابل للتوزيع' : ' ✓'}`;
}

/* ============================================================
   الحساب والعرض
   ============================================================ */
function doDistribute(el, A) {
  const msg = el.querySelector('#distMsg');
  msg.innerHTML = '';
  const k = (A && A.kpi) || null;
  if (!k || !(k.revenue > 0 || k.cost > 0)) {
    msg.innerHTML = '<div class="err">لا توجد بيانات إيراد أو مصروف — ارفع ملف الدخل والمصروفات أولاً.</div>';
    return;
  }
  const names = st.partners.filter(p => p.name && p.name.trim());
  if (!names.length) {
    msg.innerHTML = '<div class="err">أضف شريكاً واحداً على الأقل باسمه ونسبته.</div>';
    return;
  }

  const net = k.net;
  const retainPct = st.mode === 'retain' ? clampPct(st.retainPct) : 0;
  const retainAmt = st.mode === 'amount' ? Math.max(0, +st.retainAmount || 0) : 0;
  const retained = st.mode === 'retain' ? net * (retainPct / 100)
                  : st.mode === 'amount' ? retainAmt
                  : 0;
  const distributable = net - retained;

  const rows = names.map(p => {
    const pct = isFinite(+p.pct) ? +p.pct : 0;
    return { name: p.name.trim(), pct, amount: distributable * (pct / 100) };
  });
  const totalPct = rows.reduce((s, r) => s + r.pct, 0);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const remaining = distributable - totalAmount;
  const offTotal = Math.abs(totalPct - 100) > 0.05;

  const resEl = el.querySelector('#distResult');
  resEl.innerHTML = `
    <div class="card">
      <h2>نتيجة التوزيع</h2>
      <div class="note">${st.mode === 'retain'
        ? `صافي الربح ${eg(net)} — احتفاظ ${pc(retainPct / 100)} (${eg(retained)}) — المتبقي للتوزيع ${eg(distributable)}`
        : st.mode === 'amount'
        ? `صافي الربح ${eg(net)} — استقطاع مبلغ ثابت ${eg(retainAmt)} — المتبقي للتوزيع ${eg(distributable)}`
        : `صافي الربح بالكامل قابل للتوزيع: ${eg(distributable)}`}</div>
      <div class="tscroll"><table>
        <thead><tr><th>الشريك</th><th>النسبة</th><th>النصيب</th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td>${esc(r.name)}</td>
            <td class="n">${r.pct.toFixed(1)}%</td>
            <td class="n">${numS(fmt(r.amount))} جنيه</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
      ${offTotal ? `<div class="notice" style="margin-top:14px">
        <h3>مجموع النسب ${totalPct.toFixed(1)}% وليس 100%</h3>
        <ul><li><span>—</span><div>${remaining > 0
          ? `يتبقى مبلغ غير موزَّع: <b>${eg(remaining)}</b>.`
          : `الموزَّع أكبر من المتاح بمقدار: <b>${eg(-remaining)}</b>.`}</div></li>
        <li><span>—</span><div>عدّل نسب الشركاء بحيث يكون مجموعها 100% للحصول على توزيع دقيق.</div></li></ul>
      </div>` : ''}
    </div>`;

  persist(el);
}

root.SonoRenderDist = { render };
})(window);
