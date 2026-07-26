/* ============================================================
   app.js — الربط: الهبوط · الدخول · الصلاحيات · الملفات · التابات · التصدير
   ============================================================ */
(function (root) {
'use strict';
const CFG = root.SONO_CONFIG || {};
const P = root.SonoParser, AN = root.SonoAnalytics, RU = root.SonoRules,
      RD = root.SonoRender, EX = root.SonoExport, AU = root.SonoAuth,
      RO = root.SonoRoles, ST = root.SonoSettings, AD = root.SonoAdmins;

const $ = id => document.getElementById(id);
const state = {
  files: [], income: [], expense: [],
  A: null, E: null, cmp: null, tab: 'sum',
  ctx: { clinic: CFG.clinicName || '', branch: CFG.branchName || '' }
};

/* ============================================================
   الهبوط وتسجيل الدخول
   ============================================================ */
function initLanding() {
  $('loginFoot').innerHTML = AU.mode() === 'supabase'
    ? 'محمية بـ Supabase Auth · الجلسة تنتهي تلقائياً'
    : 'وضع الحماية المحلي — للتجربة فقط.<br>فعّل Supabase من ملف <code>config.js</code> قبل النشر العام.';

  const tabIn = $('tabIn'), tabUp = $('tabUp');
  const show = up => {
    tabIn.setAttribute('aria-pressed', String(!up));
    tabUp.setAttribute('aria-pressed', String(up));
    $('loginForm').classList.toggle('hide', up);
    $('signupForm').classList.toggle('hide', !up);
    clearMsg();
  };
  tabIn.onclick = () => show(false);
  tabUp.onclick = () => show(true);

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('loginBtn');
    clearMsg(); btn.disabled = true; btn.textContent = 'جارٍ التحقق…';
    try { await AU.signIn($('email').value, $('pass').value); await enterApp(); }
    catch (ex) { showErr(ex.message || 'تعذّر تسجيل الدخول.'); $('pass').value = ''; $('pass').focus(); }
    finally { btn.disabled = false; btn.textContent = 'دخول'; }
  });

  $('signupForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('suBtn');
    clearMsg(); btn.disabled = true; btn.textContent = 'جارٍ الإنشاء…';
    try {
      const r = await AU.signUp($('suEmail').value, $('suName').value, $('suPass').value);
      if (r.needsConfirm) { showOk(r.msg); show(false); }
      else await enterApp();
    } catch (ex) { showErr(ex.message || 'تعذّر إنشاء الحساب.'); }
    finally { btn.disabled = false; btn.textContent = 'إنشاء الحساب'; }
  });

  $('btnOut').addEventListener('click', async () => { await AU.signOut(); location.reload(); });
}
function showErr(m) { const e = $('authErr'); e.textContent = m; e.classList.remove('hide'); $('authOk').classList.add('hide'); }
function showOk(m)  { const e = $('authOk');  e.textContent = m; e.classList.remove('hide'); $('authErr').classList.add('hide'); }
function clearMsg() { $('authErr').classList.add('hide'); $('authOk').classList.add('hide'); }

/* ============================================================
   الدخول للتطبيق + تطبيق الصلاحيات
   ============================================================ */
async function enterApp() {
  const u = AU.user();
  busy(true, 'جارٍ تحميل الإعدادات…');
  try { await ST.load(AU.client(), u, RO.isSuper(u)); } catch (e) {} finally { busy(false); }

  $('who').textContent = `${u.name} · ${u.role}`;
  $('landing').classList.add('hide');
  $('app').classList.remove('hide');
  $('pgFoot').innerHTML =
    `جميع المبالغ بالجنيه المصري · التحليل يتم بالكامل داخل متصفحك ولا تُرفع البيانات إلى أي خادم<br>${CFG.clinicName || ''}`;
  applyPerms();
}

