/* ============================================================
   app.js — الربط: الهبوط · الدخول · الصلاحيات · الملفات · التابات · التصدير
   ============================================================ */
(function (root) {
'use strict';
const CFG = root.SONO_CONFIG || {};
const P = root.SonoParser, AN = root.SonoAnalytics, RU = root.SonoRules,
      RD = root.SonoRender, EX = root.SonoExport, AU = root.SonoAuth,
      RO = root.SonoRoles, ST = root.SonoSettings, AD = root.SonoAdmins;

/* عنصر وهمي آمن — لو اختفى معرّف من الصفحة لا يتوقف التطبيق كله */
const NOOP = new Proxy({}, {
  get: (t, k) => (k === 'classList' ? { add() {}, remove() {}, toggle() {}, contains: () => false }
               : k === 'style' ? {}
               : k === 'dataset' ? {}
               : k === 'textContent' || k === 'innerHTML' || k === 'value' ? ''
               : k === 'querySelectorAll' ? () => []
               : k === 'querySelector' ? () => null
               : typeof k === 'string' ? () => {} : undefined),
  set: () => true
});
const $ = id => document.getElementById(id) || (console.warn('عنصر غير موجود:', id), NOOP);
const state = {
  files: [], income: [], expense: [], status: [], datasets: [],
  A: null, E: null, cmp: null, C: null, cSources: null, tab: 'sum', schedule: null,
  tabAccess: null,   /* null = غير مقيّد (كل التابات) · وإلا مصفوفة مفاتيح التابات المسموحة */
  metaCampaigns: null, bankWithdrawals: null, metaInvoice: null,   /* تاب «التسويق والعائد» */
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
  /* الشاشات: login · signup · forgot · reset */
  const screen = which => {
    ['loginForm', 'signupForm', 'forgotForm', 'resetForm'].forEach(f =>
      $(f).classList.toggle('hide', f !== which + 'Form'));
    const onTabs = which === 'login' || which === 'signup';
    $('tabIn').parentElement.classList.toggle('hide', !onTabs);
    tabIn.setAttribute('aria-pressed', String(which === 'login'));
    tabUp.setAttribute('aria-pressed', String(which === 'signup'));
    clearMsg();
  };
  const show = up => screen(up ? 'signup' : 'login');
  tabIn.onclick = () => show(false);
  tabUp.onclick = () => show(true);
  $('toForgot').onclick    = () => screen('forgot');
  $('backToLogin').onclick = () => screen('login');

  /* نسيت كلمة السر */
  $('forgotForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('fgBtn');
    clearMsg(); btn.disabled = true; btn.textContent = 'جارٍ الإرسال…';
    try {
      await AU.sendReset($('fgEmail').value);
      showOk('لو البريد مسجّل عندنا هيوصلك رابط التعيين خلال دقيقة. راجع «الرسائل غير المرغوبة» كمان.');
      screen('login'); showOk('لو البريد مسجّل عندنا هيوصلك رابط التعيين خلال دقيقة. راجع «الرسائل غير المرغوبة» كمان.');
    } catch (ex) { showErr(ex.message); }
    finally { btn.disabled = false; btn.textContent = 'إرسال رابط التعيين'; }
  });

  /* تعيين كلمة سر جديدة بعد فتح رابط البريد */
  $('resetForm').addEventListener('submit', async e => {
    e.preventDefault();
    const a = $('rsPass').value, b = $('rsPass2').value;
    if (a !== b) { showErr('كلمتا السر غير متطابقتين.'); return; }
    const btn = $('rsBtn');
    clearMsg(); btn.disabled = true; btn.textContent = 'جارٍ الحفظ…';
    try {
      await AU.setNewPassword(a);
      showOk('تم حفظ كلمة السر. سجّل الدخول بها الآن.');
      screen('login'); showOk('تم حفظ كلمة السر الجديدة. سجّل الدخول بها الآن.');
    } catch (ex) { showErr(ex.message); }
    finally { btn.disabled = false; btn.textContent = 'حفظ كلمة السر'; }
  });

  /* فحص الاتصال */
  $('btnDiag').onclick = async () => {
    const out = $('diagOut');
    out.innerHTML = '<div class="diag">جارٍ الفحص…</div>';
    try {
      const rows = await AU.diagnose();
      out.innerHTML = `<div class="diag">${rows.map(r => `
        <div class="row"><span class="ic ${r.ok ? 'y' : 'n'}">${r.ok ? '✓' : '✕'}</span>
          <div><b>${escHtml(r.title)}</b><span>${escHtml(r.detail)}</span></div></div>`).join('')}</div>`;
    } catch (e) { out.innerHTML = `<div class="err">${escHtml(e.message)}</div>`; }
  };

  root.__sonoScreen = screen;

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

  /* قائمة المستخدم المنسدلة */
  const um = $('userMenu');
  $('btnUser').addEventListener('click', e => { e.stopPropagation(); um.classList.toggle('hide'); });
  um.addEventListener('click', () => um.classList.add('hide'));
  document.addEventListener('click', () => um.classList.add('hide'));
}
function showErr(m) { const e = $('authErr'); e.textContent = m; e.classList.remove('hide'); $('authOk').classList.add('hide'); }
function showOk(m)  { const e = $('authOk');  e.textContent = m; e.classList.remove('hide'); $('authErr').classList.add('hide'); }
function clearMsg() { $('authErr').classList.add('hide'); $('authOk').classList.add('hide'); }
function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ============================================================
   تغيير كلمة السر من داخل اللوحة
   ============================================================ */
function initPassword() {
  const close = () => $('passModal').classList.add('hide');
  $('btnPass').onclick = () => { $('passMsg').innerHTML = ''; $('passForm').reset(); $('passModal').classList.remove('hide'); };
  $('passClose').onclick = close;
  $('passModal').addEventListener('click', e => { if (e.target.id === 'passModal') close(); });

  $('passForm').addEventListener('submit', async e => {
    e.preventDefault();
    const a = $('cpPass').value, b = $('cpPass2').value;
    const msg = $('passMsg');
    if (a !== b) { msg.innerHTML = '<div class="err">كلمتا السر غير متطابقتين.</div>'; return; }
    const btn = $('cpBtn'); btn.disabled = true; btn.textContent = 'جارٍ الحفظ…';
    try {
      await AU.changePassword(a);
      msg.innerHTML = '<div class="ok">تم تغيير كلمة السر.</div>';
      $('passForm').reset();
    } catch (ex) { msg.innerHTML = `<div class="err">${escHtml(ex.message)}</div>`; }
    finally { btn.disabled = false; btn.textContent = 'حفظ'; }
  });
}

/* ============================================================
   الدخول للتطبيق + تطبيق الصلاحيات
   ============================================================ */
async function enterApp() {
  const u = AU.user();
  busy(true, 'جارٍ تحميل الإعدادات…');
  try { await ST.load(AU.client(), u, RO.isSuper(u)); } catch (e) {} finally { busy(false); }
  try {
    state.tabAccess = root.SonoTabAccess
      ? await root.SonoTabAccess.myTabs(AU.client(), u, RO.isSuper(u))
      : null;
  } catch (e) { state.tabAccess = null; }

  $('who').textContent = u.name;
  $('uav').textContent = (u.name || '؟').trim().charAt(0);
  $('uName2').textContent = u.name;
  $('uRole2').textContent = u.role;
  $('uMail2').textContent = u.email || '';
  $('landing').classList.add('hide');
  $('app').classList.remove('hide');
  $('pgFoot').innerHTML =
    `جميع المبالغ بالجنيه المصري · التحليل يتم بالكامل داخل متصفحك ولا تُرفع البيانات إلى أي خادم<br>${CFG.clinicName || ''}`;
  $('tabs').classList.remove('hide');
  applyPerms();
  loadSavedSchedule();
  if (isAmidaInvestor()) renderTab('amida');
}

function applyPerms() {
  const u = AU.user();
  $('btnAdmin').hidden = !RO.can(u, 'manageUsers');
  $('drop').classList.toggle('hide', !RO.can(u, 'upload'));
  $('tabData').classList.toggle('hide', !RO.can(u, 'data'));
  $('tabAi').classList.toggle('hide', !RO.can(u, 'useAi'));
  if (isAmidaInvestor())
    $('welcome').innerHTML = '<b>مرحباً بك</b>اضغط تاب «توزيع أرباح الأميدا» أعلى الصفحة لعرض توزيعك.';
  else if (!RO.can(u, 'upload'))
    $('welcome').innerHTML = '<b>لا توجد بيانات معروضة</b>دورك الحالي «' + u.role +
      '» لا يسمح برفع الملفات. اطلب من مدير المركز رفع ملف الفترة.';
  applyTabAccessFilter();
}

/* ---------- التحكم في التابات المسموحة لكل مستخدم ----------
   state.tabAccess = null معناها غير مقيّد (كل التابات)، وإلا مصفوفة مفاتيح.
   applyTabAccessFilter() تُخفي فقط — لا تُظهر أبداً — فهي إضافة آمنة فوق أي منطق ظهور/إخفاء موجود. */
/* تابات حساسة: مخفية افتراضياً عن الجميع (حتى لو tabAccess = null أي «غير مقيّد»)
   إلا لو السوبر أدمن، أو مُنحت صراحة لهذا المستخدم من لوحة التحكم. */
const SENSITIVE_TABS = ['amida'];
/* دور «مستثمر الأميدا»: يشوف تاب توزيع أرباح الأميدا فقط — لا شيء غيره إطلاقاً،
   بصرف النظر عن أي منح فردي من «التابات». الدور نفسه هو المنح. */
function isAmidaInvestor() { return RO.normalize((AU.user() || {}).role) === 'مستثمر الأميدا'; }
function isTabAllowed(t) {
  if (isAmidaInvestor()) return t === 'amida';
  if (SENSITIVE_TABS.includes(t)) {
    if (RO.isSuper(AU.user())) return true;
    return !!(state.tabAccess && state.tabAccess.includes(t));
  }
  if (!state.tabAccess) return true;
  return state.tabAccess.includes(t);
}
function applyTabAccessFilter() {
  document.querySelectorAll('nav.tabs button[data-t]').forEach(b => {
    if (!isTabAllowed(b.dataset.t)) b.classList.add('hide');
  });
}
function firstAllowedTab() {
  if (isAmidaInvestor()) return 'amida';
  const order = ['sum', 'kpi', 'risk', 'rec', 'plan', 'dist', 'roi', 'ai', 'sch', 'rep', 'arch', 'data'];
  return order.find(isTabAllowed) || 'sum';
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
  state.files = []; state.income = []; state.expense = []; state.status = []; state.datasets = [];
  state.adapted = null;
  state.metaCampaigns = null; state.bankWithdrawals = null; state.metaInvoice = null;
  state.A = null; state.C = null; state.cSources = null;
  $('tabCmp').classList.add('hide'); $('tabRep').classList.add('hide');
  renderChips(); $('toolbar').classList.add('hide');
  document.querySelectorAll('.tabpane').forEach(p => { p.classList.add('hide'); p.innerHTML = ''; });
  Object.keys(RENDERED).forEach(k => delete RENDERED[k]);
  $('welcome').classList.remove('hide');
  markTabs('sum'); state.tab = 'sum';
  ['btnXlsx', 'btnPdf', 'btnPrint'].forEach(b => $(b).disabled = true);
}

async function handleFiles(list) {
  const arr = [...list].filter(f => /\.(xlsx|xls|csv|pdf)$/i.test(f.name));
  if (!arr.length) { alert('من فضلك اختر ملف ‎.xlsx‎ أو ‎.xls‎ أو ‎.csv‎ أو ‎.pdf‎'); return; }
  busy(true, 'جارٍ قراءة الملفات…');
  const warnings = [];
  try {
    for (const f of arr) {
      if (state.files.some(x => x.name === f.name)) continue;
      const buf = await f.arrayBuffer();

      /* ---------- ملفات PDF ---------- */
      if (/\.pdf$/i.test(f.name)) {
        busy(true, `جارٍ قراءة ${f.name}…`);
        try {
          const r = await root.SonoPdfParser.parse(buf, f.name);
          (r.warnings || []).forEach(w => warnings.push(f.name + ': ' + w));
          if (r.kind === 'status') {
            state.files.push({ name: f.name, kind: 'status', src: 'pdf', income: [], expense: [],
                               status: r.status, period: r.period });
          } else if (r.kind === 'treasury') {
            state.files.push({ name: f.name, kind: 'treasury', src: 'pdf',
                               income: r.income, expense: r.expense, status: [] });
          } else {
            warnings.push(`${f.name}: قُرئ النص من ${r.numPages} صفحة لكن لم يُتعرَّف على شكل التقرير.\n` +
              '   جداول PDF غالباً تفقد ترتيب أعمدتها. الأفضل تصدير نفس التقرير Excel من نظام المركز.');
          }
        } catch (e) { warnings.push(e.message); }
        continue;
      }
      const wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: true });

      /* ملفات تاب «التسويق والعائد» — منفصلة تماماً عن تقارير العيادة.
         تُقرأ كنص UTF-8 صريح لتفادي مشاكل ترميز الحروف العربية داخل CSV. */
      if (/\.csv$/i.test(f.name) && root.SonoMetaParser) {
        let wbUtf = null;
        try {
          const text = new TextDecoder('utf-8').decode(buf).replace(/^﻿/, '');
          wbUtf = XLSX.read(text, { type: 'string', raw: true, cellDates: true });
        } catch (e) { wbUtf = wb; }

        const camp = root.SonoMetaParser.parseCampaigns(wbUtf, f.name);
        if (camp) {
          state.metaCampaigns = camp;
          state.files.push({ name: f.name, kind: 'report', reportId: 'metaCampaigns',
                             reportName: 'حملات Meta Ads', income: [], expense: [], status: [], rows: camp.rows.length });
          continue;
        }
        const inv = root.SonoMetaParser.parseInvoice(wbUtf, f.name);
        if (inv) {
          state.metaInvoice = inv;
          state.files.push({ name: f.name, kind: 'report', reportId: 'metaInvoice',
                             reportName: 'فاتورة Meta الرسمية', income: [], expense: [], status: [], rows: inv.rows.length });
          continue;
        }
        const bnk = root.SonoMetaParser.parseBankWithdrawals(wbUtf, f.name, 2026);
        if (bnk) {
          state.bankWithdrawals = bnk;
          state.files.push({ name: f.name, kind: 'report', reportId: 'bankWithdrawals',
                             reportName: 'كشف سحوبات إعلانات', income: [], expense: [], status: [], rows: bnk.rows.length });
          continue;
        }
      }

      /* ١) هل هو «تقرير بيان الحالة المجمع»؟ */
      /* ٠) جدول العيادات — ملف إداري مرجعي */
      const scd = root.SonoSchedule ? root.SonoSchedule.parse(wb, f.name) : null;
      if (scd) {
        state.schedule = scd;
        state.files.push({ name: f.name, kind: 'schedule', reportName: 'جدول العيادات',
                           income: [], expense: [], status: [], rows: scd.doctors.length });
        continue;
      }

      const st = root.SonoStatusParser ? root.SonoStatusParser.parse(wb, f.name) : null;
      if (st && st.rows.length) {
        st.warnings.forEach(w => warnings.push(f.name + ': ' + w));
        /* نفس الملف يُقرأ أيضاً بالمحرك العام: منه يأتي الإيراد والتحليل التشغيلي،
           بينما تتولّى قراءة «بيان الحالة» تحليل هامش الأطباء.
           الملف قد يحتوي أكثر من شيت مطابق — نقرأها كلها لا أول واحد فقط. */
        const auAllSt = root.SonoAuto ? root.SonoAuto.parseAll(wb, f.name) : [];
        auAllSt.forEach(d => state.datasets.push(d));
        const auSt = auAllSt[0] || null;
        state.files.push({ name: f.name, kind: 'status', income: [], expense: [],
                           status: st.rows, period: st.period,
                           reportId: auSt ? auSt.id : '', reportName: auSt ? auSt.name : '',
                           rows: auSt ? auSt.rows.length : st.rows.length });
        /* شيتات إضافية مطابقة داخل نفس الملف — شريحة لكل واحدة */
        auAllSt.slice(1).forEach(d => {
          state.files.push({ name: `${f.name} — ${d.sheet}`, kind: 'report', reportId: d.id,
                             reportName: d.name, income: [], expense: [], status: [], rows: d.rows.length });
        });
        continue;
      }

      /* ٢) أي تقرير معروف من نظام المركز (يتجاهل ملفات الخزينة تلقائياً)
         — نقرأ كل الشيتات المطابقة داخل نفس الملف، لا أول شيت بس */
      const auAll = root.SonoAuto ? root.SonoAuto.parseAll(wb, f.name) : [];
      if (auAll.length) {
        auAll.forEach((au, i) => {
          state.datasets.push(au);
          state.files.push({ name: i === 0 ? f.name : `${f.name} — ${au.sheet}`, kind: 'report',
                             reportId: au.id, reportName: au.name,
                             income: [], expense: [], status: [], rows: au.rows.length });
        });
        continue;
      }

      /* ٣) تقرير حركة خزينة */
      const r = P.parseWorkbook(wb, f.name);
      if (r.income.length || r.expense.length) {
        r.warnings.forEach(w => warnings.push(f.name + ': ' + w));
        state.files.push({ name: f.name, kind: 'treasury', income: r.income, expense: r.expense, status: [] });
        continue;
      }

      warnings.push(`${f.name}: لم يُتعرَّف على شكل هذا الملف.\n` +
        '   تأكد أن أسماء الأعمدة في صف واحد وبلا صفوف فارغة بينها،\n' +
        '   وأن الملف مُصدَّر من نظام المركز بلا تعديل يدوي على الترويسة.');
    }
    rebuild();
    if (warnings.length) alert('ملاحظات القراءة:\n\n' + warnings.join('\n'));
  } catch (e) {
    alert('حدث خطأ أثناء قراءة الملف:\n' + (e.message || e));
  } finally { busy(false); }
}

