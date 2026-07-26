/* ============================================================
   roles.js — الأدوار والصلاحيات
   ============================================================ */
(function (root) {
'use strict';

/* الأدوار مرتبة من الأعلى صلاحية للأدنى */
const ROLES = [
  { key: 'سوبر أدمن', desc: 'تحكم كامل + إدارة الأدمنز + مفتاح الذكاء الاصطناعي' },
  { key: 'مدير',      desc: 'كل اللوحة والتصدير، بدون إدارة مستخدمين' },
  { key: 'محاسب',     desc: 'كل اللوحة والتصدير والبيانات التفصيلية' },
  { key: 'مستخدم',    desc: 'اطّلاع فقط — بدون تصدير ولا بيانات تفصيلية' }
];

const PERMS = {
  'سوبر أدمن': { view: 1, data: 1, export: 1, upload: 1, manageUsers: 1, aiSettings: 1, useAi: 1 },
  'مدير'     : { view: 1, data: 1, export: 1, upload: 1, manageUsers: 0, aiSettings: 0, useAi: 0 },
  'محاسب'    : { view: 1, data: 1, export: 1, upload: 1, manageUsers: 0, aiSettings: 0, useAi: 0 },
  'مستخدم'   : { view: 1, data: 0, export: 0, upload: 0, manageUsers: 0, aiSettings: 0, useAi: 0 }
};

/* أسماء قديمة أو بديلة تُعامل كسوبر أدمن */
const SUPER_ALIASES = ['سوبر أدمن', 'سوبر ادمن', 'مالك', 'owner', 'superadmin', 'super admin'];

function normalize(role) {
  const r = String(role || '').trim();
  if (SUPER_ALIASES.some(a => a === r.toLowerCase() || a === r)) return 'سوبر أدمن';
  return ROLES.some(x => x.key === r) ? r : 'مستخدم';
}
function isSuper(user) { return normalize(user && user.role) === 'سوبر أدمن'; }

/* can(user, 'export') — مع مراعاة مفتاح تشغيل الذكاء الاصطناعي للأدمنز */
function can(user, perm) {
  if (!user) return false;
  const p = PERMS[normalize(user.role)] || PERMS['مستخدم'];
  if (perm === 'useAi') {
    if (isSuper(user)) return true;
    return !!(root.SonoSettings && root.SonoSettings.aiEnabledForAdmins() && p.view);
  }
  return !!p[perm];
}
function list() { return ROLES.slice(); }

root.SonoRoles = { list, can, isSuper, normalize, ROLES, PERMS };
})(window);
