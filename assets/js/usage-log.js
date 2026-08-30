/* ============================================================
   usage-log.js — سجل الاستخدام: من دخل، امتى، أي تقارير رفع،
   ومدة الاستخدام (تقريبية عبر نبضة كل دقيقة).
   يعمل فقط مع Supabase — لا شيء في الوضع المحلي.
   ============================================================ */
(function (root) {
'use strict';

let rowId = null, reports = [];

/* فتح جلسة استخدام جديدة عند الدخول */
async function start(sb, user) {
  rowId = null; reports = [];
  if (!sb || !user) return null;
  try {
    const { data, error } = await sb.from('usage_log')
      .insert({ admin_id: user.id, email: user.email || '', name: user.name || '' })
      .select('id').single();
    if (error || !data) return null;
    rowId = data.id;
    return rowId;
  } catch (e) { return null; }
}

/* نبضة: تحدّث وقت آخر نشاط (تُستخدم لحساب مدة الاستخدام) */
async function touch(sb) {
  if (!sb || !rowId) return;
  try { await sb.from('usage_log').update({ ended_at: new Date().toISOString() }).eq('id', rowId); }
  catch (e) {}
}

/* تسجيل أسماء الملفات المرفوعة في هذه الجلسة */
async function addFiles(sb, names) {
  if (!sb || !rowId || !names || !names.length) return;
  names.forEach(n => { if (n && !reports.includes(n)) reports.push(n); });
  try {
    await sb.from('usage_log')
      .update({ reports, ended_at: new Date().toISOString() }).eq('id', rowId);
  } catch (e) {}
}

/* لوحة التحكم: كل السجلات (سوبر أدمن فقط عبر RLS) */
async function listAll(sb) {
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('usage_log')
      .select('id,admin_id,email,name,started_at,ended_at,reports')
      .order('started_at', { ascending: false }).limit(300);
    if (error) return [];
    return data || [];
  } catch (e) { return []; }
}

root.SonoUsageLog = { start, touch, addFiles, listAll };
})(window);