function applyPerms() {
  const u = AU.user();
  $('btnAdmin').hidden = !RO.can(u, 'manageUsers');
  $('drop').classList.toggle('hide', !RO.can(u, 'upload'));
  $('tabData').classList.toggle('hide', !RO.can(u, 'data'));
  $('tabAi').classList.toggle('hide', !RO.can(u, 'useAi'));
  if (!RO.can(u, 'upload'))
    $('welcome').innerHTML = '<b>لا توجد بيانات معروضة</b>دورك الحالي «' + u.role +
      '» لا يسمح برفع الملفات. اطلب من مدير المركز رفع ملف الفترة.';
}
function gate(perm) {
  if (RO.can(AU.user(), perm)) return true;
  alert('دورك الحالي لا يسمح بهذا الإجراء.');
  return false;
}

/* ============================================================
   رفع الملفات
   ============================================================ */
function initUpload() {
  const drop = $('drop'), file = $('file');
  drop.addEventListener('click', () => { if (gate('upload')) file.click(); });
  drop.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && gate('upload')) { e.preventDefault(); file.click(); }
  });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { if (gate('upload')) handleFiles(e.dataTransfer.files); });
  file.addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });
  $('btnClear').addEventListener('click', clearAll);
}

function clearAll() {
  state.files = []; state.income = []; state.expense = []; state.A = null;
  renderChips(); $('toolbar').classList.add('hide'); $('tabs').classList.add('hide');
  document.querySelectorAll('.tabpane').forEach(p => { p.classList.add('hide'); p.innerHTML = ''; });
  $('welcome').classList.remove('hide');
  ['btnXlsx', 'btnPdf', 'btnPrint', 'btnAi'].forEach(b => $(b).disabled = true);
}

async function handleFiles(list) {
  const arr = [...list].filter(f => /\.(xlsx|xls|csv)$/i.test(f.name));
  if (!arr.length) { alert('من فضلك اختر ملف ‎.xlsx‎ أو ‎.xls‎ أو ‎.csv‎'); return; }
  busy(true, 'جارٍ قراءة الملفات…');
  const warnings = [];
  try {
    for (const f of arr) {
      if (state.files.some(x => x.name === f.name)) continue;
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: true });
      const r = P.parseWorkbook(wb, f.name);
      r.warnings.forEach(w => warnings.push(f.name + ': ' + w));
      if (!r.income.length && !r.expense.length) {
        warnings.push(`${f.name}: لم يُقرأ منه أي سطر — تأكد أن الشيت يحتوي أعمدة «التاريخ» و«السعر» و«البيان».`);
        continue;
      }
      state.files.push({ name: f.name, income: r.income, expense: r.expense });
    }
    rebuild();
    if (warnings.length) alert('ملاحظات القراءة:\n\n' + warnings.join('\n'));
  } catch (e) {
    alert('حدث خطأ أثناء قراءة الملف:\n' + (e.message || e));
  } finally { busy(false); }
}

function renderChips() {
  $('fileChips').innerHTML = state.files.map((f, i) => `
    <span class="chip">${f.name} · ${f.income.length + f.expense.length} سطر
      <button data-i="${i}" title="إزالة">×</button></span>`).join('');
  $('fileChips').querySelectorAll('button').forEach(b => b.onclick = () => {
    state.files.splice(+b.dataset.i, 1); rebuild();
  });
}

function mergeAll() {
  const seenI = new Set(), seenE = new Set(), inc = [], exp = [];
  state.files.forEach(f => {
    f.income.forEach(r => {
      const k = [r.date, r.amount, r.receipt, r.fileNo, r.services.join('|')].join('¦');
      if (seenI.has(k)) return; seenI.add(k); inc.push(r);
    });
    f.expense.forEach(r => {
      const k = [r.date, r.amount, r.bayan, r.voucher].join('¦');
      if (seenE.has(k)) return; seenE.add(k); exp.push(r);
    });
  });
  state.income = inc; state.expense = exp;
}

/* ============================================================
   الفلاتر
   ============================================================ */
function initFilters() {
  $('gran').addEventListener('change', () => { buildPeriods(); applyPeriod(); });
  $('period').addEventListener('change', applyPeriod);
  $('dFrom').addEventListener('change', applyPeriod);
  $('dTo').addEventListener('change', applyPeriod);
}

