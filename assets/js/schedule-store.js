/* ============================================================
   schedule-store.js — حفظ جدول العيادات كمرجع دائم
   يحفظ في Supabase إن توفّر، وإلا في تخزين المتصفّح المحلي.
   ============================================================ */
(function (root) {
'use strict';
const AU = () => root.SonoAuth;
const LS_KEY = 'sono.schedule.v1';

function sb() { const a = AU(); return a && a.sb ? a.sb() : null; }

function localGet() {
  try { const t = localStorage.getItem(LS_KEY); return t ? JSON.parse(t) : null; }
  catch (e) { return null; }
}
function localSet(o) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(o)); return true; }
  catch (e) { return false; }
}
function localDel() { try { localStorage.removeItem(LS_KEY); } catch (e) {} }

/* ما الذي يُحفظ: الجدول كاملاً — لا يحتوي بيانات مرضى */
function payload(sch) {
  const c = o => JSON.parse(JSON.stringify(o === undefined ? null : o));
  return {
    v: 1, savedAt: new Date().toISOString(), file: sch.file || '',
    doctors: c(sch.doctors), specialties: c(sch.specialties),
    matrix: c((sch.matrix || []).map(r => ({ spec: r.spec, cells: r.cells.map(c2 => c2.map(x => x.name)) }))),
    conflicts: c(sch.conflicts), gaps: c(sch.gaps), solo: c(sch.solo), stats: c(sch.stats)
  };
}

/* إعادة بناء الكائن الكامل من الحمولة المحفوظة */
function revive(p, meta) {
  if (!p || !p.doctors) return null;
  const S = root.SonoSchedule;
  const out = Object.assign({}, p, S.summarize(p.doctors));
  out.kind = 'schedule';
  out.name = 'جدول عيادات المركز';
  out.file = p.file || (meta && meta.file_name) || '';
  out.savedAt = p.savedAt || (meta && meta.updated_at) || '';
  out.persisted = true;
  const d = out.savedAt ? new Date(out.savedAt) : null;
  out.savedLabel = d && !isNaN(d)
    ? 'محفوظ كمرجع دائم · آخر تحديث ' + d.toLocaleDateString('ar-EG')
    : 'محفوظ كمرجع دائم';
  return out;
}

/* ---------- حفظ ---------- */
async function save(sch, user) {
  const p = payload(sch);
  const client = sb();
  localSet(p);                                     /* نسخة محلية دائماً */
  if (!client) return { where: 'local' };
  const { error } = await client.from('clinic_schedule').upsert({
    id: 1, payload: p, file_name: sch.file || '',
    saved_by: user ? user.id : null,
    saved_email: user ? user.email : null,
    updated_at: new Date().toISOString()
  });
  if (error) {
    if (/relation .*clinic_schedule.* does not exist|schema cache/i.test(error.message))
      throw new Error('جدول clinic_schedule غير موجود في قاعدة البيانات. ' +
        'شغّل ملف supabase/migration-schedule.sql مرة واحدة من SQL Editor. ' +
        '(اتحفظت نسخة محلية على هذا المتصفح مؤقتاً.)');
    if (/row-level security|permission/i.test(error.message))
      throw new Error('صلاحية الحفظ للسوبر أدمن فقط. (اتحفظت نسخة محلية على هذا المتصفح.)');
    throw new Error(error.message);
  }
  return { where: 'supabase' };
}

/* ---------- تحميل ---------- */
async function load() {
  const client = sb();
  if (client) {
    try {
      const { data, error } = await client.from('clinic_schedule').select('*').eq('id', 1).maybeSingle();
      if (!error && data && data.payload) return revive(data.payload, data);
    } catch (e) { /* نكمل بالنسخة المحلية */ }
  }
  return revive(localGet());
}

async function remove() {
  localDel();
  const client = sb();
  if (!client) return;
  try { await client.from('clinic_schedule').delete().eq('id', 1); } catch (e) {}
}

root.SonoScheduleStore = { save, load, remove, payload, revive };
})(window);
