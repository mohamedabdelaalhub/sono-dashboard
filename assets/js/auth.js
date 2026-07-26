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

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('تعذّر تحميل مكتبة Supabase'));
    document.head.appendChild(s);
  });
}
async function initSupabase() {
  if (sb) return sb;
  if (!root.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js');
  sb = root.supabase.createClient(CFG.supabase.url, CFG.supabase.anonKey);
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
    await c.auth.signOut();
    throw new Error(prof ? 'حسابك موقوف حالياً. راجع مدير المركز.'
                         : 'هذا البريد غير مُصرّح له بالدخول. اطلب من مدير المركز إضافته أولاً.');
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
    /* تأكد أن البريد مدعوّ قبل إنشاء الحساب */
    const { data: inv } = await c.from('admins').select('id').eq('email', email).maybeSingle();
    if (!inv) throw new Error('هذا البريد غير مُضاف من مدير المركز. اطلب منه إضافتك أولاً ثم أعد المحاولة.');
    const { data, error } = await c.auth.signUp({ email, password: pass, options: { data: { full_name: name } } });
    if (error) throw new Error(mapErr(error.message));
    if (!data.session)
      return { needsConfirm: true, msg: 'تم إنشاء الحساب. افتح بريدك واضغط رابط التأكيد ثم سجّل الدخول.' };
    await c.from('admins').update({ user_id: data.user.id, name: name || undefined }).eq('id', inv.id);
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

function mapErr(m) {
  m = String(m || '');
  if (/Invalid login credentials/i.test(m))       return 'البريد الإلكتروني أو كلمة السر غير صحيحة.';
  if (/Email not confirmed/i.test(m))             return 'لم يتم تأكيد البريد بعد. افتح رسالة التأكيد في بريدك.';
  if (/User already registered|already been reg/i.test(m)) return 'هذا البريد له حساب بالفعل. استخدم «تسجيل الدخول».';
  if (/Password should be/i.test(m))              return 'كلمة السر ضعيفة — استخدم 8 أحرف على الأقل.';
  if (/rate limit|too many/i.test(m))             return 'محاولات كثيرة متتالية. انتظر دقيقة ثم أعد المحاولة.';
  if (/Failed to fetch|NetworkError/i.test(m))    return 'تعذّر الاتصال بخادم المصادقة. تأكد من الإنترنت ومن إعدادات Supabase في config.js.';
  return m;
}

root.SonoAuth = { restore, signIn, signUp, signOut, user, mode, client,
                  localAdmins, saveLocalAdmins, lc };
})(window);
