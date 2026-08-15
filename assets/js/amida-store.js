/* ============================================================
   amida-store.js — تخزين مركزي عبر Supabase لتاب «توزيع أرباح الأميدا»
   تاب حساس: بلا نسخة احتياطية محلية عمداً — البيانات تُحفظ مركزياً فقط.
   ============================================================ */
(function (root) {
'use strict';

function migrationErr(msg, table) {
  if (new RegExp('relation .*' + table + '.* does not exist|schema cache', 'i').test(msg))
    return new Error(`جدول ${table} غير موجود في Supabase. شغّل ملف supabase/migration-amida.sql مرة واحدة من SQL Editor (بعد migration-tab-access.sql).`);
  if (/row-level security|permission/i.test(msg))
    return new Error('لا تملك صلاحية الوصول لهذا القسم. اطلب من السوبر أدمن منحك تاب «توزيع أرباح الأميدا» من لوحة التحكم.');
  return new Error(msg);
}

/* ---------- الإعداد الحالي ---------- */
async function loadSettings(sb) {
  if (!sb) throw new Error('يحتاج تفعيل Supabase.');
  const { data, error } = await sb.from('amida_settings')
    .select('principal,annual_rate,exchange_rate,deduction,partners').eq('id', 1).maybeSingle();
  if (error) throw migrationErr(error.message, 'amida_settings');
  if (!data) return { principal: 0, annualRate: 0, exchangeRate: 75, deduction: 5, partners: [] };
  return {
    principal: +data.principal || 0, annualRate: +data.annual_rate || 0,
    exchangeRate: data.exchange_rate != null ? +data.exchange_rate : 75,
    deduction: data.deduction != null ? +data.deduction : 5,
    partners: Array.isArray(data.partners) ? data.partners : []
  };
}
async function saveSettings(sb, s) {
  if (!sb) throw new Error('يحتاج تفعيل Supabase.');
  const { error } = await sb.from('amida_settings').upsert({
    id: 1, principal: s.principal || 0, annual_rate: s.annualRate || 0,
    exchange_rate: s.exchangeRate || 0, deduction: s.deduction || 0,
    partners: s.partners || [], updated_at: new Date().toISOString()
  }, { onConflict: 'id' });
  if (error) throw migrationErr(error.message, 'amida_settings');
}

/* ---------- الأرشيف ---------- */
async function addArchive(sb, entry) {
  if (!sb) throw new Error('يحتاج تفعيل Supabase.');
  const { error } = await sb.from('amida_archive').insert({
    principal: entry.principal, annual_rate: entry.annualRate, partners: entry.partners,
    period_total: entry.periodTotal, annual_total: entry.annualTotal,
    exchange_rate: entry.exchangeRate || null, deduction: entry.deduction || null,
    note: entry.note || null, created_by: entry.createdBy || null
  });
  if (error) throw migrationErr(error.message, 'amida_archive');
}
async function listArchive(sb) {
  if (!sb) throw new Error('يحتاج تفعيل Supabase.');
  const { data, error } = await sb.from('amida_archive').select('*').order('created_at', { ascending: false });
  if (error) throw migrationErr(error.message, 'amida_archive');
  return data || [];
}
async function deleteArchive(sb, id) {
  if (!sb) throw new Error('يحتاج تفعيل Supabase.');
  const { error } = await sb.from('amida_archive').delete().eq('id', id);
  if (error) throw migrationErr(error.message, 'amida_archive');
}

root.SonoAmidaStore = { loadSettings, saveSettings, addArchive, listArchive, deleteArchive };
})(window);
