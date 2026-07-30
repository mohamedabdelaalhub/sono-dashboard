/* ============================================================
   tabaccess-store.js — التحكم في التابات المسموحة لكل مستخدم
   Supabase (جدول tab_access) مع نسخة احتياطية محلية في الوضع المحلي.
   السوبر أدمن دائماً يشوف كل التابات — لا يُقيَّد أبداً.
   غياب أي إعداد لمستخدم = غير مقيّد (كل التابات) — نفس السلوك الحالي.
   ============================================================ */
(function (root) {
'use strict';
const LS_KEY = 'sono_tabaccess_v1';

/* قائمة التابات القابلة للتقييد — بنفس مفاتيح data-t في index.html */
const ALL_TABS = [
  { key: 'sum',  label: 'ملخص التقرير' },
  { key: 'kpi',  label: 'المؤشرات' },
  { key: 'risk', label: 'المخاطر' },
  { key: 'rec',  label: 'التوصيات' },
  { key: 'plan', label: 'خطة العمل' },
  { key: 'dist', label: 'توزيع الأرباح' },
  { key: 'ai',   label: 'التحليل الذكي' },
  { key: 'sch',  label: 'جدول العيادات' },
  { key: 'rep',  label: 'التقارير المرفوعة' },
  { key: 'arch', label: 'الأرشيف' },
  { key: 'data', label: 'البيانات التفصيلية' }
];

function localAll() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { return {}; }
}
function localSaveAll(o) { try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (e) {} }

/* ---------- تابات المستخدم الحالي — null = غير مقيّد (كل التابات) ---------- */
async function myTabs(sb, user, isSuper) {
  if (!user || isSuper) return null;
  if (!sb) {
    const t = localAll()[user.email];
    return Array.isArray(t) && t.length ? t : null;
  }
  try {
    const { data, error } = await sb.from('tab_access').select('tabs').maybeSingle();
    if (error || !data || !Array.isArray(data.tabs) || !data.tabs.length) return null;
    return data.tabs;
  } catch (e) { return null; }
}

/* ---------- لواجهة الإدارة: كل الإعدادات المحفوظة ---------- */
async function listAll(sb) {
  if (!sb) return localAll();
  try {
    const { data, error } = await sb.from('tab_access').select('admin_id,tabs');
    if (error) return {};
    const out = {};
    (data || []).forEach(r => { out[r.admin_id] = r.tabs; });
    return out;
  } catch (e) { return {}; }
}

/* ---------- حفظ تابات مستخدم معيّن (سوبر أدمن فقط عبر RLS) ---------- */
async function save(sb, key, tabsArray, email) {
  if (!sb) {
    const all = localAll();
    all[email || key] = tabsArray;
    localSaveAll(all);
    return { where: 'local' };
  }
  const { error } = await sb.from('tab_access')
    .upsert({ admin_id: key, tabs: tabsArray, updated_at: new Date().toISOString() }, { onConflict: 'admin_id' });
  if (error) {
    if (/relation .*tab_access.* does not exist|schema cache/i.test(error.message))
      throw new Error('جدول tab_access غير موجود في Supabase. شغّل ملف supabase/migration-tab-access.sql مرة واحدة من SQL Editor.');
    if (/row-level security|permission/i.test(error.message))
      throw new Error('صلاحية تعديل التابات للسوبر أدمن فقط.');
    throw new Error(error.message);
  }
  return { where: 'supabase' };
}

root.SonoTabAccess = { ALL_TABS, myTabs, listAll, save };
})(window);