function renderChips() {
  $('fileChips').innerHTML = state.files.map((f, i) => `
    <span class="chip">${f.name} · ${f.kind === 'report' ? f.reportName : f.kind === 'status' ? 'بيان حالة' : 'خزينة'}${f.src === 'pdf' ? ' · PDF' : ''} · ${(f.income.length + f.expense.length) || (f.status || []).length || f.rows || 0} سطر
      <button data-i="${i}" title="إزالة">×</button></span>`).join('');
  $('fileChips').querySelectorAll('button').forEach(b => b.onclick = () => {
    state.files.splice(+b.dataset.i, 1); rebuild();
  });
}

function mergeAll() {
  const seenI = new Set(), seenE = new Set(), seenS = new Set();
  const inc = [], exp = [], sta = [];
  state.files.forEach(f => {
    (f.income || []).forEach(r => {
      const k = [r.date, r.amount, r.receipt, r.fileNo, r.services.join('|')].join('¦');
      if (seenI.has(k)) return; seenI.add(k); inc.push(r);
    });
    (f.expense || []).forEach(r => {
      const k = [r.date, r.amount, r.bayan, r.voucher].join('¦');
      if (seenE.has(k)) return; seenE.add(k); exp.push(r);
    });
    (f.status || []).forEach(r => {
      const k = [r.doctor, r.service, r.qty, r.net, r.gross].join('¦');
      if (seenS.has(k)) return; seenS.add(k); sta.push(r);
    });
  });
  /* حوّل التقارير المتعرَّف عليها إلى إيراد/مصروف قياسي */
  state.adapted = root.SonoAdapters ? root.SonoAdapters.apply(state.datasets) : { income: [], expense: [], used: [], skipped: [] };
  state.adapted.income.forEach(r => {
    const k = ['A', r.date, r.amount, r.receipt, r.fileNo, r.services.join('|')].join('¦');
    if (seenI.has(k)) return; seenI.add(k); inc.push(r);
  });
  state.adapted.expense.forEach(r => {
    const k = ['A', r.date, r.amount, r.bayan, r.voucher].join('¦');
    if (seenE.has(k)) return; seenE.add(k); exp.push(r);
  });
  state.income = inc; state.expense = exp; state.status = sta;
  /* فترة تقرير بيان الحالة — يُستخدم عند غياب بيانات الخزينة */
  state.statusPeriod = (state.files.find(f => f.period && f.period.to) || {}).period || null;
}

