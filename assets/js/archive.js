/* ============================================================
   archive.js — أرشيف التحليلات المحفوظة
   يحفظ التحليل المُجمّع (بلا أسماء مرضى) في Supabase،
   ويسمح باستعراض أي تقرير سابق في أي وقت.
   ============================================================ */
(function (root) {
'use strict';
const AU = () => root.SonoAuth, RO = () => root.SonoRoles;

/* ---------- ما الذي يُحفظ؟ نسخة مجمّعة بلا بيانات شخصية ---------- */
function buildPayload(A, E, cmp, files) {
  const clone = o => JSON.parse(JSON.stringify(o === undefined ? null : o));
  return {
    v: 1,
    meta: {
      rangeLabel: A.meta.rangeLabel,
      spanDays  : A.meta.spanDays,
      activeDays: A.meta.activeDays,
      from      : A.meta.from ? root.SonoParser.iso(A.meta.from) : null,
      to        : A.meta.to   ? root.SonoParser.iso(A.meta.to)   : null,
      files     : files || []
    },
    kpi        : clone(A.kpi),
    daily      : clone(A.daily),
    weekly     : clone(A.weekly),
    dowAgg     : clone(A.dowAgg),
    methods    : clone(A.methods),
    services   : clone(A.services),
    serviceCats: clone(A.serviceCats),
    expCats    : clone(A.expCats),
    expGroups  : clone(A.expGroups),
    doctors    : clone(A.doctors),
    supplies   : clone(A.supplies),
    suppliesNoteCount: A.suppliesNoteCount,
    status     : clone(A.status),
    /* ---------- حقول تُحذف عمداً قبل الحفظ ----------
       أسماء المرضى، وسطور «تحتاج تصنيف» لأن حقل البيان فيها
       يحتوي أسماء أشخاص. نحفظ الملخّص الرقمي فقط.            */
    topPatients: [],
    unclassifiedRows: [],
    unclassifiedSummary: {
      count: (A.unclassifiedRows || []).length,
      total: (A.unclassifiedRows || []).reduce((s, r) => s + (r.amount || 0), 0)
    },
    evaluation : { risks: clone(E.risks), recos: clone(E.recos), plan: clone(E.plan),
                   summary: clone(E.summary), score: E.score, upside: E.upside,
                   criticalCount: E.criticalCount },
    cmp        : clone(cmp)
  };
}

/* يعيد بناء كائني A و E من الحمولة المحفوظة */
function restorePayload(p) {
  const A = {
    meta: {
      rangeLabel: p.meta.rangeLabel, spanDays: p.meta.spanDays, activeDays: p.meta.activeDays,
      from: p.meta.from ? new Date(p.meta.from) : null,
      to  : p.meta.to   ? new Date(p.meta.to)   : null
    },
    kpi: p.kpi, daily: p.daily || [], weekly: p.weekly || [], dowAgg: p.dowAgg || [],
    methods: p.methods || [], services: p.services || [], serviceCats: p.serviceCats || [],
    top5Services: (p.services || []).slice(0, 5),
    expCats: p.expCats || [], expGroups: p.expGroups || [], doctors: p.doctors || [],
    supplies: p.supplies || [], suppliesNoteCount: p.suppliesNoteCount || 0,
    unclassifiedRows: p.unclassifiedRows || [], topPatients: [], status: p.status || null,
    unclassifiedSummary: p.unclassifiedSummary || null, archived: true
  };
  const ev = p.evaluation || {};
  const E = { risks: ev.risks || [], recos: ev.recos || [], plan: ev.plan || [],
              summary: ev.summary || [], score: ev.score || 0, upside: ev.upside || 0,
              criticalCount: ev.criticalCount || 0 };
  return { A, E, cmp: p.cmp || null };
}

/* ---------- الحفظ ---------- */
async function save(A, E, cmp, files, title) {
  const sb = AU().client();
  const u  = AU().user();
  if (AU().mode() !== 'supabase' || !sb)
    throw new Error('حفظ التقارير يحتاج تفعيل Supabase — الأرشيف مشترك بين كل المستخدمين والأجهزة.');
  if (!RO().can(u, 'upload'))
    throw new Error('دورك الحالي لا يسمح بحفظ التقارير.');

  const row = {
    title       : (title || A.meta.rangeLabel || 'تقرير').slice(0, 160),
    period_from : A.meta.from ? root.SonoParser.iso(A.meta.from) : null,
    period_to   : A.meta.to   ? root.SonoParser.iso(A.meta.to)   : null,
    files       : files || [],
    revenue     : Math.round(A.kpi.revenue),
    cost        : Math.round(A.kpi.cost),
    net         : Math.round(A.kpi.net),
    score       : E.score,
    risk_count  : E.risks.length,
    payload     : buildPayload(A, E, cmp, files),
    created_by  : u.id || null,
    created_name: u.name || u.email
  };
  const { data, error } = await sb.from('reports').insert(row).select('id').maybeSingle();
  if (error) throw new Error(dbErr(error.message));
  return data;
}

/* ---------- القائمة ---------- */
async function list() {
  const sb = AU().client();
  if (AU().mode() !== 'supabase' || !sb) return [];
  const { data, error } = await sb.from('reports')
    .select('id,title,period_from,period_to,files,revenue,cost,net,score,risk_count,created_name,created_at')
    .order('created_at', { ascending: false }).limit(200);
  if (error) throw new Error(dbErr(error.message));
  return data || [];
}

/* حفظ تقرير مقارنة */
async function saveComparison(C, titles, title) {
  const sb = AU().client(), u = AU().user();
  if (AU().mode() !== 'supabase' || !sb)
    throw new Error('حفظ التقارير يحتاج تفعيل Supabase.');
  if (!RO().can(u, 'upload')) throw new Error('دورك الحالي لا يسمح بحفظ التقارير.');
  const last = C.periods[C.periods.length - 1];
  const nm = String(title || '').trim() || ('مقارنة ' + C.periods.map(p => p.label).join(' مقابل '));
  const row = {
    title       : (/مقارنة/.test(nm) ? nm : 'مقارنة — ' + nm).slice(0, 160),
    period_from : null, period_to: null,
    files       : titles || [],
    revenue     : Math.round(last.revenue), cost: Math.round(last.cost), net: Math.round(last.net),
    score       : last.score, risk_count: C.risks.filter(r => r.persistent || r.emerged).length,
    payload     : { v: 1, kind: 'comparison', comparison: C, sources: titles || [] },
    created_by  : u.id || null, created_name: u.name || u.email
  };
  const { data, error } = await sb.from('reports').insert(row).select('id').maybeSingle();
  if (error) throw new Error(dbErr(error.message));
  return data;
}

async function load(id) {
  const sb = AU().client();
  const { data, error } = await sb.from('reports').select('payload,title').eq('id', id).maybeSingle();
  if (error) throw new Error(dbErr(error.message));
  if (!data) throw new Error('التقرير غير موجود — ربما حُذف.');
  if (data.payload && data.payload.kind === 'comparison')
    return { comparison: data.payload.comparison, sources: data.payload.sources || [], title: data.title };
  return { ...restorePayload(data.payload), title: data.title };
}

async function remove(id) {
  const sb = AU().client();
  const { error } = await sb.from('reports').delete().eq('id', id);
  if (error) throw new Error(dbErr(error.message));
}

function dbErr(m) {
  m = String(m || '');
  if (/relation .* does not exist|schema cache|reports/i.test(m) && /does not exist/i.test(m))
    return 'جدول الأرشيف غير موجود. شغّل ملف supabase/migration-reports.sql في SQL Editor أولاً.';
  if (/row-level security|violates|permission/i.test(m))
    return 'ليست لديك صلاحية لهذا الإجراء على الأرشيف.';
  return m;
}

root.SonoArchive = { save, saveComparison, list, load, remove, buildPayload, restorePayload };
})(window);
