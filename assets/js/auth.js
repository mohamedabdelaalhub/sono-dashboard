/* ============================================================
   auth.js — تسجيل الدخول والأدوار
   'supabase' : حماية حقيقية + إدارة أدمنز من اللوحة
   'local'    : بوابة داخل الصفحة ببصمة SHA-256 (للتجربة فقط)
   ============================================================ */
(function (root) {
'use strict';
const CFG = root.SONO_CONFIG || {};
const R = () => root.SonoRoles;
let sb = null, current = null;

/* بصمة SHA-256 — متاحة عالمياً لتوليد باسورد جديد من الـ Console */
root.sonoHash = async function (txt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
};

function mode() { return CFG.authMode === 'supabase' ? 'supabase' : 'local'; }
function user() { return current; }
function client() { return sb; }
const lc = e => String(e || '').trim().toLowerCase();

/* تحميل سكربت بمهلة — بدون المهلة تتجمّد الصفحة لو الشبكة حجبت المكتبة */
function loadScript(src, ms) {
  return new Promise((res, rej) => {
    let done = false;
    const finish = (ok, err) => { if (done) return; done = true; ok ? res() : rej(err); };
    const s = document.createElement('script');
    s.src = src;
    s.onload  = () => finish(true);
    s.onerror = () => finish(false, new Error('تعذّر تحميل مكتبة Supabase. تأكد من الإنترنت.'));
    document.head.appendChild(s);
    setTimeout(() => finish(false, new Error(
      'انتهت مهلة تحميل مكتبة Supabase. قد تكون الشبكة بطيئة أو تحجب cdn.jsdelivr.net.')), ms || 15000);
  });
}

async function initSupabase() {
  if (sb) return sb;
  if (!root.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js');
  if (!root.supabase || !root.supabase.createClient)
    throw new Error('لم تُحمَّل مكتبة Supabase بشكل صحيح. أعد تحميل الصفحة.');
  const u = String((CFG.supabase || {}).url || '').trim().replace(/\/+$/, '');
  const k = String((CFG.supabase || {}).anonKey || '').trim();
  if (!u || /XXXXXXXX/.test(u)) throw new Error('لم تُضبط بيانات Supabase في config.js (الرابط).');
  if (!k || /ضع-هنا/.test(k))   throw new Error('لم تُضبط بيانات Supabase في config.js (المفتاح).');
  sb = root.supabase.createClient(u, k);
  return sb;
}

/* ============================================================
   المخزن المحلي للأدمنز (وضع local فقط)
   ============================================================ */
const LKEY = 'sono_local_admins';
function localAdmins() {
  try {
    const raw = localStorage.getItem(LKEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const seed = (CFG.localAdmins || []).map(a => ({
    email: lc(a.email), name: a.name || a.email, role: R().normalize(a.role),
    hash: String(a.hash || '').toLowerCase(), active: true
  }));
  localStorage.setItem(LKEY, JSON.stringify(seed));
  return seed;
}
function saveLocalAdmins(list) { localStorage.setItem(LKEY, JSON.stringify(list)); }

/* ============================================================
   استعادة الجلسة
   ============================================================ */
async function restore() {
  if (mode() === 'supabase') {
    try {
      const c = await initSupabase();
      const { data } = await c.auth.getSession();
      if (!data.session) return null;
      return await afterAuth(c, data.session.user);
    } catch (e) { return null; }
  }
  try {
    const raw = sessionStorage.getItem('sono_session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() - s.at > 12 * 3600 * 1000) { sessionStorage.removeItem('sono_session'); return null; }
    /* أعد التحقق من القائمة المحلية — قد يكون الدور تغيّر أو أُوقف الحساب */
    const a = localAdmins().find(x => x.email === lc(s.user.email));
    if (!a || a.active === false) { sessionStorage.removeItem('sono_session'); return null; }
    current = { email: a.email, name: a.name, role: R().normalize(a.role) };
    return current;
  } catch (e) { return null; }
}

/* بعد نجاح المصادقة: تحقق من جدول الأدمنز واربط الدعوة المعلّقة */
async function afterAuth(c, u) {
  let prof = await fetchProfile(c, u.id);

  if (!prof) {
    /* هل توجد دعوة معلّقة بنفس البريد؟ اربطها بالحساب */
    const { data: pend } = await c.from('admins')
      .select('id,name,role,active').is('user_id', null).eq('email', lc(u.email)).maybeSingle();
    if (pend) {
      await c.from('admins').update({ user_id: u.id }).eq('id', pend.id);
      prof = pend;
    }
  }
  if (!prof || prof.active === false) {
    const em = u.email;
    await c.auth.signOut();
    throw new Error(prof
      ? 'حسابك موقوف حالياً. راجع مدير المركز.'
      : `تم التحقق من هويتك، لكن البريد «${em}» غير مُدرَج في قائمة المصرّح لهم. ` +
        'اطلب من السوبر أدمن إضافته من ⚙ لوحة التحكم، ثم أعد تسجيل الدخول.');
  }
  current = { id: u.id, email: u.email, name: prof.name || u.email, role: R().normalize(prof.role) };
  return current;
}

async function fetchProfile(c, uid) {
  const { data, error } = await c.from('admins').select('id,name,role,active').eq('user_id', uid).maybeSingle();
  if (error || !data) return null;
  return data;
}

/* ============================================================
   الدخول
   ============================================================ */
async function signIn(email, pass) {
  email = lc(email);
  if (mode() === 'supabase') {
    const c = await initSupabase();
    const { data, error } = await c.auth.signInWithPassword({ email, password: pass });
    if (error) throw new Error(mapErr(error.message));
    return await afterAuth(c, data.user);
  }
  const a = localAdmins().find(x => x.email === email);
  if (!a) throw new Error('البريد الإلكتروني غير مسجّل.');
  if (a.active === false) throw new Error('حسابك موقوف حالياً. راجع مدير المركز.');
  const h = await root.sonoHash(pass);
  if (h !== String(a.hash).toLowerCase()) throw new Error('كلمة السر غير صحيحة.');
  current = { email: a.email, name: a.name || a.email, role: R().normalize(a.role) };
  sessionStorage.setItem('sono_session', JSON.stringify({ user: current, at: Date.now() }));
  return current;
}

/* ============================================================
   إنشاء حساب — للمدعوّين فقط
   ============================================================ */
async function signUp(email, name, pass) {
  email = lc(email);
  if (String(pass || '').length < 8) throw new Error('كلمة السر يجب ألا تقل عن 8 أحرف.');

  if (mode() === 'supabase') {
    const c = await initSupabase();
    /* ملاحظة: لا يمكن التحقق من الدعوة قبل المصادقة، لأن سياسات RLS
       تمنع الزائر غير المسجّل من قراءة جدول admins. التحقق يتم في
       afterAuth بعد نجاح المصادقة، وهناك يُرفض غير المدعوّ ويُسجَّل خروجه. */
    const { data, error } = await c.auth.signUp({ email, password: pass, options: { data: { full_name: name } } });
    if (error) throw new Error(mapErr(error.message));
    if (!data.session)
      return { needsConfirm: true, msg: 'تم إنشاء الحساب. افتح بريدك واضغط رابط التأكيد، ثم ارجع وسجّل الدخول.' };
    if (name) { try { await c.from('admins').update({ name }).eq('email', email); } catch (e) {} }
    await afterAuth(c, data.user);
    return { needsConfirm: false };
  }

  /* محلياً */
  const list = localAdmins();
  const a = list.find(x => x.email === email);
  if (!a) throw new Error('هذا البريد غير مُضاف من مدير المركز. اطلب منه إضافتك أولاً.');
  if (a.hash) throw new Error('هذا الحساب له كلمة سر بالفعل. استخدم «تسجيل الدخول».');
  a.hash = await root.sonoHash(pass);
  if (name) a.name = name;
  saveLocalAdmins(list);
  current = { email: a.email, name: a.name, role: R().normalize(a.role) };
  sessionStorage.setItem('sono_session', JSON.stringify({ user: current, at: Date.now() }));
  return { needsConfirm: false };
}

async function signOut() {
  if (mode() === 'supabase' && sb) { try { await sb.auth.signOut(); } catch (e) {} }
  sessionStorage.removeItem('sono_session');
  if (root.SonoSettings) root.SonoSettings.reset();
  current = null;
}

/* ============================================================
   استرجاع وتغيير كلمة السر
   ============================================================ */
function siteUrl() {
  return location.origin + location.pathname.replace(/[^/]*$/, '');
}

/* يرسل رابط تعيين كلمة سر جديدة على البريد */
async function sendReset(email) {
  email = lc(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('اكتب بريداً إلكترونياً صحيحاً.');
  if (mode() !== 'supabase')
    throw new Error('استرجاع كلمة السر بالبريد يحتاج تفعيل Supabase. في الوضع المحلي اطلب من السوبر أدمن إعادة تعيينها لك من ⚙ لوحة التحكم.');
  const c = await initSupabase();
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() });
  if (error) throw new Error(mapErr(error.message));
  return true;
}

/* هل فتح المستخدم رابط الاسترجاع؟ */
function isRecovery() {
  const h = location.hash || '';
  return /type=recovery/.test(h) || /[?&]type=recovery/.test(location.search || '');
}

/* بعد فتح الرابط: عيّن كلمة السر الجديدة */
async function setNewPassword(pass) {
  if (String(pass || '').length < 8) throw new Error('كلمة السر يجب ألا تقل عن 8 أحرف.');
  if (mode() !== 'supabase') throw new Error('هذه الميزة تحتاج تفعيل Supabase.');
  const c = await initSupabase();
  const { error } = await c.auth.updateUser({ password: pass });
  if (error) throw new Error(mapErr(error.message));
  try { history.replaceState(null, '', siteUrl()); } catch (e) {}
  return true;
}

/* تغيير كلمة السر من داخل اللوحة (المستخدم يعرف كلمته الحالية) */
async function changePassword(pass) {
  if (String(pass || '').length < 8) throw new Error('كلمة السر يجب ألا تقل عن 8 أحرف.');
  if (mode() === 'supabase') {
    const c = await initSupabase();
    const { error } = await c.auth.updateUser({ password: pass });
    if (error) throw new Error(mapErr(error.message));
    return true;
  }
  const list = localAdmins();
  const a = list.find(x => x.email === lc(current && current.email));
  if (!a) throw new Error('تعذّر تحديد حسابك.');
  a.hash = await root.sonoHash(pass);
  saveLocalAdmins(list);
  return true;
}

/* في الوضع المحلي: السوبر أدمن يمسح كلمة سر مستخدم ليعيد إنشاءها */
function clearLocalPassword(email) {
  const list = localAdmins();
  const a = list.find(x => x.email === lc(email));
  if (!a) throw new Error('المستخدم غير موجود.');
  a.hash = '';
  saveLocalAdmins(list);
}

/* ============================================================
   فحص الاتصال — يشخّص المشاكل الشائعة ويقولها بالعربي
   ============================================================ */
async function diagnose() {
  const out = [];
  const add = (ok, title, detail) => out.push({ ok, title, detail });

  add(CFG.authMode === 'supabase', 'وضع الحماية', CFG.authMode === 'supabase'
    ? 'supabase — حماية حقيقية'
    : `«${CFG.authMode}» — وضع محلي، ليس حماية حقيقية. غيّره إلى 'supabase' في config.js.`);
  if (CFG.authMode !== 'supabase') { return out; }

  const url = String((CFG.supabase || {}).url || '');
  const key = String((CFG.supabase || {}).anonKey || '');

  const urlOk = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.replace(/\/$/, '') + '');
  add(urlOk, 'رابط المشروع', urlOk ? url : `«${url}» لا يبدو رابط Supabase صحيحاً. الشكل المتوقع https://xxxx.supabase.co`);

  const isJwt = key.startsWith('eyJ');
  const isPub = key.startsWith('sb_publishable_');
  const isSecret = key.startsWith('sb_secret_') || key.includes('service_role');
  if (isSecret) add(false, 'المفتاح', '⚠️ خطر: هذا مفتاح سري (service/secret). لا تضعه أبداً في ملف منشور. استخدم المفتاح العام (Publishable / anon).');
  else if (isPub) add(true, 'المفتاح', 'مفتاح عام حديث (Publishable) ✓');
  else if (isJwt) add(true, 'المفتاح', 'مفتاح anon قديم (JWT) ✓');
  else add(false, 'المفتاح', `«${key.slice(0, 18)}…» شكل غير معروف. انسخ Publishable key من Project Settings ← API Keys.`);

  let c;
  try { c = await initSupabase(); add(true, 'تحميل مكتبة Supabase', 'تم ✓'); }
  catch (e) { add(false, 'تحميل مكتبة Supabase', e.message); return out; }

  /* اتصال فعلي: طلب جلسة */
  try {
    await c.auth.getSession();
    add(true, 'الاتصال بالخادم', 'الخادم يرد ✓');
  } catch (e) {
    add(false, 'الاتصال بالخادم', 'تعذّر الوصول. راجع الرابط والإنترنت.');
    return out;
  }

  /* الجداول: كزائر ستعود مصفوفة فارغة إن كانت السياسات سليمة،
     أما إن كان الجدول غير موجود فسيعود خطأ 42P01 */
  for (const t of ['admins', 'app_settings', 'app_secrets']) {
    try {
      const { error } = await c.from(t).select('*', { count: 'exact', head: true });
      if (error && /does not exist|schema cache|42P01/i.test(error.message))
        add(false, 'جدول ' + t, 'غير موجود — شغّل ملف supabase/setup.sql في SQL Editor.');
      else if (error && /Invalid API key|JWT|apikey/i.test(error.message))
        add(false, 'جدول ' + t, 'المفتاح مرفوض من الخادم. انسخه من جديد من Project Settings ← API Keys.');
      else
        add(true, 'جدول ' + t, 'موجود ومحمي بسياسات ✓');
    } catch (e) { add(false, 'جدول ' + t, e.message); }
  }

  /* عدد المصرّح لهم — كزائر لا نراهم، لكن الخطأ يميّز المشكلة */
  const { data: sess } = await c.auth.getSession();
  add(true, 'الجلسة الحالية', sess && sess.session
    ? 'مسجّل دخول باسم ' + sess.session.user.email
    : 'لا توجد جلسة — طبيعي قبل تسجيل الدخول.');

  return out;
}

function mapErr(m) {
  m = String(m || '');
  if (/Invalid login credentials/i.test(m))       return 'البريد الإلكتروني أو كلمة السر غير صحيحة.';
  if (/Invalid API key|apikey/i.test(m))          return 'مفتاح Supabase مرفوض. انسخ Publishable key من Project Settings ← API Keys وحدّث config.js.';
  if (/For security purposes|after \d+ seconds/i.test(m)) return 'انتظر ثوانيَ قليلة ثم أعد المحاولة.';
  if (/Email rate limit|over_email_send_rate/i.test(m))   return 'تجاوزت حد إرسال الرسائل في الخطة المجانية (رسائل قليلة/ساعة). انتظر ساعة، أو اطلب من السوبر أدمن إعادة التعيين من Supabase مباشرة.';
  if (/New password should be different/i.test(m)) return 'كلمة السر الجديدة يجب أن تختلف عن القديمة.';
  if (/same_password/i.test(m))                    return 'كلمة السر الجديدة يجب أن تختلف عن القديمة.';
  if (/Email not confirmed/i.test(m))             return 'لم يتم تأكيد البريد بعد. افتح رسالة التأكيد في بريدك.';
  if (/User already registered|already been reg/i.test(m)) return 'هذا البريد له حساب بالفعل. استخدم «تسجيل الدخول».';
  if (/Password should be/i.test(m))              return 'كلمة السر ضعيفة — استخدم 8 أحرف على الأقل.';
  if (/rate limit|too many/i.test(m))             return 'محاولات كثيرة متتالية. انتظر دقيقة ثم أعد المحاولة.';
  if (/Failed to fetch|NetworkError/i.test(m))    return 'تعذّر الاتصال بخادم المصادقة. تأكد من الإنترنت ومن إعدادات Supabase في config.js.';
  return m;
}

root.SonoAuth = { restore, signIn, signUp, signOut, user, mode, client,
                  localAdmins, saveLocalAdmins, lc,
                  sendReset, isRecovery, setNewPassword, changePassword,
                  clearLocalPassword, diagnose, initSupabase };
})(window);