/* ============================================================
   الفلاتر
   ============================================================ */
function initFilters() {
  $('btnCmpPeriods').addEventListener('click', () => {
    try { compareUploadedPeriods(); }
    catch (e) { alert(e.message || e); }
  });
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
  if (!state.income.length && !state.expense.length && !(state.status || []).length
      && !((state.ins || {}).has)) return;
  busy(true, 'جارٍ التحليل…');
  setTimeout(() => {
    try {
      state.C = null; state.cSources = null;
      const s = currentSlice();
      state.A = AN.analyze(s.cur.income, s.cur.expense, { label: s.label });
      /* دمج تقرير بيان الحالة — يُنسب لكل الفترة المرفوعة */
      state.A.status = AN.analyzeStatus(state.status, state.A.doctors, {
        status  : state.statusPeriod,
        treasury: { from: state.A.meta.from, to: state.A.meta.to }
      });
      if (state.A.status && !state.A.meta.from && state.statusPeriod) {
        state.A.meta.from = state.statusPeriod.from || null;
        state.A.meta.to   = state.statusPeriod.to || null;
        if (state.A.meta.from && state.A.meta.to)
          state.A.meta.rangeLabel = AN.fmtDateAr(state.A.meta.from) + ' → ' + AN.fmtDateAr(state.A.meta.to);
      }
      const prevA = s.prev ? AN.analyze(s.prev.income, s.prev.expense, {}) : null;
      state.cmp = (state.A.kpi.revenue > 0 || state.A.kpi.cost > 0) ? AN.compare(state.A, prevA) : null;
      state.A.ins = state.ins || { has: false, modules: [], risks: [], recos: [], plan: [], blocks: [], names: [] };
      state.E = RU.evaluate(state.A, state.cmp);
      $('cmpLbl').textContent = s.prevLabel ? 'مقابل ' + s.prevLabel
        : (s.prev ? 'مقابل الفترة السابقة' : 'لا توجد فترة سابقة للمقارنة');
      state.A.dupWarn = state.dupWarn;
      $('cRisk').textContent = state.E.risks.length;
      $('cRec').textContent  = state.E.recos.length;
      $('cPlan').textContent = state.E.plan.length;
      const u = AU.user();
      ['btnXlsx', 'btnPdf', 'btnPrint'].forEach(b => $(b).disabled = !RO.can(u, 'export'));
      renderTab(state.tab, true);
    } catch (e) {
      console.error(e);
      alert('تعذّر تحليل البيانات: ' + (e.message || e));
    } finally { busy(false); }
  }, 30);
}