function buildPeriods() {
  const g = $('gran').value, custom = g === 'custom';
  $('grpPeriod').classList.toggle('hide', custom || g === 'all');
  $('grpFrom').classList.toggle('hide', !custom);
  $('grpTo').classList.toggle('hide', !custom);
  if (custom || g === 'all') return;
  const ps = AN.listPeriods(state.income.concat(state.expense), g);
  $('period').innerHTML = ps.map(p => `<option value="${p.key}">${p.label}</option>`).join('');
  if (ps.length) $('period').value = ps[ps.length - 1].key;
}

function currentSlice() {
  const g = $('gran').value;
  const all = { income: state.income, expense: state.expense };
  if (g === 'all') return { cur: all, prev: null, label: 'كل البيانات المرفوعة' };

  if (g === 'custom') {
    const a = $('dFrom').value, b = $('dTo').value;
    if (!a || !b) return { cur: all, prev: null, label: 'كل البيانات المرفوعة' };
    const inR = r => r.date >= a && r.date <= b;
    const days = Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
    const pb = new Date(new Date(a) - 86400000), pa = new Date(pb - (days - 1) * 86400000);
    const inP = r => r.date >= P.iso(pa) && r.date <= P.iso(pb);
    const prev = { income: state.income.filter(inP), expense: state.expense.filter(inP) };
    return { cur: { income: state.income.filter(inR), expense: state.expense.filter(inR) },
             prev: (prev.income.length || prev.expense.length) ? prev : null, label: 'فترة مخصصة' };
  }

  const key = $('period').value;
  const ps = AN.listPeriods(state.income.concat(state.expense), g).map(p => p.key);
  const idx = ps.indexOf(key);
  const inK = k => r => AN.periodKey(r.date, g) === k;
  const cur = { income: state.income.filter(inK(key)), expense: state.expense.filter(inK(key)) };
  let prev = null;
  if (idx > 0) { const pk = ps[idx - 1];
    prev = { income: state.income.filter(inK(pk)), expense: state.expense.filter(inK(pk)) }; }
  return { cur, prev, label: AN.periodLabel(key), prevLabel: idx > 0 ? AN.periodLabel(ps[idx - 1]) : null };
}

function applyPeriod() {
  if (!state.income.length && !state.expense.length) return;
  busy(true, 'جارٍ التحليل…');
  setTimeout(() => {
    try {
      const s = currentSlice();
      state.A = AN.analyze(s.cur.income, s.cur.expense, { label: s.label });
      const prevA = s.prev ? AN.analyze(s.prev.income, s.prev.expense, {}) : null;
      state.cmp = AN.compare(state.A, prevA);
      state.E = RU.evaluate(state.A, state.cmp);
      $('cmpLbl').textContent = s.prevLabel ? 'مقابل ' + s.prevLabel
        : (s.prev ? 'مقابل الفترة السابقة' : 'لا توجد فترة سابقة للمقارنة');
      $('cRisk').textContent = state.E.risks.length;
      $('cRec').textContent  = state.E.recos.length;
      $('cPlan').textContent = state.E.plan.length;
      const u = AU.user();
      ['btnXlsx', 'btnPdf', 'btnPrint'].forEach(b => $(b).disabled = !RO.can(u, 'export'));
      $('btnAi').disabled = !RO.can(u, 'useAi');
      renderTab(state.tab, true);
    } catch (e) {
      console.error(e);
      alert('تعذّر تحليل البيانات: ' + (e.message || e));
    } finally { busy(false); }
  }, 30);
}

function rebuild() {
  renderChips();
  if (!state.files.length) { clearAll(); return; }
  mergeAll();
  $('welcome').classList.add('hide');
  $('toolbar').classList.remove('hide');
  $('tabs').classList.remove('hide');
  const dates = state.income.concat(state.expense).map(r => r.date).sort();
  const span = dates.length ? (new Date(dates[dates.length - 1]) - new Date(dates[0])) / 86400000 : 0;
  $('gran').value = span > 400 ? 'quarter' : span > 45 ? 'month' : span > 10 ? 'week' : 'all';
  buildPeriods();
  applyPeriod();
}

/* ============================================================
   التابات
   ============================================================ */
