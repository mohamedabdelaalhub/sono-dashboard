/* ============================================================
   settings.js — إعدادات الذكاء الاصطناعي
   المفتاح مرتبط بحساب السوبر أدمن (Supabase) ولا يظهر لأحد غيره.
   في الوضع المحلي يُخزَّن في المتصفح لأنه لا يوجد خادم.
   ============================================================ */
(function (root) {
'use strict';
const CFG = root.SONO_CONFIG || {};
const LS = 'sono_ai_settings';

/* الحالة في الذاكرة */
let S = {
  provider          : (CFG.ai && CFG.ai.provider) || 'anthropic',
  model             : (CFG.ai && CFG.ai.model) || 'claude-sonnet-5',
  apiKey            : '',      /* يُملأ للسوبر أدمن فقط */
  hasKey            : false,   /* يعرفه الجميع: هل المفتاح مضبوط */
  enableForAdmins   : false,
  includeDoctorNames: !(CFG.ai && CFG.ai.includeDoctorNames === false)
};

function get()  { return Object.assign({}, S); }
function hasKey() { return !!(S.apiKey || S.hasKey); }
function aiEnabledForAdmins() { return !!S.enableForAdmins; }

/* ---------- التحميل ---------- */
async function load(sb, user, isSuper) {
  /* محلياً: كل شيء في المتصفح */
  if (!sb) {
    try {
      const raw = localStorage.getItem(LS);
      if (raw) Object.assign(S, JSON.parse(raw));
    } catch (e) {}
    S.hasKey = !!S.apiKey;
    return get();
  }

  /* Supabase: الجميع يقرأ الإعدادات العامة، والمفتاح للسوبر أدمن فقط */
  try {
    const { data } = await sb.from('app_settings').select('*').eq('id', 1).maybeSingle();
    if (data) {
      S.provider           = data.provider || S.provider;
      S.model              = data.model || S.model;
      S.enableForAdmins    = !!data.enable_for_admins;
      S.includeDoctorNames = data.include_doctor_names !== false;
      S.hasKey             = !!data.has_key;
    }
  } catch (e) { /* الجدول غير موجود بعد */ }

  if (isSuper) {
    try {
      const { data } = await sb.from('app_secrets').select('api_key').eq('id', 1).maybeSingle();
      if (data && data.api_key) { S.apiKey = data.api_key; S.hasKey = true; }
    } catch (e) {}
  }
  return get();
}

/* ---------- الحفظ (السوبر أدمن فقط) ---------- */
async function save(sb, patch) {
  Object.assign(S, patch);
  if (S.apiKey) S.hasKey = true;

  if (!sb) {
    localStorage.setItem(LS, JSON.stringify(S));
    return { ok: true, where: 'local' };
  }

  const pub = {
    id: 1,
    provider: S.provider,
    model: S.model,
    enable_for_admins: !!S.enableForAdmins,
    include_doctor_names: !!S.includeDoctorNames,
    has_key: !!S.hasKey,
    updated_at: new Date().toISOString()
  };
  const r1 = await sb.from('app_settings').upsert(pub, { onConflict: 'id' });
  if (r1.error) throw new Error(mapErr(r1.error.message));

  if (patch.apiKey !== undefined) {
    const r2 = await sb.from('app_secrets')
      .upsert({ id: 1, api_key: patch.apiKey || null, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (r2.error) throw new Error(mapErr(r2.error.message));
  }
  return { ok: true, where: 'supabase' };
}

/* يجلب المفتاح وقت الاستخدام — للأدمنز عبر دالة محمية في القاعدة */
async function resolveKey(sb, isSuper) {
  if (S.apiKey) return S.apiKey;
  if (!sb) return '';
  if (isSuper) {
    const { data } = await sb.from('app_secrets').select('api_key').eq('id', 1).maybeSingle();
    return (data && data.api_key) || '';
  }
  if (!S.enableForAdmins) return '';
  /* دالة SECURITY DEFINER تعيد المفتاح فقط عندما يكون التشغيل مفعّلاً */
  const { data, error } = await sb.rpc('get_ai_key');
  if (error) return '';
  return data || '';
}

function mapErr(m) {
  m = String(m || '');
  if (/relation .* does not exist|schema cache/i.test(m))
    return 'جداول الإعدادات غير موجودة في Supabase. شغّل ملف supabase/setup.sql أولاً.';
  if (/row-level security|violates/i.test(m))
    return 'ليست لديك صلاحية حفظ الإعدادات — هذه الصفحة للسوبر أدمن فقط.';
  return m;
}

function reset() {
  S.apiKey = ''; S.hasKey = false;
}

root.SonoSettings = { get, load, save, hasKey, aiEnabledForAdmins, resolveKey, reset };
})(window);