/* إيراد كل طبيب من التقارير التي تربط الطبيب بالمبلغ — يغذّي تحليل الإنتاجية */
function doctorRevenueMap() {
  const m = {};
  const add = (d, v) => { const k = String(d || '').trim(); if (!k || !isFinite(v)) return; m[k] = (m[k] || 0) + v; };
  const F = { statusDetail: 'total', statusSummary: 'net', receipts: 'amount',
              doctorLaser: 'collected', patientBalance: 'amount', doctorClaim: 'svcValue' };
  state.datasets.forEach(ds => {
    const f = F[ds.id];
    if (!f) return;
    (ds.rows || []).forEach(r => add(r.doctor, +r[f] || 0));
  });
  return m;
}

/* سياق تاب جدول العيادات */
function scheduleCtx() {
  const u = AU.user();
  return {
    canSave: RO.can(u, 'upload') && !!state.schedule && !state.schedule.persisted,
    vs: state.schedule && root.SonoSchedule
        ? root.SonoSchedule.versusActual(state.schedule, state.datasets, state.A) : null,
    onSave: async () => {
      await root.SonoScheduleStore.save(state.schedule, u);
      state.schedule.persisted = true;
      state.schedule.savedLabel = 'محفوظ كمرجع دائم · ' + new Date().toLocaleDateString('ar-EG');
      delete RENDERED.sch;
    },
    onPdf: () => exportPdf('tab')
  };
}

