/* ============================================================
   إعدادات لوحة مركز عيادات سونو التخصصية
   عدّل هذا الملف وحده — باقي الملفات لا تحتاج تعديل.
   ============================================================ */

window.SONO_CONFIG = {

  /* ---------- الهوية ---------- */
  clinicName : 'مركز عيادات سونو التخصصية',
  branchName : 'فرع حدائق الأهرام',
  tagline    : 'رعاية طبية متكاملة بمعايير التخصص',
  currency   : 'EGP',
  currencyAr : 'جنيه',

  /* الشعار الكامل (النص + الرمز) — يظهر في صفحة الهبوط وكارت الدخول */
  logoUrl : 'assets/img/logo.svg',

  /* الرمز الدائري وحده — يظهر في الأماكن المربعة الصغيرة (شريط اللوحة) */
  markUrl : 'assets/img/mark.svg',

  /* صورة المركز في صفحة الهبوط — اتركها فارغة ليُستخدم المشهد الطبي المرسوم.
     مثال: 'assets/img/clinic.jpg'                                    */
  heroImage : '',

  /* ألوان الهوية — مأخوذة من الشعار */
  theme : {
    primary : '#0F369D',
    dark    : '#16212E',
    accent  : '#F15A22',
    good    : '#2F7D5C',
    bad     : '#D0402A'
  },

  /* ---------- تسجيل الدخول ---------- */
  authMode : 'supabase',

  supabase : {
    url     : 'https://raocrmssjqsozibniujc.supabase.co',
    anonKey : 'sb_publishable__TYwltqElKKLVIMPEfQEyg_nvP62RQk'
  },

  localAdmins : [
    {
      email : 'mohamadmh32@gmail.com',
      name  : 'محمد عبدالعال',
      role  : 'سوبر أدمن',
      hash  : 'ed3d30fc27b5e74ce31ed6775bac7c810a01e82f050d52f23462a3cdffd75cab'
    }
  ],

  /* ---------- الذكاء الاصطناعي ---------- */
  ai : {
    provider : 'anthropic',
    model    : 'claude-sonnet-5',
    includeDoctorNames : true
  },

  /* ---------- معايير الأداء المستخدمة في محرك القواعد ---------- */
  benchmarks : {
    netMarginMin        : 0.25,
    netMarginGood       : 0.35,
    doctorFeeRatioMax   : 0.35,
    payrollRatioMax     : 0.25,
    rentRatioMax        : 0.12,
    fixedCostRatioMax   : 0.45,
    cashShareMax        : 0.60,
    topServiceShareMax  : 0.30,
    topDoctorShareMax   : 0.25,
    returningRateMin    : 0.30,
    revenueCvMax        : 0.45,
    suppliesRatioMin    : 0.02,
    unclassifiedMax     : 0.03
  }
};

/* ============================================================
   حاسبة إنشاء فرع جديد
   أداة مستقلة داخل نفس اللوحة ولا تتدخل في محرك التقارير.
   ============================================================ */
