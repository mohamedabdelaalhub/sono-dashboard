/* ============================================================
   partners-store.js — حفظ إعدادات توزيع الأرباح (الشركاء ونسبهم)
   محلي في متصفح المستخدم فقط — لا يحتوي بيانات مرضى ولا يُرسل لأي خادم.
   ============================================================ */
(function (root) {
'use strict';
const LS_KEY = 'sono_partners_v1';

function defaults() {
  return { mode: 'full', retainPct: 0, retainAmount: 0, partners: [] };
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaults();
    const p = JSON.parse(raw);
    const d = defaults();
    return {
      mode: (p.mode === 'retain' || p.mode === 'amount') ? p.mode : 'full',
      retainPct: isFinite(p.retainPct) ? +p.retainPct : d.retainPct,
      retainAmount: isFinite(p.retainAmount) ? +p.retainAmount : d.retainAmount,
      partners: Array.isArray(p.partners)
        ? p.partners.filter(x => x && typeof x === 'object').map(x => ({
            id: x.id || uid(), name: String(x.name || ''), pct: x.pct === '' || x.pct == null ? '' : +x.pct
          }))
        : d.partners
    };
  } catch (e) { return defaults(); }
}

function save(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); return true; }
  catch (e) { return false; }
}

let _n = 0;
function uid() { return 'p' + (++_n) + '_' + Date.now().toString(36); }

root.SonoPartnersStore = { load, save, defaults, uid };
})(window);
