/* ============================================================
   admins.js — لوحة التحكم: المستخدمون والصلاحيات + إعدادات الـ AI
   متاحة للسوبر أدمن فقط.
   ============================================================ */
(function (root) {
'use strict';
const AU = () => root.SonoAuth, RO = () => root.SonoRoles, ST = () => root.SonoSettings;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ============================================================
   طبقة البيانات — تعمل محلياً أو على Supabase
   ============================================================ */
async function listUsers() {
  const sb = AU().client();
  if (AU().mode() !== 'supabase' || !sb) {
    return AU().localAdmins().map(a => ({
      key: a.email, email: a.email, name: a.name, role: a.role,
      active: a.active !== false, linked: !!a.hash, ai: !!a.ai_enabled
    }));
  }
  let { data, error } = await sb.from('admins')
    .select('id,email,name,role,active,user_id,ai_enabled').order('created_at', { ascending: true });
  if (error && /ai_enabled/i.test(error.message || '')) {
    ({ data, error } = await sb.from('admins')
      .select('id,email,name,role,active,user_id').order('created_at', { ascending: true }));
    if (!error) hasAiCol = false;
  }
  if (error) throw new Error(dbErr(error.message));
  return (data || []).map(r => ({
    key: r.id, email: r.email, name: r.name, role: r.role,
    active: r.active !== false, linked: !!r.user_id, ai: !!r.ai_enabled
  }));
}
let hasAiCol = true;

async function addUser(email, name, role) {
  email = AU().lc(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('بريد إلكتروني غير صحيح.');
  const sb = AU().client();

  if (AU().mode() !== 'supabase' || !sb) {
    const list = AU().localAdmins();
    if (list.some(x => x.email === email)) throw new Error('هذا البريد مضاف بالفعل.');
    list.push({ email, name: name || email, role: RO().normalize(role), hash: '', active: true, ai_enabled: false });
    AU().saveLocalAdmins(list);
    return;
  }
  const { error } = await sb.from('admins').insert({ email, name: name || email, role: RO().normalize(role), active: true });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) throw new Error('هذا البريد مضاف بالفعل.');
    throw new Error(dbErr(error.message));
  }
}

async function updateUser(key, patch) {
  const sb = AU().client();
  if (AU().mode() !== 'supabase' || !sb) {
    const list = AU().localAdmins();
    const a = list.find(x => x.email === key);
    if (!a) throw new Error('المستخدم غير موجود.');
    Object.assign(a, patch);
    AU().saveLocalAdmins(list);
    return;
  }
  const { error } = await sb.from('admins').update(patch).eq('id', key);
  if (error) throw new Error(dbErr(error.message));
}

async function removeUser(key) {
  const sb = AU().client();
  if (AU().mode() !== 'supabase' || !sb) {
    AU().saveLocalAdmins(AU().localAdmins().filter(x => x.email !== key));
    return;
  }
  const { error } = await sb.from('admins').delete().eq('id', key);
  if (error) throw new Error(dbErr(error.message));
}

function isSuperRow(r) { return RO().normalize(r.role) === 'سوبر أدمن'; }

function dbErr(m) {
  m = String(m || '');
  if (/relation .* does not exist|schema cache/i.test(m))
    return 'جدول الأدمنز غير موجود في Supabase. شغّل ملف supabase/setup.sql أولاً.';
  if (/row-level security|violates|permission/i.test(m))
    return 'ليست لديك صلاحية لهذا الإجراء — إدارة المستخدمين للسوبر أدمن فقط.';
  return m;
}

/* ============================================================
   واجهة المستخدمين
   ============================================================ */
async function renderUsers() {
  const el = $('con-users');
  const me = AU().user();
  const local = AU().mode() !== 'supabase';

  el.innerHTML = `
    <h3>إضافة مستخدم</h3>
    <div class="note">
      ${local
        ? 'أنت في الوضع المحلي: المستخدمون محفوظون في هذا المتصفح فقط ولن يظهروا على أجهزة أخرى. فعّل Supabase ليصبح المستخدمون حقيقيين.'
        : 'أضف البريد والدور، وسيصله رابط دخول مباشر على بريده. لا ترسل له كلمة سر — هو يضبطها بنفسه بعد أول دخول.'}
    </div>
    <div class="frow">
      <div class="fld"><label for="nuEmail">البريد الإلكتروني</label>
        <input type="email" id="nuEmail" dir="ltr" placeholder="name@example.com"></div>
      <div class="fld"><label for="nuName">الاسم</label>
        <input type="text" id="nuName" placeholder="الاسم الكامل"></div>
      <div class="fld narrow"><label for="nuRole">الدور</label>
        <select id="nuRole">${RO().list().map(r => `<option value="${esc(r.key)}">${esc(r.key)}</option>`).join('')}</select></div>
      <div class="fld narrow" style="flex:0 0 auto"><label>&nbsp;</label>
        <button class="btn sm" id="nuAdd">إضافة</button></div>
    </div>
    ${local ? '' : `<label class="toggle" style="margin-bottom:14px">
      <input type="checkbox" id="nuInvite" checked>
      <div><b>إرسال دعوة بالبريد فور الإضافة</b>
        <span>رابط دخول مباشر — يضغطه فيدخل على طول ويضبط كلمة سره من داخل اللوحة، بدل ما يسجّل بنفسه.</span></div>
    </label>`}
    <div id="uMsg"></div>

    <h3 style="margin-top:24px">المستخدمون</h3>
    <div class="note">${RO().list().map(r => `<b>${esc(r.key)}</b>: ${esc(r.desc)}`).join(' &nbsp;·&nbsp; ')}</div>
    <div class="tscroll"><table class="utable">
      <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>تحليل ذكي</th><th>الحالة</th><th>الحساب</th><th></th></tr></thead>
      <tbody id="uBody"><tr><td colspan="7" style="color:var(--muted)">جارٍ التحميل…</td></tr></tbody>
    </table></div>`;

  $('nuAdd').onclick = async () => {
    const em = $('nuEmail').value, nm = $('nuName').value, rl = $('nuRole').value;
    try {
      await addUser(em, nm, rl);
      let extra = '';
      if (!local && $('nuInvite').checked) {
        try { await AU().invite(em); extra = ' وأُرسلت له دعوة برابط دخول مباشر.'; }
        catch (e) { extra = ' لكن تعذّر إرسال الدعوة: ' + e.message; }
      }
      $('nuEmail').value = ''; $('nuName').value = '';
      msg('uMsg', 'ok', (local
        ? 'تمت الإضافة. اطلب منه فتح اللوحة على هذا الجهاز واختيار «حساب جديد».'
        : 'تمت الإضافة.' + (extra || ' اطلب منه فتح رابط اللوحة واختيار «حساب جديد» بنفس البريد، أو اضغط «دعوة» جنب اسمه.')) + (local ? '' : ''));
      await fillUsers();
    } catch (e) { msg('uMsg', 'err', e.message); }
  };
  await fillUsers();
}

async function fillUsers() {
  const body = $('uBody');
  const me = AU().user();
  let rows;
  try { rows = await listUsers(); }
  catch (e) { body.innerHTML = `<tr><td colspan="7"><span class="badge off">${esc(e.message)}</span></td></tr>`; return; }

  const supers = rows.filter(r => RO().normalize(r.role) === 'سوبر أدمن' && r.active).length;

  body.innerHTML = rows.map(r => {
    const isMe = AU().lc(r.email) === AU().lc(me.email);
    const lastSuper = RO().normalize(r.role) === 'سوبر أدمن' && supers <= 1;
    return `<tr data-k="${esc(r.key)}">
      <td>${esc(r.name || '—')}${isMe ? ' <span class="badge on">أنت</span>' : ''}</td>
      <td dir="ltr" style="text-align:left;font-size:12.5px">${esc(r.email)}</td>
      <td><select class="uRole" ${lastSuper ? 'disabled title="لا يمكن تغيير دور آخر سوبر أدمن"' : ''}>
        ${RO().list().map(x => `<option ${RO().normalize(r.role) === x.key ? 'selected' : ''}>${esc(x.key)}</option>`).join('')}
      </select></td>
      <td style="text-align:center">${isSuperRow(r)
        ? '<span class="badge on">دائماً</span>'
        : `<input type="checkbox" class="chk uAi" ${r.ai ? 'checked' : ''} ${hasAiCol ? '' : 'disabled title="شغّل ملف الترقية أولاً"'}>`}</td>
      <td><span class="badge ${r.active ? 'on' : 'off'}">${r.active ? 'نشط' : 'موقوف'}</span></td>
      <td>${r.linked ? '<span class="badge on">مفعّل</span>' : '<span class="badge pend">بانتظار إنشاء الحساب</span>'}</td>
      <td style="white-space:nowrap">
        ${r.linked ? '' : '<button class="btn ghost sm uInv" title="إرسال رابط دخول مباشر">دعوة</button>'}
        <button class="btn ghost sm uPass" title="إرسال رابط تعيين كلمة سر">كلمة السر</button>
        ${lastSuper ? '' : `<button class="btn ghost sm uTog">${r.active ? 'إيقاف' : 'تفعيل'}</button>
        ${isMe ? '' : '<button class="btn ghost sm uDel" title="حذف">حذف</button>'}`}
      </td></tr>`;
  }).join('') || '<tr><td colspan="6" style="color:var(--muted)">لا يوجد مستخدمون.</td></tr>';

  body.querySelectorAll('tr').forEach(tr => {
    const key = tr.dataset.k; if (!key) return;
    const sel = tr.querySelector('.uRole');
    if (sel) sel.onchange = async () => {
      try { await updateUser(key, { role: sel.value }); msg('uMsg', 'ok', 'تم تحديث الدور.'); await fillUsers(); }
      catch (e) { msg('uMsg', 'err', e.message); await fillUsers(); }
    };
    const tog = tr.querySelector('.uTog');
    if (tog) tog.onclick = async () => {
      const on = tog.textContent.trim() === 'تفعيل';
      try { await updateUser(key, { active: on }); await fillUsers(); }
      catch (e) { msg('uMsg', 'err', e.message); }
    };
    const del = tr.querySelector('.uDel');
    if (del) del.onclick = async () => {
      if (!confirm('حذف هذا المستخدم نهائياً من قائمة المصرّح لهم؟')) return;
      try { await removeUser(key); await fillUsers(); msg('uMsg', 'ok', 'تم الحذف.'); }
      catch (e) { msg('uMsg', 'err', e.message); }
    };
    const ai = tr.querySelector('.uAi');
    if (ai) ai.onchange = async () => {
      try {
        await updateUser(key, AU().mode() === 'supabase' ? { ai_enabled: ai.checked } : { ai_enabled: ai.checked });
        msg('uMsg', 'ok', ai.checked ? 'تم السماح له بالتحليل الذكي.' : 'تم منعه من التحليل الذكي.');
      } catch (e) { msg('uMsg', 'err', e.message); ai.checked = !ai.checked; }
    };
    const inv = tr.querySelector('.uInv');
    if (inv) inv.onclick = async () => {
      const em = tr.children[1].textContent.trim();
      inv.disabled = true; inv.textContent = 'جارٍ…';
      try {
        await AU().invite(em);
        msg('uMsg', 'ok', `تم إرسال دعوة إلى ${em}. يضغط الرابط في بريده فيدخل مباشرة، ثم يضبط كلمة سره من زر «كلمة السر» داخل اللوحة.`);
      } catch (e) { msg('uMsg', 'err', e.message); }
      finally { inv.disabled = false; inv.textContent = 'دعوة'; }
    };
    const pw = tr.querySelector('.uPass');
    if (pw) pw.onclick = async () => {
      const em = tr.children[1].textContent.trim();
      try {
        if (AU().mode() === 'supabase') {
          await AU().sendReset(em);
          msg('uMsg', 'ok', `تم إرسال رابط تعيين كلمة سر إلى ${em}. قل له يراجع «الرسائل غير المرغوبة».`);
        } else {
          if (!confirm(`مسح كلمة سر ${em}؟ سيعيد إنشاءها من «حساب جديد».`)) return;
          AU().clearLocalPassword(em);
          await fillUsers();
          msg('uMsg', 'ok', `تم المسح. اطلب منه فتح اللوحة واختيار «حساب جديد» بنفس البريد.`);
        }
      } catch (e) { msg('uMsg', 'err', e.message); }
    };
  });
}

/* ============================================================
   واجهة إعدادات الذكاء الاصطناعي
   ============================================================ */
const MODELS = {
  anthropic: ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'],
  openai   : ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1']
};

function renderAi() {
  const el = $('con-ai');
  const s = ST().get();
  const local = AU().mode() !== 'supabase';

  el.innerHTML = `
    <h3>مفتاح نموذج الذكاء الاصطناعي</h3>
    <div class="note">
      المفتاح يُحفظ على حساب السوبر أدمن ولا يظهر لأي مستخدم آخر مهما كان دوره.
      ${local ? '<b>أنت في الوضع المحلي</b> — المفتاح سيُحفظ في هذا المتصفح فقط. فعّل Supabase ليرتبط بحسابك على أي جهاز.' : ''}
      احصل على مفتاح من
      <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Anthropic Console</a>
      أو <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">OpenAI</a>.
    </div>

    <div class="frow">
      <div class="fld narrow"><label for="aiProv">المزوّد</label>
        <select id="aiProv">
          <option value="anthropic" ${s.provider === 'anthropic' ? 'selected' : ''}>Anthropic — Claude</option>
          <option value="openai"    ${s.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
        </select></div>
      <div class="fld"><label for="aiModel">النموذج</label>
        <input type="text" id="aiModel" dir="ltr" list="mList" value="${esc(s.model)}">
        <datalist id="mList"></datalist>
        <div class="sub">يمكنك كتابة أي اسم نموذج يدعمه المزوّد.</div></div>
    </div>

    <div class="fld">
      <label for="aiKey">المفتاح</label>
      <div class="keyrow">
        <input type="password" id="aiKey" dir="ltr" placeholder="${s.hasKey ? '•••••••• محفوظ بالفعل — اكتب مفتاحاً جديداً لتغييره' : 'sk-ant-…'}">
        <button class="btn ghost sm" id="aiShow" type="button">إظهار</button>
      </div>
      <div class="sub">${s.hasKey ? 'يوجد مفتاح محفوظ. اترك الحقل فارغاً للإبقاء عليه.' : 'لم يُحفظ مفتاح بعد — ميزة التحليل الذكي معطّلة.'}</div>
    </div>

    <label class="toggle">
      <input type="checkbox" id="aiShare" ${s.enableForAdmins ? 'checked' : ''}>
      <div><b>السماح لباقي المستخدمين باستخدام التحليل الذكي</b>
        <span>لن يروا المفتاح، لكن استهلاكهم يُحتسب على رصيدك. مغلق افتراضياً.</span></div>
    </label>

    <label class="toggle">
      <input type="checkbox" id="aiDocs" ${s.includeDoctorNames ? 'checked' : ''}>
      <div><b>إرسال أسماء الأطباء مع الأرقام</b>
        <span>يجعل التوصيات محددة بالاسم. أسماء المرضى وأرقام ملفاتهم لا تُرسل أبداً في كل الأحوال.</span></div>
    </label>

    <div id="aiMsg"></div>
    <div class="frow" style="margin-top:6px">
      <button class="btn sm" id="aiSave">حفظ الإعدادات</button>
      <button class="btn ghost sm" id="aiTest">اختبار الاتصال</button>
      ${s.hasKey ? '<button class="btn ghost sm danger" id="aiDel" style="color:var(--clay)">حذف المفتاح</button>' : ''}
    </div>

    <div class="note" style="margin-top:20px;border-top:1px solid var(--line);padding-top:16px">
      <b>ما الذي يُرسل؟</b> المؤشرات المجمّعة فقط: الإيراد والمنصرف والنسب وفئات الخدمات وبنود المصروف
      والمخاطر المرصودة. لا تُرسل أسماء مرضى ولا أرقام ملفات ولا أي سطر تفصيلي من ملفك.
    </div>`;

  const fillModels = () => {
    const p = $('aiProv').value;
    $('mList').innerHTML = (MODELS[p] || []).map(m => `<option value="${esc(m)}">`).join('');
  };
  fillModels();
  $('aiProv').onchange = () => { fillModels(); $('aiModel').value = (MODELS[$('aiProv').value] || [''])[0]; };
  $('aiShow').onclick = () => {
    const i = $('aiKey');
    i.type = i.type === 'password' ? 'text' : 'password';
    $('aiShow').textContent = i.type === 'password' ? 'إظهار' : 'إخفاء';
  };

  $('aiSave').onclick = async () => {
    const patch = {
      provider: $('aiProv').value,
      model: $('aiModel').value.trim(),
      enableForAdmins: $('aiShare').checked,
      includeDoctorNames: $('aiDocs').checked
    };
    const k = $('aiKey').value.trim();
    if (k) patch.apiKey = k;
    try {
      await ST().save(AU().client(), patch);
      $('aiKey').value = '';
      msg('aiMsg', 'ok', 'تم الحفظ.');
      root.dispatchEvent(new CustomEvent('sono:ai-changed'));
      renderAi();
    } catch (e) { msg('aiMsg', 'err', e.message); }
  };

  $('aiTest').onclick = async () => {
    msg('aiMsg', 'ok', 'جارٍ الاختبار…');
    try {
      const key = $('aiKey').value.trim() || await ST().resolveKey(AU().client(), true);
      if (!key) throw new Error('لا يوجد مفتاح. أدخل المفتاح أولاً ثم اضغط اختبار.');
      const txt = await root.SonoAI.ping({ provider: $('aiProv').value, model: $('aiModel').value.trim(), apiKey: key });
      msg('aiMsg', 'ok', 'الاتصال ناجح ✓ — رد النموذج: ' + txt);
    } catch (e) { msg('aiMsg', 'err', e.message); }
  };

  const del = $('aiDel');
  if (del) del.onclick = async () => {
    if (!confirm('حذف المفتاح المحفوظ؟ سيتوقف التحليل الذكي.')) return;
    try {
      await ST().save(AU().client(), { apiKey: '' });
      ST().reset();
      msg('aiMsg', 'ok', 'تم حذف المفتاح.');
      root.dispatchEvent(new CustomEvent('sono:ai-changed'));
      renderAi();
    } catch (e) { msg('aiMsg', 'err', e.message); }
  };
}

function msg(id, kind, text) {
  const el = $(id);
  if (el) el.innerHTML = `<div class="${kind === 'ok' ? 'ok' : 'err'}">${esc(text)}</div>`;
}

/* ============================================================
   فتح وإغلاق اللوحة
   ============================================================ */
function open() {
  $('console').classList.remove('hide');
  showTab('users');
}
function close() { $('console').classList.add('hide'); }
function showTab(t) {
  document.querySelectorAll('.mtabs button').forEach(b =>
    b.setAttribute('aria-selected', b.dataset.c === t ? 'true' : 'false'));
  $('con-users').classList.toggle('hide', t !== 'users');
  $('con-ai').classList.toggle('hide', t !== 'ai');
  $('con-diag').classList.toggle('hide', t !== 'diag');
  if (t === 'users') renderUsers();
  else if (t === 'ai') renderAi();
  else renderDiag();
}

/* ============================================================
   فحص النظام
   ============================================================ */
async function renderDiag() {
  const el = $('con-diag');
  el.innerHTML = `<h3>فحص النظام</h3>
    <div class="note">يتأكد من الاتصال بـ Supabase ووجود الجداول والسياسات. استخدمه أول ما تظهر أي مشكلة دخول.</div>
    <div id="dgOut"><p class="note">جارٍ الفحص…</p></div>
    <div class="frow" style="margin-top:12px"><button class="btn sm" id="dgRun">إعادة الفحص</button></div>`;
  $('dgRun').onclick = renderDiag;
  const out = $('dgOut');
  try {
    const rows = await AU().diagnose();
    const sb = AU().client();
    if (sb) {
      try {
        const { data, error } = await sb.from('admins').select('email,role,active,user_id');
        if (!error && data)
          rows.push({ ok: data.length > 0, title: 'المستخدمون المصرّح لهم',
            detail: data.length
              ? data.map(d => `${d.email} (${d.role})${d.active ? '' : ' — موقوف'}${d.user_id ? '' : ' — لم ينشئ حسابه بعد'}`).join(' · ')
              : 'الجدول فارغ — أضف نفسك أولاً.' });
      } catch (e) {}
    }
    out.innerHTML = `<div class="diag">${rows.map(r => `
      <div class="row"><span class="ic ${r.ok ? 'y' : 'n'}">${r.ok ? '✓' : '✕'}</span>
        <div><b>${esc(r.title)}</b><span>${esc(r.detail)}</span></div></div>`).join('')}</div>`;
  } catch (e) { out.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}

function init() {
  $('conClose').onclick = close;
  $('console').addEventListener('click', e => { if (e.target.id === 'console') close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.querySelectorAll('.mtabs button').forEach(b => b.onclick = () => showTab(b.dataset.c));
}

root.SonoAdmins = { init, open, close, listUsers, addUser, updateUser, removeUser };
})(window);