(function () {
  'use strict';
  const STORE_KEY = 'sono_branch_setup_calculator_v1';
  const defaults = [
    ['التشطيب', 1, 0],
    ['الأجهزة الطبية', 1, 0],
    ['الأثاث والتجهيزات', 1, 0],
    ['الإيجار والتأمين', 1, 0],
    ['التراخيص والرسوم', 1, 0],
    ['الشبكات والـ IT', 1, 0],
    ['التسويق قبل الافتتاح', 1, 0],
    ['رأس المال التشغيلي', 1, 0]
  ];

  const money = n => Math.round(Number(n) || 0).toLocaleString('en-US') + ' جنيه';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function loadRows() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (e) {}
    return defaults.map((r, i) => ({ id: Date.now() + i, name: r[0], qty: r[1], unit: r[2] }));
  }

  function saveRows(rows) {
    localStorage.setItem(STORE_KEY, JSON.stringify(rows));
  }

  function ensureUi() {
    if (document.getElementById('branchCalcBtn')) return;
    const tabs = document.getElementById('tabs');
    if (!tabs) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'branchCalcBtn';
    btn.textContent = 'حاسبة إنشاء فرع جديد';
    btn.setAttribute('aria-selected', 'false');
    tabs.appendChild(btn);

    const modal = document.createElement('div');
    modal.id = 'branchCalcModal';
    modal.className = 'modal hide';
    modal.innerHTML = `
      <div class="mbox" style="max-width:1000px">
        <div class="mhead">
          <h2>حاسبة تكلفة إنشاء فرع جديد</h2>
          <button class="btn ghost icon" id="branchCalcClose" title="إغلاق">×</button>
        </div>
        <div class="mbody">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-bottom:16px">
            <div class="fld" style="flex:1;min-width:190px;margin:0">
              <label>اسم الفرع أو الموقع</label>
              <input id="branchCalcName" type="text" placeholder="مثال: فرع الشيخ زايد">
            </div>
            <button class="btn" type="button" id="branchCalcAdd">إضافة بند</button>
            <button class="btn ghost" type="button" id="branchCalcReset">إعادة ضبط</button>
          </div>
          <div style="overflow:auto">
            <table style="width:100%;border-collapse:collapse;min-width:650px">
              <thead>
                <tr>
                  <th style="text-align:right;padding:8px">البند</th>
                  <th style="padding:8px;width:110px">الكمية</th>
                  <th style="padding:8px;width:170px">تكلفة الوحدة</th>
                  <th style="padding:8px;width:170px">الإجمالي</th>
                  <th style="padding:8px;width:70px"></th>
                </tr>
              </thead>
              <tbody id="branchCalcRows"></tbody>
            </table>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:18px">
            <div style="min-width:280px;padding:16px;border:1px solid #ddd;border-radius:12px;text-align:center">
              <div style="font-size:13px;opacity:.7">إجمالي تكلفة إنشاء الفرع</div>
              <div id="branchCalcTotal" style="font-size:27px;font-weight:800;margin-top:4px">0 جنيه</div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    let rows = loadRows();
    const tbody = modal.querySelector('#branchCalcRows');
    const totalEl = modal.querySelector('#branchCalcTotal');
    const nameEl = modal.querySelector('#branchCalcName');
    nameEl.value = localStorage.getItem(STORE_KEY + '_name') || '';

    function render() {
      tbody.innerHTML = rows.map(r => `
        <tr data-id="${r.id}" style="border-top:1px solid #eee">
          <td style="padding:7px"><input data-k="name" type="text" value="${esc(r.name)}" style="width:100%"></td>
          <td style="padding:7px"><input data-k="qty" type="number" min="0" step="1" value="${Number(r.qty) || 0}" style="width:100%"></td>
          <td style="padding:7px"><input data-k="unit" type="number" min="0" step="100" value="${Number(r.unit) || 0}" style="width:100%"></td>
          <td data-total style="padding:7px;text-align:center;font-weight:700">${money((Number(r.qty)||0)*(Number(r.unit)||0))}</td>
          <td style="padding:7px;text-align:center"><button type="button" class="btn ghost sm" data-del>حذف</button></td>
        </tr>`).join('');
      refreshTotal();
    }

    function refreshTotal() {
      const total = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unit) || 0), 0);
      totalEl.textContent = money(total);
      saveRows(rows);
    }

    tbody.addEventListener('input', e => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const r = rows.find(x => String(x.id) === tr.dataset.id);
      if (!r) return;
      const k = e.target.dataset.k;
      if (k === 'name') r.name = e.target.value;
      if (k === 'qty' || k === 'unit') r[k] = Number(e.target.value) || 0;
      tr.querySelector('[data-total]').textContent = money((Number(r.qty)||0)*(Number(r.unit)||0));
      refreshTotal();
    });

    tbody.addEventListener('click', e => {
      const del = e.target.closest('[data-del]');
      if (!del) return;
      const tr = del.closest('tr[data-id]');
      rows = rows.filter(x => String(x.id) !== tr.dataset.id);
      render();
    });

    nameEl.addEventListener('input', () => localStorage.setItem(STORE_KEY + '_name', nameEl.value));
    modal.querySelector('#branchCalcAdd').onclick = () => {
      rows.push({ id: Date.now(), name: 'بند جديد', qty: 1, unit: 0 });
      render();
    };
    modal.querySelector('#branchCalcReset').onclick = () => {
      if (!confirm('إعادة الحاسبة للبنود الافتراضية ومسح القيم الحالية؟')) return;
      rows = defaults.map((r, i) => ({ id: Date.now() + i, name: r[0], qty: r[1], unit: r[2] }));
      localStorage.removeItem(STORE_KEY + '_name');
      nameEl.value = '';
      render();
    };

    const close = () => modal.classList.add('hide');
    btn.onclick = () => { render(); modal.classList.remove('hide'); };
    modal.querySelector('#branchCalcClose').onclick = close;
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    render();
  }

  function waitForDashboard() {
    ensureUi();
    if (!document.getElementById('branchCalcBtn')) setTimeout(waitForDashboard, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForDashboard);
  else waitForDashboard();
})();