function roiCtx() {
  const statusDs = state.datasets.find(d => d.id === 'statusDetail');
  return {
    campaigns: state.metaCampaigns,
    bank: state.bankWithdrawals,
    invoice: state.metaInvoice,
    statusRows: statusDs ? statusDs.rows : []
  };
}

function amidaCtx() {
  return { sb: AU.client(), canWrite: true, isSuper: RO.isSuper(AU.user()) };
}

/* تحميل الجدول المحفوظ عند فتح التطبيق */
async function loadSavedSchedule() {
  if (!root.SonoScheduleStore) return;
  try {
    const s = await root.SonoScheduleStore.load();
    if (s && !state.schedule) { state.schedule = s; refreshScheduleTab(); }
  } catch (e) { console.warn('schedule load', e); }
}
function refreshScheduleTab() {
  const has = !!(state.schedule && state.schedule.doctors && state.schedule.doctors.length);
  $('tabSch').classList.toggle('hide', !has);
  $('cSch').textContent = has ? state.schedule.doctors.length : 0;
  delete RENDERED.sch;
  if (has) { $('tabs').classList.remove('hide'); $('welcome').classList.add('hide'); }
}

function rebuild() {
  renderChips();
  if (!state.files.length) { clearAll(); return; }
  mergeAll();

  refreshScheduleTab();

  /* تاب التقارير المرفوعة */
  const hasDs = state.datasets.length > 0;
  if (hasDs) {
    const u0 = AU.user();
    ['btnXlsx', 'btnPdf', 'btnPrint'].forEach(b => $(b).disabled = !RO.can(u0, 'export'));
  }
  $('tabRep').classList.toggle('hide', !hasDs);
  $('cRep').textContent = state.datasets.length;
  delete RENDERED.rep;

  /* تحذير الازدواج: أكثر من تقرير يصف نفس الإيراد */
  const revSrc = (state.adapted.used || []).filter(u => u.income > 0);
  state.dupWarn = revSrc.length > 1 ? revSrc.map(u => u.name) : null;

  /* التحليلات التشغيلية: محلّل مخصّص لكل نوع تقرير */
  state.ins = root.SonoInsights
    ? root.SonoInsights.build(state.datasets, { doctorRevenue: doctorRevenueMap() })
    : { modules: [], risks: [], recos: [], plan: [], blocks: [], names: [], has: false };

  /* جدول عيادات فقط بلا أي تقرير آخر */
  if (!hasDs && !state.income.length && !state.expense.length && !state.status.length
      && state.schedule) {
    $('welcome').classList.add('hide');
    $('toolbar').classList.add('hide');
    $('tabs').classList.remove('hide');
    renderTab('sch');
    return;
  }

  /* وضع المقارنة: كل ملف فترة مستقلة */
  const mode = (document.querySelector('input[name=upm]:checked') || {}).value;
  if (mode === 'compare' && state.files.filter(f => f.income.length || f.expense.length).length > 1) {
    try { compareUploadedFiles(); return; } catch (e) { alert(e.message || e); }
  }
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
                plan: 'pane-plan', dist: 'pane-dist', roi: 'pane-roi', amida: 'pane-amida',
                ai: 'pane-ai', sch: 'pane-sch', rep: 'pane-rep',
                cmp: 'pane-cmp', arch: 'pane-arch', data: 'pane-data' };
const RENDERED = {};

function initTabs() {
  document.querySelectorAll('nav.tabs button').forEach(b =>
    b.addEventListener('click', () => renderTab(b.dataset.t)));
}