const PANES = { sum: 'pane-sum', kpi: 'pane-kpi', risk: 'pane-risk', rec: 'pane-rec',
                plan: 'pane-plan', ai: 'pane-ai', data: 'pane-data' };
const RENDERED = {};

function initTabs() {
  document.querySelectorAll('nav.tabs button').forEach(b =>
    b.addEventListener('click', () => renderTab(b.dataset.t)));
}

function renderTab(t, force) {
  const u = AU.user();
  if (t === 'data' && !RO.can(u, 'data')) t = 'sum';
  if (t === 'ai'   && !RO.can(u, 'useAi')) t = 'sum';
  state.tab = t;
  document.querySelectorAll('nav.tabs button').forEach(b =>
    b.setAttribute('aria-selected', b.dataset.t === t ? 'true' : 'false'));
  if (force) Object.keys(RENDERED).forEach(k => delete RENDERED[k]);
  Object.keys(PANES).forEach(k => $(PANES[k]).classList.toggle('hide', k !== t));
  if (!state.A) return;
  if (RENDERED[t]) { if (t === 'sum') RD.drawRibbon(state.A, 'd'); return; }
  draw(t, $(PANES[t]));
}

function draw(t, el) {
  ({ sum : () => RD.renderSummary(el, state.A, state.E, state.cmp),
     kpi : () => RD.renderKpi(el, state.A, state.E, state.cmp),
     risk: () => RD.renderRisks(el, state.A, state.E),
     rec : () => RD.renderRecos(el, state.A, state.E),
     plan: () => RD.renderPlan(el, state.A, state.E),
     ai  : () => RD.renderAiTab(el, state),
     data: () => RD.renderData(el, state.A, state.E) })[t]();
  RENDERED[t] = 1;
}

/* ============================================================
   التصدير ولوحة التحكم
   ============================================================ */
function initExport() {
  $('btnXlsx').addEventListener('click', () => {
    if (!state.A || !gate('export')) return;
    busy(true, 'جارٍ بناء ملف الإكسل…');
    setTimeout(() => {
      try { EX.toXlsx(state.A, state.E, state.ctx); }
      catch (e) { alert('تعذّر التصدير: ' + (e.message || e)); }
      finally { busy(false); }
    }, 30);
  });

  $('btnPdf').addEventListener('click', async () => {
    if (!state.A || !gate('export')) return;
    busy(true, 'جارٍ بناء ملف PDF…');
    try { await EX.toPdf(state.A, state.E, state.ctx, m => $('busyMsg').textContent = m); }
    catch (e) { console.error(e); alert('تعذّر إنشاء ملف PDF: ' + (e.message || e)); }
    finally { busy(false); }
  });

  $('btnPrint').addEventListener('click', () => {
    if (!state.A || !gate('export')) return;
    ['sum', 'kpi', 'risk', 'rec', 'plan'].forEach(t => {
      if (!RENDERED[t]) draw(t, $(PANES[t]));
      $(PANES[t]).classList.remove('hide');
    });
    setTimeout(() => { window.print(); renderTab(state.tab); }, 250);
  });

  $('btnAi').addEventListener('click', () => renderTab('ai'));

  $('btnAdmin').addEventListener('click', () => { if (gate('manageUsers')) AD.open(); });

  /* عند تغيير إعدادات الـ AI: أعد بناء التاب والأزرار */
  root.addEventListener('sono:ai-changed', () => {
    applyPerms();
    $('btnAi').disabled = !state.A || !RO.can(AU.user(), 'useAi');
    delete RENDERED.ai;
    if (state.tab === 'ai') renderTab('ai');
  });
}

function busy(on, msg) {
  $('busy').classList.toggle('hide', !on);
  if (msg) $('busyMsg').textContent = msg;
}

/* ============================================================
   الإقلاع
   ============================================================ */
(async function boot() {
  root.SonoBrand.mount();
  initLanding(); initUpload(); initFilters(); initTabs(); initExport(); AD.init();
  busy(true, 'جارٍ التحقق من الجلسة…');
  let u = null;
  try { u = await AU.restore(); } catch (e) {}
  busy(false);
  if (u) await enterApp();
})();
})(window);
