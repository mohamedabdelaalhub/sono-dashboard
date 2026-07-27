/* ============================================================
   ai.js — التحليل الذكي
   يُرسل ملخصاً رقمياً مجمّعاً فقط. لا أسماء مرضى ولا أرقام ملفات.
   ============================================================ */
(function (root) {
'use strict';
const ST = () => root.SonoSettings, AU = () => root.SonoAuth, RO = () => root.SonoRoles;
const r0 = v => Math.round(v);
const p2 = v => +(v * 100).toFixed(1);

/* ============================================================
   بناء الملخّص المُرسل — قائمة بيضاء صارمة
   ============================================================ */
function digest(A, E, cmp, opts) {
  opts = opts || {};
  const k = A.kpi;
  const d = {
    الفترة: { المدى: A.meta.rangeLabel, عدد_الأيام: A.meta.spanDays, أيام_بها_نشاط: A.meta.activeDays },
    المؤشرات: {
      الإيراد: r0(k.revenue), المنصرف: r0(k.cost), الصافي: r0(k.net),
      الهامش_الصافي_نسبة: p2(k.margin),
      المنصرف_إلى_الإيراد_نسبة: p2(k.costRatio),
      عدد_المرضى: k.patients, عدد_الإيصالات: k.receipts, بنود_الخدمة: k.lineItems,
      متوسط_الإيصال: r0(k.avgTicket), متوسط_المريض: r0(k.avgPerPatient),
      المرضى_المتكررون_نسبة: p2(k.repeatRate), مرضى_بزيارة_واحدة: k.oneVisit,
      متوسط_الزيارات_لكل_مريض: +k.visitsPerPatient.toFixed(2),
      إيراد_اليوم_الواحد: r0(k.revPerDay),
      أتعاب_الأطباء: r0(k.doctorFees), أتعاب_الأطباء_إلى_الإيراد_نسبة: p2(k.doctorFeeRatio),
      التكاليف_الثابتة: r0(k.fixedCost), التكاليف_المتغيرة: r0(k.varCost),
      التكاليف_الثابتة_إلى_الإيراد_نسبة: p2(k.fixedRatio),
      نقطة_التعادل: r0(k.breakEvenRev),
      التحصيل_النقدي_نسبة: p2(k.cashShare), التحصيل_الرقمي_نسبة: p2(k.digitalShare),
      تذبذب_الإيراد_اليومي_نسبة: p2(k.cv),
      حصة_أعلى_خدمة_نسبة: p2(k.topServiceShare),
      المستلزمات_المسجلة: r0(k.suppliesRecorded),
      المصروفات_غير_المصنفة_نسبة: p2(k.unclassifiedRatio)
    },
    فئات_الخدمات: A.serviceCats.map(c => ({ الفئة: c.key, الإيراد: r0(c.total), النسبة: p2(c.pct), البنود: c.count })),
    أعلى_الخدمات: A.services.slice(0, 15).map(s => ({ الخدمة: s.key, الإيراد: r0(s.total), المرات: s.count })),
    بنود_المصروف: A.expCats.map(c => ({ البند: c.cat, الطبيعة: c.group, المبلغ: r0(c.total),
                                         نسبة_من_المنصرف: p2(c.pct), الحركات: c.count })),
    طرق_الدفع: A.methods.map(m => ({ الطريقة: m.method, الإيراد: r0(m.total), النسبة: p2(m.pct), العمليات: m.count })),
    أيام_الأسبوع: A.dowAgg.filter(x => x.days).map(x => ({ اليوم: x.dow, متوسط_الإيراد: r0(x.avg), عدد_الأيام: x.days })),
    الاتجاه_اليومي: A.daily.map(x => ({ اليوم: x.date, الوارد: r0(x.rev), المنصرف: r0(x.exp), إيصالات: x.rcpt })),
    الأسبوعي: A.weekly.map(w => ({ الأسبوع: w.idx, الوارد: r0(w.rev), المنصرف: r0(w.exp), أيام: w.days })),
    المستهلكات_من_الملاحظات: A.supplies.map(s => ({ الصنف: s.item, مرات_الذكر: s.mentions })),
    المخاطر_المرصودة: E.risks.map(x => ({ الخطورة: x.sevAr, المجال: x.area, العنوان: x.title,
                                          المؤشر: x.metric, القيمة: x.value, المستهدف: x.target,
                                          الأثر_المالي: r0(x.impact || 0) })),
    مؤشر_الصحة: E.score
  };

  /* الأطباء — بالاسم أو مجهولين حسب الإعداد */
  const named = opts.includeDoctorNames !== false;
  d.الأطباء = A.doctors.map((x, i) => ({
    الطبيب: named ? x.doctor : 'طبيب ' + (i + 1),
    الأتعاب: r0(x.fees), الدفعات: x.payouts, أيام_النشاط: x.days,
    متوسط_الدفعة: r0(x.avg), الحصة_نسبة: p2(x.share)
  }));

  if (cmp) {
    d.مقارنة_بالفترة_السابقة = {};
    ['revenue', 'cost', 'net', 'margin', 'patients', 'avgTicket', 'repeatRate', 'cashShare'].forEach(f => {
      const nm = { revenue: 'الإيراد', cost: 'المنصرف', net: 'الصافي', margin: 'الهامش',
                   patients: 'المرضى', avgTicket: 'متوسط_الإيصال', repeatRate: 'نسبة_التكرار',
                   cashShare: 'حصة_النقدي' }[f];
      const x = cmp[f];
      if (x) d.مقارنة_بالفترة_السابقة[nm] = { الحالي: r0(x.cur * (f === 'margin' || f.includes('Rate') || f.includes('Share') ? 100 : 1)),
                                              السابق: r0(x.prev * (f === 'margin' || f.includes('Rate') || f.includes('Share') ? 100 : 1)),
                                              التغير_نسبة: x.pct === null ? null : p2(x.pct) };
    });
    d.أكبر_تغيرات_المصروف = cmp.expenseMoves.map(m => ({ البند: m.cat, الحالي: r0(m.cur), السابق: r0(m.prev), الفرق: r0(m.diff) }));
    d.أكبر_تغيرات_الخدمات = cmp.serviceMoves.map(m => ({ الخدمة: m.svc, الحالي: r0(m.cur), السابق: r0(m.prev), الفرق: r0(m.diff) }));
  }
  return d;
}

const SYSTEM = `أنت محلل مالي وتشغيلي لمركز طبي في مصر. تتحدث العربية بلهجة مصرية مهنية مفهومة، مباشرة وبلا حشو.

قواعد صارمة:
- اعتمد فقط على الأرقام المعطاة. لا تخترع أي رقم، ولو لم تجد المعلومة قل صراحة إنها غير متاحة في البيانات.
- اربط كل ملاحظة برقمها. «الهامش 32%» أفضل من «الهامش جيد».
- كل المبالغ بالجنيه المصري.
- ركّز على ما يستطيع مدير المركز تنفيذه، لا على وصف الأرقام. الوصف وحده بلا قيمة.
- لو لاحظت شيئاً لم ترصده قائمة المخاطر المرفقة، اذكره — هذه أهم إضافة تقدمها.
- لا تكرر ما هو واضح من الجداول. أضف التفسير والربط.
- اكتب بصيغة Markdown: عناوين ### وفقرات وقوائم قصيرة. لا تستخدم جداول طويلة.`;

/* ============================================================
   نداء المزوّد
   ============================================================ */
async function call(cfg, messages, maxTokens, _retry) {
  const { provider, model, apiKey } = cfg;
  if (!apiKey) throw new Error('لا يوجد مفتاح ذكاء اصطناعي. اطلب من السوبر أدمن إضافته من ⚙ لوحة التحكم.');
  const budget = maxTokens || 2000;

  let url, headers, body, pick;
  if (provider === 'openai') {
    url = 'https://api.openai.com/v1/chat/completions';
    headers = { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey };
    body = { model: model || 'gpt-4o', max_completion_tokens: budget,
             messages: [{ role: 'system', content: SYSTEM }].concat(messages) };
    pick = j => {
      const c = j.choices && j.choices[0];
      return (c && c.message && (c.message.content || c.message.refusal)) || '';
    };
  } else {
    url = 'https://api.anthropic.com/v1/messages';
    headers = {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    };
    body = { model: model || 'claude-sonnet-5', max_tokens: budget, system: SYSTEM, messages };
    /* نأخذ أي كتلة تحمل نصاً، لا كتل type:"text" فقط */
    pick = j => (j.content || [])
      .filter(c => c && typeof c.text === 'string' && c.type !== 'thinking')
      .map(c => c.text).join('\n').trim();
  }

  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (e) {
    throw new Error('تعذّر الاتصال بمزوّد الذكاء الاصطناعي. تأكد من الإنترنت. ' +
                    'لو استمرت المشكلة فقد يكون المتصفح يحجب الطلب (CORS).');
  }
  const txt = await res.text();
  let j = null; try { j = JSON.parse(txt); } catch (e) {}

  if (!res.ok) {
    const m = (j && j.error && (j.error.message || j.error.type)) || txt.slice(0, 250);
    if (res.status === 401 || res.status === 403)
      throw new Error('المفتاح غير صحيح أو منتهٍ أو بلا صلاحية. راجع ⚙ ← إعدادات الذكاء الاصطناعي.');
    if (res.status === 429)
      throw new Error('تجاوزت حد الاستخدام أو نفد الرصيد. راجع حسابك لدى المزوّد.');
    if (res.status === 404 || /model/i.test(m))
      throw new Error('اسم النموذج «' + (model || '') + '» غير معروف لدى المزوّد. غيّره من ⚙ ← إعدادات الذكاء الاصطناعي.');
    if (res.status === 400 && /max_tokens|max_completion/i.test(m))
      throw new Error('حد الكلمات غير مقبول لهذا النموذج: ' + m);
    throw new Error('رفض المزوّد الطلب (' + res.status + '): ' + m);
  }

  const out = pick(j);
  if (out) return out;

  /* رد بلا نص — شخّص السبب بدل رسالة «فارغ» الغامضة */
  const stop  = (j && j.stop_reason) ||
                (j && j.choices && j.choices[0] && j.choices[0].finish_reason) || 'غير معروف';
  const kinds = (j && Array.isArray(j.content) ? j.content.map(c => c.type) : []).join('، ') || 'لا شيء';
  const usage = j && j.usage ? ` (استُهلك ${j.usage.output_tokens || j.usage.completion_tokens || '?'} كلمة)` : '';

  /* استهلك الحد قبل الكتابة — أعد المحاولة مرة واحدة بحد أكبر */
  if ((stop === 'max_tokens' || stop === 'length') && !_retry)
    return await call(cfg, messages, Math.min(budget * 3, 16000), true);

  if (stop === 'max_tokens' || stop === 'length')
    throw new Error('النموذج استهلك حد الكلمات قبل أن يكتب الرد' + usage +
                    '. جرّب نموذجاً أخف من ⚙ ← إعدادات الذكاء الاصطناعي.');
  if (stop === 'refusal' || /refus/i.test(String(stop)))
    throw new Error('النموذج رفض الرد على هذا الطلب. أعد صياغة السؤال.');

  throw new Error('جاء رد بلا نص من النموذج. سبب التوقف: ' + stop +
                  ' · نوع المحتوى: ' + kinds + usage +
                  '. لو تكرر، غيّر اسم النموذج من ⚙ ← إعدادات الذكاء الاصطناعي.');
}

/* اختبار سريع للمفتاح — الحد مرتفع لأن بعض النماذج تُفكّر قبل أن تكتب */
async function ping(cfg) {
  const t = await call(cfg, [{ role: 'user', content: 'رد بكلمة واحدة فقط: تمام' }], 1000);
  return String(t).trim().slice(0, 60);
}

/* ============================================================
   القراءة التنفيذية
   ============================================================ */
async function narrative(A, E, cmp, ctx) {
  const cfg = await resolve();
  const d = digest(A, E, cmp, { includeDoctorNames: ST().get().includeDoctorNames });
  const prompt =
`دي بيانات ${ctx.clinic} — ${ctx.branch} عن الفترة ${A.meta.rangeLabel}.

اكتب قراءة تنفيذية لمالك المركز في حدود 500 كلمة، بالأقسام دي بالظبط:

### الصورة الكبيرة
فقرة واحدة: أين يقف المركز فعلياً هذه الفترة، وهل الأداء صحي أم لا ولماذا.

### ثلاث ملاحظات لم ترصدها القواعد
أهم ثلاث حاجات لفتت نظرك في الأرقام وغير موجودة في قائمة «المخاطر_المرصودة» المرفقة. كل ملاحظة برقمها.

### أخطر قرار مؤجّل
القرار الواحد الذي لو اتأخر شهراً كمان هيكلّف المركز أكتر. قدّر التكلفة بالجنيه.

### أول ثلاث خطوات
ثلاث خطوات تنفيذية هذا الأسبوع، كل خطوة بمسؤول ورقم مستهدف.

البيانات:
${JSON.stringify(d, null, 1)}`;

  return await call(cfg, [{ role: 'user', content: prompt }], 6000);
}

/* ============================================================
   سؤال وجواب
   ============================================================ */
async function ask(question, A, E, cmp, ctx, history) {
  const cfg = await resolve();
  const d = digest(A, E, cmp, { includeDoctorNames: ST().get().includeDoctorNames });
  const msgs = [];
  (history || []).slice(-6).forEach(h => msgs.push({ role: h.role, content: h.content }));
  msgs.push({ role: 'user', content:
`بيانات ${ctx.clinic} عن الفترة ${A.meta.rangeLabel}:
${JSON.stringify(d)}

السؤال: ${question}

جاوب في حدود 200 كلمة، بالأرقام، وبدون مقدمات. لو الإجابة غير موجودة في البيانات قل ذلك بوضوح واذكر ما الذي يلزم إضافته للملف عشان تقدر تجاوب.` });
  return await call(cfg, msgs, 3000);
}

async function resolve() {
  const s = ST().get();
  const isSuper = RO().isSuper(AU().user());
  const apiKey = await ST().resolveKey(AU().client(), isSuper);
  if (!apiKey) {
    throw new Error(isSuper
      ? 'لم تُضِف مفتاح الذكاء الاصطناعي بعد. افتح ⚙ لوحة التحكم ← إعدادات الذكاء الاصطناعي.'
      : 'التحليل الذكي غير مفعّل. اطلب من السوبر أدمن تفعيله.');
  }
  return { provider: s.provider, model: s.model, apiKey };
}

/* ============================================================
   Markdown مبسّط → HTML
   ============================================================ */
function md(src) {
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const lines = String(src || '').split('\n');
  let out = '', list = null;
  const closeList = () => { if (list) { out += `</${list}>`; list = null; } };

  lines.forEach(raw => {
    const t = raw.trim();
    if (!t) { closeList(); return; }
    let m;
    if ((m = t.match(/^#{1,6}\s+(.*)$/))) { closeList(); out += `<h3>${inline(esc(m[1]))}</h3>`; return; }
    if ((m = t.match(/^[-*•]\s+(.*)$/)))  { if (list !== 'ul') { closeList(); out += '<ul>'; list = 'ul'; }
                                            out += `<li>${inline(esc(m[1]))}</li>`; return; }
    if ((m = t.match(/^\d+[.)]\s+(.*)$/))) { if (list !== 'ol') { closeList(); out += '<ol>'; list = 'ol'; }
                                            out += `<li>${inline(esc(m[1]))}</li>`; return; }
    closeList();
    out += `<p>${inline(esc(t))}</p>`;
  });
  closeList();
  return out;

  function inline(s) {
    return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,،:]|$)/g, '$1<em>$2</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
}

root.SonoAI = { narrative, ask, ping, digest, md, call };
})(window);