function renderTab(t, force) {
  const u = AU.user();
  if (t !== 'cmp' && !isTabAllowed(t)) t = firstAllowedTab();
  if (t === 'sch') {
    state.tab = t; markTabs(t); showPane(t);
    $('welcome').classList.add('hide');
    if (!RENDERED.sch) draw('sch', $(PANES.sch));
    return;
  }
  if (t === 'rep') {
    state.tab = t; markTabs(t); showPane(t);
    $('welcome').classList.add('hide');
    if (!RENDERED.rep) {
      root.SonoRenderReports.render($(PANES.rep), state.datasets);
      root.SonoRenderReports.drawCharts($(PANES.rep), state.datasets);
      RENDERED.rep = 1;
    }
    return;
  }
  if (t === 'cmp') {
    state.tab = t; markTabs(t); showPane(t);
    $('welcome').classList.add('hide');
    if (!state.C) $(PANES.cmp).innerHTML =
      '<div class="empty"><b>لا يوجد تقرير مقارنة معروض</b>افتح تاب «الأرشيف» واختر تقريرين أو أكثر ثم اضغط «مقارنة المحدَّد».</div>';
    return;
  }
  if (t === 'arch') {
    state.tab = t; markTabs(t); showPane(t);
    $('welcome').classList.add('hide');
    draw(t, $(PANES[t]));
    return;
  }
  if (t === 'data' && !RO.can(u, 'data')) t = 'sum';
  if (t === 'ai'   && !RO.can(u, 'useAi')) t = 'sum';
  state.tab = t;
  markTabs(t);
  if (force) Object.keys(RENDERED).forEach(k => delete RENDERED[k]);
  showPane(t);
  /* تابات مستقلة عن تحليل الخزينة — لها محتواها الخاص حتى بدون رفع أي ملف */
  const NO_DATA_NEEDED = ['dist', 'roi', 'amida'];
  if (!state.A && !NO_DATA_NEEDED.includes(t)) { $('welcome').classList.remove('hide'); return; }
  $('welcome').classList.add('hide');
  if (RENDERED[t]) { if (t === 'sum') RD.drawRibbon(state.A, 'd'); return; }
  draw(t, $(PANES[t]));
}

function markTabs(t) {
  document.querySelectorAll('nav.tabs button').forEach(b =>
    b.setAttribute('aria-selected', b.dataset.t === t ? 'true' : 'false'));
  applyTabAccessFilter();
}
function showPane(t) {
  Object.keys(PANES).forEach(k => $(PANES[k]).classList.toggle('hide', k !== t));
}

/* ---------- عرض تقرير مقارنة ---------- */
function showComparison(C, sources, title) {
  state.C = C; state.cSources = sources || [];
  state.A = null; state.E = null; state.cmp = null;
  const nm = title || ('مقارنة ' + C.periods.map(p => p.label).join(' مقابل '));
  $('welcome').classList.add('hide');
  $('toolbar').classList.add('hide');
  $('tabs').classList.remove('hide');
  $('cmpLbl').textContent = nm;
  $('cRisk').textContent = C.risks.filter(r => r.persistent || r.emerged).length;
  $('cRec').textContent = '—'; $('cPlan').textContent = '—';
  $('btnXlsx').disabled = true;
  ['btnPdf', 'btnPrint'].forEach(b => $(b).disabled = !RO.can(AU.user(), 'export'));
  Object.keys(RENDERED).forEach(k => delete RENDERED[k]);
  markTabs('cmp'); showPane('cmp');
  RD.renderComparison($(PANES.cmp), C, nm, RO.can(AU.user(), 'upload')
    ? async t => { await root.SonoArchive.saveComparison(C, state.cSources, t || nm); }
    : null);
  RENDERED.cmp = 1; state.tab = 'cmp';
  $('tabCmp').classList.remove('hide');
}

/* مقارنة كل ملف مرفوع كفترة مستقلة */
function compareUploadedFiles() {
  const fs = state.files.filter(f => f.income.length || f.expense.length);
  if (fs.length < 2) throw new Error('وضع المقارنة يحتاج ملفين على الأقل بهما بيانات خزينة.');
  const loaded = fs.map(f => {
    const A = AN.analyze(f.income, f.expense, {});
    A.status = null;
    return { label: f.name.replace(/\.(xlsx|xls|csv|pdf)$/i, ''), A, E: RU.evaluate(A, null) };
  });
  showComparison(root.SonoCompare.build(loaded), loaded.map(l => l.label));
}

/* مقارنة الفترات داخل الملفات المرفوعة حالياً */
function compareUploadedPeriods() {
  const g = $('gran').value;
  if (g === 'all' || g === 'custom')
    throw new Error('اختر تقسيماً زمنياً (أسبوعي/شهري/ربع سنوي/سنوي) أولاً حتى تتكوّن فترات للمقارنة.');
  const all = state.income.concat(state.expense);
  const ps = AN.listPeriods(all, g);
  if (ps.length < 2)
    throw new Error(`الملفات المرفوعة تغطي فترة واحدة فقط بهذا التقسيم. ارفع ملفات فترات أخرى، أو غيّر التقسيم.`);
  const inK = k => r => AN.periodKey(r.date, g) === k;
  const loaded = ps.map(p => {
    const A = AN.analyze(state.income.filter(inK(p.key)), state.expense.filter(inK(p.key)), {});
    A.status = null;
    return { label: p.label, A, E: RU.evaluate(A, null) };
  });
  showComparison(root.SonoCompare.build(loaded), loaded.map(l => l.label));
}

/* ---------- الأرشيف ---------- */
function archiveHandlers() {
  return {
    save: async title => {
      if (state.C) {
        await root.SonoArchive.saveComparison(state.C, state.cSources || [], title);
        return;
      }
      if (!state.A) throw new Error('لا يوجد تقرير معروض للحفظ.');
      await root.SonoArchive.save(state.A, state.E, state.cmp,
        state.files.map(f => f.name), title);
    },

    compare: async ids => {
      if (!ids || ids.length < 2) throw new Error('اختر تقريرين على الأقل.');
      busy(true, 'جارٍ تحميل التقارير…');
      try {
        const loaded = [];
        for (const id of ids) {
          const r = await root.SonoArchive.load(id);
          if (r.comparison) throw new Error('لا يمكن مقارنة تقرير مقارنة — اختر تقارير فترات.');
          loaded.push({ label: r.title, A: r.A, E: r.E });
        }
        busy(true, 'جارٍ بناء المقارنة…');
        showComparison(root.SonoCompare.build(loaded), loaded.map(l => l.label));
      } finally { busy(false); }
    },
    open: async id => {
      busy(true, 'جارٍ فتح التقرير…');
      try {
        const r = await root.SonoArchive.load(id);
        if (r.comparison) { showComparison(r.comparison, r.sources, r.title); return; }
        state.C = null; state.cSources = null;
        state.A = r.A; state.E = r.E; state.cmp = r.cmp;
        state.archived = r.title;
        $('cRisk').textContent = r.E.risks.length;
        $('cRec').textContent  = r.E.recos.length;
        $('cPlan').textContent = r.E.plan.length;
        $('cmpLbl').textContent = 'تقرير محفوظ: ' + r.title;
        $('welcome').classList.add('hide');
        $('tabs').classList.remove('hide');
        $('toolbar').classList.add('hide');
        ['btnXlsx', 'btnPdf', 'btnPrint'].forEach(b => $(b).disabled = !RO.can(AU.user(), 'export'));
        Object.keys(RENDERED).forEach(k => delete RENDERED[k]);
        renderTab('sum');
      } catch (e) { alert('تعذّر فتح التقرير: ' + (e.message || e)); }
      finally { busy(false); }
    }
  };
}

function draw(t, el) {
  const D = {
    sum : () => RD.renderSummary(el, state.A, state.E, state.cmp),
    kpi : () => RD.renderKpi(el, state.A, state.E, state.cmp),
    risk: () => RD.renderRisks(el, state.A, state.E),
    rec : () => RD.renderRecos(el, state.A, state.E),
    plan: () => RD.renderPlan(el, state.A, state.E, state.ctx),
    dist : () => root.SonoRenderDist.render(el, state.A),
    roi  : () => root.SonoRenderRoi.render(el, roiCtx()),
    amida: () => root.SonoRenderAmida.render(el, amidaCtx()),
    ai  : () => RD.renderAiTab(el, state),
    arch: () => RD.renderArchive(el, state, archiveHandlers()),
    data: () => RD.renderData(el, state.A, state.E),
    rep : () => { root.SonoRenderReports.render(el, state.datasets);
                  root.SonoRenderReports.drawCharts(el, state.datasets); },
    sch : () => root.SonoRenderSchedule.render(el, state.schedule, scheduleCtx()),
    cmp : () => { /* يُرسم عند عرض المقارنة فقط */ }
  };
  const f = D[t];
  if (!f) return;
  f();
  RENDERED[t] = 1;
}

/* ============================================================
   التصدير ولوحة التحكم
   ============================================================ */
function initExport() {
  $('btnXlsx').addEventListener('click', () => {
    if (!gate('export')) return;
    if (!state.A && !state.datasets.length && !state.schedule) { alert('لا يوجد محتوى للتصدير.'); return; }
    busy(true, 'جارٍ بناء ملف الإكسل…');
    setTimeout(() => {
      try {
        if (state.A) EX.toXlsx(state.A, state.E, state.ctx, state.datasets);
        else if (state.datasets.length) EX.datasetsXlsx(state.datasets, state.ctx, state.ins);
        else if (state.schedule) root.SonoRenderSchedule.toXlsx();
      }
      catch (e) { console.error(e); alert('تعذّر التصدير: ' + (e.message || e)); }
      finally { busy(false); }
    }, 30);
  });

  /* ---------- قائمة تصدير PDF ---------- */
  const menu = $('pdfMenu');
  $('btnPdf').addEventListener('click', e => {
    if (!gate('export')) return;
    if (!state.A && !state.datasets.length && !state.schedule) { alert('لا يوجد محتوى للتصدير.'); return; }
    e.stopPropagation();
    menu.classList.toggle('hide');
  });
  document.addEventListener('click', () => menu.classList.add('hide'));
  menu.addEventListener('click', e => e.stopPropagation());
  menu.querySelectorAll('button').forEach(b => b.onclick = async () => {
    menu.classList.add('hide');
    await exportPdf(b.dataset.scope);
  });

  $('btnPrint').addEventListener('click', () => {
    if (!gate('export')) return;
    if (!state.A && !state.datasets.length) { alert('لا يوجد محتوى للطباعة.'); return; }
    const order = state.A ? ['sum', 'kpi', 'risk', 'rec', 'plan'] : [];
    if (state.datasets.length) order.push('rep');
    order.forEach(t => {
      if (!RENDERED[t]) draw(t, $(PANES[t]));
      $(PANES[t]).classList.remove('hide');
    });
    setTimeout(() => { window.print(); renderTab(state.tab); }, 250);
  });

  $('btnAdmin').addEventListener('click', () => { if (gate('manageUsers')) AD.open(); });

  /* عند تغيير إعدادات الـ AI: أعد بناء التاب والأزرار */
  root.addEventListener('sono:ai-changed', () => {
    applyPerms();
    delete RENDERED.ai;
    if (state.tab === 'ai') renderTab('ai');
  });
}

/* ============================================================
   تصدير PDF: التاب المعروض أو كل التابات
   ============================================================ */
const TAB_NAMES = { sch: 'جدول العيادات',
                    sum: 'ملخص التقرير', kpi: 'المؤشرات', risk: 'المخاطر', rec: 'التوصيات',
                    plan: 'خطة العمل', ai: 'التحليل الذكي', rep: 'التقارير المرفوعة',
                    data: 'البيانات التفصيلية' };
const PDF_ORDER = ['sum', 'kpi', 'risk', 'rec', 'plan', 'ai', 'sch', 'rep', 'data'];

async function exportPdf(scope) {
  /* تقرير مقارنة معروض */
  if (state.C) {
    busy(true, 'جارٍ بناء ملف PDF…');
    try {
      await EX.toPdfFromNodes([$(PANES.cmp)], {
        clinic: state.ctx.clinic, branch: state.ctx.branch,
        range: state.C.periods.map(p => p.label).join(' · '),
        section: 'تقرير مقارنة',
        fileName: 'تقرير-مقارنة-سونو.pdf',
        onProgress: m => $('busyMsg').textContent = m });
    } catch (e) { alert('تعذّر إنشاء ملف PDF: ' + (e.message || e)); }
    finally { busy(false); }
    return;
  }
  const u = AU.user();
  const ctxBase = { clinic: state.ctx.clinic, branch: state.ctx.branch,
                    range: state.A ? state.A.meta.rangeLabel : (state.datasets.length + ' تقرير مرفوع'),
                    onProgress: m => $('busyMsg').textContent = m };
  if (!state.A && !state.datasets.length && !state.schedule) { alert('لا يوجد محتوى للتصدير.'); return; }

  if (scope === 'tab') {
    const t = state.tab;
    if (t === 'arch') { alert('تاب الأرشيف ليس تقريراً — افتح تقريراً ثم صدّره.'); return; }
    const el = $(PANES[t]);
    if (!el || !el.innerHTML.trim()) { alert('لا يوجد محتوى في هذا التاب.'); return; }
    busy(true, 'جارٍ بناء ملف PDF…');
    try {
      const n = await EX.toPdfFromNodes([el], { ...ctxBase, section: TAB_NAMES[t] || '',
        fileName: `${TAB_NAMES[t] || 'تقرير'}-سونو.pdf` });
      $('busyMsg').textContent = 'تم — ' + n + ' صفحة';
    } catch (e) { console.error(e); alert('تعذّر إنشاء ملف PDF: ' + (e.message || e)); }
    finally { busy(false); }
    return;
  }

  /* كل التابات */
  busy(true, 'جارٍ تجهيز كل التابات…');
  const prevTab = state.tab;
  try {
    const nodes = [];
    for (const t of PDF_ORDER) {
      if (t === 'data' && !RO.can(u, 'data')) continue;
      if (t === 'sch') {
        if (!state.schedule) continue;
        if (!RENDERED.sch) draw('sch', $(PANES.sch));
      }
      else if (t === 'rep') {
        if (!state.datasets.length) continue;
        if (!RENDERED.rep) draw('rep', $(PANES.rep));
        $(PANES.rep).querySelectorAll('.rcard').forEach(c => c.classList.add('open'));
      }
      else if (t === 'ai') {
        /* لا نُدرج التحليل الذكي إلا إذا كان مولَّداً فعلاً */
        const has = RENDERED.ai && $(PANES.ai).querySelector('.aimd');
        if (!has) continue;
      } else if (!state.A) continue;
      else if (!RENDERED[t]) draw(t, $(PANES[t]));
      const el = $(PANES[t]);
      if (el && el.innerHTML.trim()) {
        const wrap = document.createElement('div');
        wrap.innerHTML = `<h2 style="font-family:"Hiragino Kaku","BigVesta Arabic",system-ui,Tahoma,sans-serif;font-size:19px;font-weight:800;color:var(--petrol);
          border-bottom:2px solid var(--petrol);padding-bottom:6px;margin:22px 0 12px">${TAB_NAMES[t]}</h2>`
          + el.innerHTML;
        nodes.push(wrap);
      }
    }
    if (!nodes.length) throw new Error('لا يوجد محتوى للتصدير.');
    const n = await EX.toPdfFromNodes(nodes, { ...ctxBase, section: 'التقرير الكامل',
      fileName: `التقرير-الكامل-سونو-${(state.A && state.A.meta.rangeLabel) || ''}.pdf`.replace(/[\/\\:*?"<>|]/g, '-') });
    $('busyMsg').textContent = 'تم — ' + n + ' صفحة';
  } catch (e) { console.error(e); alert('تعذّر إنشاء ملف PDF: ' + (e.message || e)); }
  finally { busy(false); renderTab(prevTab); }
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
  initLanding(); initUpload(); initFilters(); initTabs(); initExport(); initPassword(); AD.init();

  /* هل فتح المستخدم رابط تعيين كلمة السر من بريده؟ */
  if (AU.isRecovery()) {
    root.__sonoScreen('reset');
    showOk('تم التحقق من الرابط. اختر كلمة سر جديدة.');
    AU.initSupabase().catch(e => showErr(e.message));   /* بلا انتظار حتى لا تتجمّد الشاشة */
    return;
  }

  busy(true, 'جارٍ التحقق من الجلسة…');
  let u = null, err = null;
  root.SonoApp = { state, rebuild, renderTab, handleFiles, applyPeriod, exportPdf,
                   loadSavedSchedule, scheduleCtx };
  try { u = await AU.restore(); } catch (e) { err = e; }
  busy(false);
  if (u) await enterApp();
  else if (err) showErr(err.message);
})();
})(window);
