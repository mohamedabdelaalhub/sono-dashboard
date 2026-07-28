/* ============================================================
   insights.js — محرك التحليلات التشغيلية
   لكل نوع تقرير محلّل خاص يُنتج: مؤشرات · رسوم · جداول ·
   فقرات ملخص · مخاطر · توصيات · مهام خطة عمل.
   المخرجات بنفس أشكال rules.js فتُدمج في كل التابات.
   ============================================================ */
(function (root) {
'use strict';

/* ---------- أدوات ---------- */
const N   = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
const S   = v => (v === null || v === undefined) ? '' : String(v).trim();
const fmt = n => Math.round(n).toLocaleString('en-US');
const cur = n => fmt(n) + ' جنيه';
const pc  = v => (isFinite(v) ? (v * 100).toFixed(1) : '0.0') + '%';
const uniq = a => [...new Set(a)];
const sum  = (a, f) => a.reduce((s, r) => s + N(f ? f(r) : r), 0);
const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function cnt(n, one, two, many, acc) {
  n = Math.round(n);
  if (n === 0) return 'لا ' + many;
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return n + ' ' + many;
  return n + ' ' + (acc || many);
}

/* تجميع: يعيد [{k, n, v}] مرتباً تنازلياً */
function grp(rows, key, val) {
  const m = new Map();
  rows.forEach(r => {
    const k = S(typeof key === 'function' ? key(r) : r[key]) || 'غير محدّد';
    const o = m.get(k) || { k, n: 0, v: 0 };
    o.n++; o.v += N(typeof val === 'function' ? val(r) : (val ? r[val] : 0));
    m.set(k, o);
  });
  return [...m.values()].sort((a, b) => (b.v - a.v) || (b.n - a.n));
}
const byCount = a => a.slice().sort((x, y) => y.n - x.n);

/* نسبة اكتمال حقل */
function fill(rows, k) {
  if (!rows.length) return 0;
  return rows.filter(r => S(r[k]) !== '' && r[k] !== null).length / rows.length;
}

/* وقت عربي «١٢:٠٠ م» → دقائق من منتصف الليل */
function mins(t) {
  const s = S(t).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c))
                .replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = +m[1] % 12;
  if (/م|PM|pm/.test(s)) h += 12;
  return h * 60 + (+m[2]);
}
const hhmm = v => String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(Math.round(v % 60)).padStart(2, '0');

/* ---------- مُنشئات الكائنات ---------- */
const kpi = (lbl, val, unit, foot, tone) => ({ lbl, val, unit: unit || '', foot: foot || '', tone: tone || '' });
const tbl = (title, note, head, rows) => ({ title, note: note || '', head, rows });
const cht = (kind, title, note, data, opts) => ({ kind, title, note: note || '', data, opts: opts || {} });
const blk = (h, p) => ({ h, p });

function risk(o) {
  return Object.assign({
    id: 'ins_' + (o.id || 'x'), area: o.area || 'التشغيل', sev: o.sev || 'medium',
    title: o.title, finding: o.finding, impact: N(o.impact), impactNote: o.impactNote || '',
    metric: o.metric || '—', value: o.value || '—', target: o.target || '—', fromInsight: true
  });
}
function reco(o) {
  return { riskId: 'ins_' + (o.id || 'x'), area: o.area || 'التشغيل', sev: o.sev || 'medium',
           title: o.title, steps: o.steps || [], impact: N(o.impact), linkedRisk: o.risk || o.title,
           fromInsight: true };
}
function task(o) {
  return { t: o.t, own: o.own, wk: o.wk, kpi: o.kpi, tgt: o.tgt, pr: o.pr || 2,
           area: o.area || 'التشغيل', riskId: 'ins_' + (o.id || 'x'), sev: o.sev || 'medium',
           why: o.why || '', risk: o.risk || '', metric: o.metric || '—',
           value: o.value || '—', target: o.tgt || '—', impact: N(o.impact),
           steps: o.steps || [], fromInsight: true };
}

/* ============================================================
   المحلّلات — واحد لكل تقرير
   ============================================================ */
const A = {};

/* ---------- مواعيد الحجز ---------- */
A.bookings = function (rows) {
  const n = rows.length;
  const st = grp(rows, 'status');
  const cls = s => {
    const t = S(s);
    if (/الغ|إلغ|ملغ/.test(t)) return 'ملغي';
    if (/عدم الرد|لم يرد|مغلق/.test(t)) return 'عدم الرد';
    if (/لم يحضر|غياب/.test(t)) return 'لم يحضر';
    if (/تم|كشف|حضر|انته|مغادر/.test(t)) return 'تم';
    return 'منتظر';
  };
  const c = { 'تم': 0, 'ملغي': 0, 'عدم الرد': 0, 'لم يحضر': 0, 'منتظر': 0 };
  rows.forEach(r => c[cls(r.status)]++);
  const lost = c['ملغي'] + c['عدم الرد'] + c['لم يحضر'];
  const rLost = n ? lost / n : 0;
  const rDone = n ? c['تم'] / n : 0;
  const online = rows.filter(r => S(r.online) && !/^0$|^-$/.test(S(r.online))).length;
  const days = uniq(rows.map(r => r.date).filter(isDate));
  const docs = grp(rows, 'doctor');
  const spec = grp(rows, 'specialty');

  /* أسوأ الأطباء التزاماً */
  const docLoss = docs.filter(d => d.n >= 20).map(d => {
    const rs = rows.filter(r => S(r.doctor) === d.k);
    const l = rs.filter(r => cls(r.status) !== 'تم' && cls(r.status) !== 'منتظر').length;
    return { k: d.k, n: d.n, lost: l, rate: l / d.n };
  }).sort((x, y) => y.rate - x.rate);

  /* ساعات الذروة */
  const hrs = new Map();
  rows.forEach(r => { const m = mins(r.time); if (m === null) return;
    const h = Math.floor(m / 60); const o = hrs.get(h) || { h, n: 0, lost: 0 };
    o.n++; if (cls(r.status) !== 'تم' && cls(r.status) !== 'منتظر') o.lost++; hrs.set(h, o); });
  const peak = [...hrs.values()].sort((a, b) => b.n - a.n);

  const M = {
    headline: `${cnt(n, 'حجز واحد', 'حجزان', 'حجوزات', 'حجزاً')} خلال الفترة، ` +
              `تحقّق منها ${pc(rDone)} وضاع ${pc(rLost)}.`,
    kpis: [
      kpi('إجمالي الحجوزات', fmt(n), 'حجز', days.length ? `على ${cnt(days.length, 'يوم واحد', 'يومين', 'أيام', 'يوماً')} · ${fmt(n / days.length)} في اليوم` : ''),
      kpi('نسبة التحقق', pc(rDone), '', `${fmt(c['تم'])} حجز تم تنفيذه`, rDone >= .8 ? 'k4' : 'k5'),
      kpi('الطاقة المهدرة', pc(rLost), '', `${fmt(lost)} حجز لم يتحوّل لزيارة`, rLost > .25 ? 'k5' : 'k3'),
      kpi('عدم الرد', pc(n ? c['عدم الرد'] / n : 0), '', `${fmt(c['عدم الرد'])} حجز — بيانات اتصال أو متابعة`, 'k6'),
      kpi('الإلغاء', pc(n ? c['ملغي'] / n : 0), '', `${fmt(c['ملغي'])} حجز ملغى`, 'k5'),
      kpi('الحجز الأونلاين', pc(n ? online / n : 0), '', `${fmt(online)} من ${fmt(n)}`, 'k2'),
      kpi('الأطباء', fmt(docs.length), 'طبيب', `${fmt(spec.length)} تخصص`, 'k2'),
      kpi('أعلى ساعة طلباً', peak[0] ? hhmm(peak[0].h * 60) : '—', '', peak[0] ? `${fmt(peak[0].n)} حجز` : '', 'k3')
    ],
    charts: [
      cht('donut', 'توزيع حالات الحجز', 'كل حالة غير «تم» هي وقت عيادة بلا إيراد',
          Object.keys(c).filter(k => c[k]).map(k => ({ label: k, value: c[k] }))),
      cht('hbars', 'أعلى عشرة أطباء بعدد الحجوزات', 'العدد الكلي بغض النظر عن الحالة',
          byCount(docs).slice(0, 10).map(d => ({ label: d.k, value: d.n })), { suffix: ' حجز' })
    ],
    tables: [
      tbl('التزام الحجز لكل طبيب', 'مرتّب بأعلى نسبة ضياع — من عنده 20 حجزاً فأكثر',
          ['الطبيب', 'الحجوزات', 'ضائع', 'نسبة الضياع'],
          docLoss.slice(0, 15).map(d => [d.k, fmt(d.n), fmt(d.lost), pc(d.rate)])),
      tbl('الحجوزات حسب التخصص', 'يوضّح أين يتركّز الطلب',
          ['التخصص', 'الحجوزات', 'الحصة'],
          spec.slice(0, 12).map(s => [s.k, fmt(s.n), pc(s.n / (n || 1))])),
      tbl('الطلب حسب ساعة اليوم', 'يساعد في توزيع الورديات وتقليل الانتظار',
          ['الساعة', 'الحجوزات', 'ضائع', 'نسبة الضياع'],
          peak.slice(0, 12).map(h => [hhmm(h.h * 60), fmt(h.n), fmt(h.lost), pc(h.lost / h.n)]))
    ],
    blocks: [blk('الطاقة التشغيلية والمواعيد',
      `سجّل النظام ${cnt(n, 'حجزاً واحداً', 'حجزين', 'حجوزات', 'حجزاً')} تحقّق منها ${fmt(c['تم'])} (${pc(rDone)}). ` +
      `الضائع ${fmt(lost)} حجز (${pc(rLost)}) موزّعاً على ${fmt(c['ملغي'])} إلغاء و${fmt(c['عدم الرد'])} عدم رد و${fmt(c['لم يحضر'])} غياب. ` +
      `أعلى تخصص طلباً «${spec[0] ? spec[0].k : '—'}» بـ${spec[0] ? fmt(spec[0].n) : '—'} حجز، ` +
      `وأعلى ساعة ${peak[0] ? hhmm(peak[0].h * 60) : '—'}. الحجز الأونلاين ${pc(n ? online / n : 0)} من الإجمالي.`)],
    risks: [], recos: [], plan: []
  };

  if (rLost > .15) {
    const sev = rLost > .35 ? 'critical' : rLost > .25 ? 'high' : 'medium';
    M.risks.push(risk({ id: 'bookLoss', area: 'التشغيل', sev,
      title: 'نسبة عالية من الحجوزات لا تتحوّل إلى زيارة',
      finding: `${fmt(lost)} حجزاً من ${fmt(n)} (${pc(rLost)}) انتهى بإلغاء أو عدم رد أو غياب. ` +
               `أعلى الأطباء تأثراً «${docLoss[0] ? docLoss[0].k : '—'}» بنسبة ${docLoss[0] ? pc(docLoss[0].rate) : '—'}.`,
      metric: 'نسبة الحجوزات الضائعة', value: pc(rLost), target: '≤ 15%' }));
    M.recos.push(reco({ id: 'bookLoss', sev, title: 'إغلاق فجوة المواعيد الضائعة',
      risk: 'نسبة عالية من الحجوزات لا تتحوّل إلى زيارة',
      steps: ['تفعيل رسالة تأكيد فور الحجز ورسالة تذكير قبل الموعد بـ24 ثم بـ3 ساعات.',
              'اعتماد سياسة تأكيد: حجز بلا تأكيد قبل 12 ساعة يُفتح للانتظار.',
              'بناء قائمة انتظار لكل طبيب تُملأ آلياً عند أي إلغاء.',
              'مراجعة أسبوعية لأعلى ثلاثة أطباء في نسبة الضياع مع سكرتارية العيادة.'] }));
    M.plan.push(task({ id: 'bookLoss', sev, t: 'تفعيل تأكيد وتذكير المواعيد آلياً (24 ساعة + 3 ساعات)',
      own: 'مدير التشغيل + مطوّر النظام', wk: '١–٢', kpi: 'نسبة الحجوزات الضائعة', tgt: '≤ 15%', pr: 1,
      risk: 'نسبة عالية من الحجوزات لا تتحوّل إلى زيارة',
      why: `${pc(rLost)} من الحجوزات لا تتحوّل لزيارة — وقت عيادة مدفوع بلا إيراد.`,
      metric: 'نسبة الحجوزات الضائعة',
      steps: ['ربط بوابة رسائل SMS/واتساب بجدول المواعيد.',
              'قالبان: تأكيد فوري، وتذكير قبل الموعد.',
              'تسجيل رد المريض في حقل «تأكيد» داخل شاشة الحجز.'] }));
    M.plan.push(task({ id: 'bookLoss', sev, t: 'إنشاء قائمة انتظار لكل طبيب تُملأ عند الإلغاء',
      own: 'سكرتارية العيادات', wk: '٢–٣', kpi: 'المواعيد المعاد ملؤها', tgt: '≥ 50% من الملغى', pr: 2,
      risk: 'نسبة عالية من الحجوزات لا تتحوّل إلى زيارة',
      why: 'كل موعد ملغى يمكن إعادة بيعه إن وُجدت قائمة انتظار جاهزة.' }));
  }
  if (n && c['عدم الرد'] / n > .10) {
    M.risks.push(risk({ id: 'noAnswer', area: 'الحوكمة', sev: 'medium',
      title: 'أرقام هواتف المرضى غير محدَّثة',
      finding: `${fmt(c['عدم الرد'])} حجزاً (${pc(c['عدم الرد'] / n)}) انتهى بـ«عدم الرد»، وهو مؤشر على بيانات اتصال قديمة أو خاطئة.`,
      metric: 'نسبة عدم الرد', value: pc(c['عدم الرد'] / n), target: '≤ 10%' }));
    M.recos.push(reco({ id: 'noAnswer', area: 'الحوكمة', sev: 'medium',
      title: 'تنظيف قاعدة أرقام الهواتف', risk: 'أرقام هواتف المرضى غير محدَّثة',
      steps: ['التحقق من الرقم شفهياً في كل زيارة وتحديثه على الشاشة.',
              'رفض حفظ ملف جديد برقم غير مطابق لصيغة 11 رقماً.',
              'حملة تحقق على أرقام المرضى الذين تكرّر معهم «عدم الرد».'] }));
    M.plan.push(task({ id: 'noAnswer', area: 'الحوكمة', sev: 'medium',
      t: 'حملة تحديث أرقام المرضى المتكرّر معهم «عدم الرد»', own: 'خدمة العملاء', wk: '٢–٤',
      kpi: 'نسبة عدم الرد', tgt: '≤ 10%', pr: 2, risk: 'أرقام هواتف المرضى غير محدَّثة',
      why: `${pc(c['عدم الرد'] / n)} من الحجوزات لا يُرد عليها.` }));
  }
  if (n && online / n < .15) {
    M.risks.push(risk({ id: 'lowOnline', area: 'التسويق', sev: 'low',
      title: 'الحجز الأونلاين ضعيف الاستخدام',
      finding: `${pc(online / n)} فقط من الحجوزات تمت أونلاين، والباقي عبر الهاتف — عبء على السكرتارية وفرصة ضائعة خارج ساعات العمل.`,
      metric: 'حصة الحجز الأونلاين', value: pc(online / n), target: '≥ 15%' }));
    M.recos.push(reco({ id: 'lowOnline', area: 'التسويق', sev: 'low',
      title: 'دفع المرضى نحو الحجز الأونلاين', risk: 'الحجز الأونلاين ضعيف الاستخدام',
      steps: ['رابط حجز مباشر في كل رسالة ومنشور.', 'كود QR على مكتب الاستقبال وفي غرف الانتظار.',
              'حافز بسيط: أولوية دور أو خصم رمزي على الحجز الأونلاين.'] }));
  }
  return M;
};

/* ---------- أيام عمل الأطباء ---------- */
A.doctorDays = function (rows, ds, ctx) {
  const perDoc = new Map();
  rows.forEach(r => {
    const d = S(r.doctor) || 'غير محدّد';
    const o = perDoc.get(d) || { k: d, days: new Set(), mins: 0, shifts: 0 };
    if (isDate(r.date)) o.days.add(r.date);
    const a = mins(r.fromTime), b = mins(r.toTime);
    if (a !== null && b !== null) { let h = b - a; if (h < 0) h += 1440; if (h > 0 && h <= 900) { o.mins += h; o.shifts++; } }
    perDoc.set(d, o);
  });
  const docs = [...perDoc.values()].map(o => ({ k: o.k, days: o.days.size, hrs: o.mins / 60, shifts: o.shifts }))
                                   .sort((a, b) => b.days - a.days);
  const totDays = sum(docs, d => d.days), totHrs = sum(docs, d => d.hrs);
  const dates = uniq(rows.map(r => r.date).filter(isDate)).sort();

  /* ربط بالإيراد إن توفّر */
  const rev = (ctx && ctx.doctorRevenue) || {};
  const hasRev = Object.keys(rev).length > 0;
  const withRev = docs.map(d => {
    const r = N(rev[d.k]);
    return Object.assign({}, d, { rev: r, perDay: d.days ? r / d.days : 0, perHr: d.hrs ? r / d.hrs : 0 });
  });
  const idle = withRev.filter(d => hasRev && d.days >= 4 && d.rev === 0);
  const ranked = withRev.filter(d => d.rev > 0).sort((a, b) => a.perDay - b.perDay);

  const M = {
    headline: `${cnt(docs.length, 'طبيب واحد', 'طبيبان', 'أطباء', 'طبيباً')} بإجمالي ${fmt(totDays)} يوم عيادي و${fmt(totHrs)} ساعة.`,
    kpis: [
      kpi('الأطباء العاملون', fmt(docs.length), 'طبيب', `على ${cnt(dates.length, 'يوم واحد', 'يومين', 'أيام', 'يوماً')}`),
      kpi('الأيام العيادية', fmt(totDays), 'يوم', `متوسط ${(docs.length ? totDays / docs.length : 0).toFixed(1)} يوم للطبيب`, 'k2'),
      kpi('إجمالي الساعات', fmt(totHrs), 'ساعة', `متوسط ${(totDays ? totHrs / totDays : 0).toFixed(1)} ساعة لليوم`, 'k3'),
      kpi('أكثر الأطباء حضوراً', docs[0] ? docs[0].k : '—', '', docs[0] ? `${fmt(docs[0].days)} يوم` : '', 'k2'),
      hasRev ? kpi('أعلى عائد لليوم العيادي', withRev.filter(d => d.perDay > 0).sort((a, b) => b.perDay - a.perDay)[0]
                    ? cur(withRev.filter(d => d.perDay > 0).sort((a, b) => b.perDay - a.perDay)[0].perDay) : '—',
                   '', withRev.filter(d => d.perDay > 0).sort((a, b) => b.perDay - a.perDay)[0]
                    ? withRev.filter(d => d.perDay > 0).sort((a, b) => b.perDay - a.perDay)[0].k : '', 'k4')
             : kpi('عائد اليوم العيادي', 'غير متاح', '', 'ارفع تقرير إيراد معه لحسابه', 'k6'),
      kpi('عيادات بلا إيراد', hasRev ? fmt(idle.length) : '—', hasRev ? 'طبيب' : '',
          hasRev ? 'أيام حضور بلا أي إيراد مسجّل' : 'يحتاج تقرير إيراد', idle.length ? 'k5' : 'k4')
    ],
    charts: [
      cht('hbars', 'الأيام العيادية لكل طبيب', 'المقام في معادلة الإنتاجية',
          docs.slice(0, 12).map(d => ({ label: d.k, value: d.days })), { suffix: ' يوم' })
    ].concat(hasRev ? [cht('hbars', 'عائد اليوم العيادي لكل طبيب', 'الإيراد ÷ عدد الأيام — الرقم الذي يقرّر فتح العيادة من إغلاقها',
          withRev.filter(d => d.perDay > 0).sort((a, b) => b.perDay - a.perDay).slice(0, 12)
                 .map(d => ({ label: d.k, value: Math.round(d.perDay) })), { suffix: ' ج' })] : []),
    tables: [
      tbl('جدول إنتاجية الأطباء', hasRev ? 'الإيراد من التقرير المالي المرفوع معه' : 'ارفع تقرير إيراد مع هذا التقرير لإظهار عمود العائد',
          hasRev ? ['الطبيب', 'الأيام', 'الساعات', 'الإيراد', 'عائد اليوم', 'عائد الساعة']
                 : ['الطبيب', 'الأيام', 'الساعات', 'متوسط ساعات اليوم'],
          withRev.slice(0, 25).map(d => hasRev
            ? [d.k, fmt(d.days), fmt(d.hrs), cur(d.rev), cur(d.perDay), cur(d.perHr)]
            : [d.k, fmt(d.days), fmt(d.hrs), (d.days ? d.hrs / d.days : 0).toFixed(1)]))
    ],
    blocks: [blk('توزيع الطاقة الطبية',
      `يعمل بالمركز ${cnt(docs.length, 'طبيب واحد', 'طبيبان', 'أطباء', 'طبيباً')} بإجمالي ${fmt(totDays)} يوم عيادي ` +
      `و${fmt(totHrs)} ساعة، بمتوسط ${(totDays ? totHrs / totDays : 0).toFixed(1)} ساعة لليوم. ` +
      `أكثرهم حضوراً «${docs[0] ? docs[0].k : '—'}» بـ${docs[0] ? fmt(docs[0].days) : '—'} يوم. ` +
      (hasRev ? `أقل عائد ليوم عيادي «${ranked[0] ? ranked[0].k : '—'}» بـ${ranked[0] ? cur(ranked[0].perDay) : '—'}.`
              : 'عائد اليوم العيادي يحتاج رفع تقرير إيراد مع هذا التقرير.'))],
    risks: [], recos: [], plan: []
  };

  if (idle.length) {
    M.risks.push(risk({ id: 'idleDays', area: 'التشغيل', sev: 'high',
      title: 'أطباء يحضرون بلا إيراد مسجّل',
      finding: `${cnt(idle.length, 'طبيب واحد', 'طبيبان', 'أطباء', 'طبيباً')} لهم أيام حضور (${fmt(sum(idle, d => d.days))} يوماً) بلا أي إيراد في تقارير الفترة: ` +
               idle.slice(0, 5).map(d => `${d.k} (${d.days} يوم)`).join('، ') + '.',
      metric: 'أطباء بأيام حضور بلا إيراد', value: fmt(idle.length), target: '0' }));
    M.recos.push(reco({ id: 'idleDays', title: 'مراجعة جدول العيادات منخفضة الطلب',
      risk: 'أطباء يحضرون بلا إيراد مسجّل', sev: 'high',
      steps: ['التأكد أولاً أن الإيراد مربوط بالطبيب في النظام — قد تكون مشكلة تسجيل لا طلب.',
              'إن ثبت ضعف الطلب: تقليل الأيام أو دمج العيادة مع طبيب آخر.',
              'تخصيص ميزانية تسويق موجّهة للتخصصات ذات العيادات الفارغة.'] }));
    M.plan.push(task({ id: 'idleDays', sev: 'high', t: 'مراجعة جدول العيادات التي لا تحقّق إيراداً',
      own: 'مدير التشغيل', wk: '٢–٣', kpi: 'أيام عيادية بلا إيراد', tgt: '0', pr: 1,
      risk: 'أطباء يحضرون بلا إيراد مسجّل',
      why: `${fmt(sum(idle, d => d.days))} يوم عيادي بلا إيراد مسجّل.` }));
  }
  const heavy = docs.filter(d => d.hrs / (d.days || 1) > 12);
  if (heavy.length) {
    M.risks.push(risk({ id: 'longShift', area: 'التشغيل', sev: 'low',
      title: 'ورديات طويلة قد تؤثر على جودة الخدمة',
      finding: `${cnt(heavy.length, 'طبيب واحد', 'طبيبان', 'أطباء', 'طبيباً')} متوسط ورديتهم فوق 12 ساعة: ` +
               heavy.slice(0, 4).map(d => `${d.k} (${(d.hrs / d.days).toFixed(1)} ساعة)`).join('، ') + '.',
      metric: 'متوسط ساعات الوردية', value: (heavy[0].hrs / heavy[0].days).toFixed(1) + ' ساعة', target: '≤ 12 ساعة' }));
  }
  return M;
};

/* ---------- كتالوج الخدمات والأسعار ---------- */
A.services = function (rows) {
  const n = rows.length;
  const priced = rows.filter(r => N(r.price) > 0);
  const zeroP  = rows.filter(r => N(r.price) <= 0);
  const noCost = rows.filter(r => N(r.cost) <= 0);
  const withCost = rows.filter(r => N(r.cost) > 0 && N(r.price) > 0)
                       .map(r => ({ nm: S(r.name), p: N(r.price), c: N(r.cost), m: (N(r.price) - N(r.cost)) / N(r.price) }));
  const neg = withCost.filter(x => x.m <= 0);
  const dept = grp(rows, r => S(r.dept) || S(r.specialty), 'price');
  const avg = priced.length ? sum(priced, r => N(r.price)) / priced.length : 0;
  const top = priced.slice().sort((a, b) => N(b.price) - N(a.price));

  const M = {
    headline: `${cnt(n, 'خدمة واحدة', 'خدمتان', 'خدمات', 'خدمة')} في ${cnt(dept.length, 'قسم واحد', 'قسمان', 'أقسام', 'قسماً')}، ` +
              `${noCost.length === n ? 'بلا أي تكلفة مسجّلة' : `${fmt(noCost.length)} منها بلا تكلفة`}.`,
    kpis: [
      kpi('عدد الخدمات', fmt(n), 'خدمة', `${fmt(dept.length)} قسم`),
      kpi('متوسط السعر', cur(avg), '', `أعلى ${top[0] ? cur(N(top[0].price)) : '—'}`, 'k2'),
      kpi('خدمات بلا تكلفة', fmt(noCost.length), 'خدمة', pc(n ? noCost.length / n : 0) + ' من الكتالوج',
          noCost.length / (n || 1) > .5 ? 'k5' : 'k3'),
      kpi('خدمات بسعر صفر', fmt(zeroP.length), 'خدمة', zeroP.length ? 'لن تُسعَّر عند البيع' : 'لا يوجد', zeroP.length ? 'k5' : 'k4'),
      kpi('هامش قابل للقياس', withCost.length ? pc(sum(withCost, x => x.m) / withCost.length) : 'غير متاح', '',
          withCost.length ? `على ${fmt(withCost.length)} خدمة` : 'عمود التكلفة فارغ', withCost.length ? 'k4' : 'k6'),
      kpi('خدمات بهامش سالب', withCost.length ? fmt(neg.length) : '—', withCost.length ? 'خدمة' : '',
          withCost.length ? 'سعرها أقل من تكلفتها' : 'يحتاج تعبئة التكلفة', neg.length ? 'k5' : 'k4')
    ],
    charts: [
      cht('hbars', 'متوسط السعر حسب القسم', 'يكشف فجوات التسعير بين الأقسام',
          dept.slice(0, 12).map(d => ({ label: d.k, value: Math.round(d.v / (d.n || 1)) })), { suffix: ' ج' }),
      cht('donut', 'عدد الخدمات لكل قسم', 'اتساع الكتالوج',
          byCount(dept).slice(0, 8).map(d => ({ label: d.k, value: d.n })))
    ],
    tables: [
      tbl('ملخص التسعير لكل قسم', 'متوسط وأعلى وأدنى سعر معلن',
          ['القسم', 'عدد الخدمات', 'متوسط السعر', 'أعلى سعر', 'أدنى سعر'],
          dept.slice(0, 15).map(d => {
            const rs = rows.filter(r => (S(r.dept) || S(r.specialty) || 'غير محدّد') === d.k && N(r.price) > 0);
            const ps = rs.map(r => N(r.price));
            return [d.k, fmt(d.n), cur(ps.length ? sum(ps) / ps.length : 0),
                    cur(ps.length ? Math.max.apply(null, ps) : 0), cur(ps.length ? Math.min.apply(null, ps) : 0)];
          })),
      tbl('أعلى عشرين خدمة سعراً', 'راجع أن السعر ما زال مطابقاً للسوق',
          ['الخدمة', 'القسم', 'السعر', 'التكلفة', 'الهامش'],
          top.slice(0, 20).map(r => [S(r.name), S(r.dept) || S(r.specialty), cur(N(r.price)),
            N(r.cost) > 0 ? cur(N(r.cost)) : 'غير مسجّلة',
            N(r.cost) > 0 ? pc((N(r.price) - N(r.cost)) / N(r.price)) : '—']))
    ].concat(neg.length ? [tbl('خدمات تُباع بخسارة', 'سعرها المعلن أقل من تكلفتها المسجّلة',
          ['الخدمة', 'السعر', 'التكلفة', 'الهامش'],
          neg.slice(0, 20).map(x => [x.nm, cur(x.p), cur(x.c), pc(x.m)]))] : []),
    blocks: [blk('هيكل الخدمات والتسعير',
      `كتالوج المركز يضم ${cnt(n, 'خدمة واحدة', 'خدمتين', 'خدمات', 'خدمة')} موزّعة على ${cnt(dept.length, 'قسم واحد', 'قسمين', 'أقسام', 'قسماً')}، ` +
      `بمتوسط سعر ${cur(avg)} وأعلى سعر ${top[0] ? cur(N(top[0].price)) : '—'}. ` +
      (noCost.length === n
        ? 'لا توجد تكلفة مسجّلة لأي خدمة، ولذلك لا يمكن حساب هامش ربح خدمة واحدة — وهذه أهم فجوة بيانات في المركز.'
        : `${fmt(noCost.length)} خدمة بلا تكلفة مسجّلة (${pc(noCost.length / (n || 1))}), و${fmt(neg.length)} خدمة هامشها سالب.`))],
    risks: [], recos: [], plan: []
  };

  if (noCost.length / (n || 1) > .3) {
    const sev = noCost.length === n ? 'critical' : 'high';
    M.risks.push(risk({ id: 'noCost', area: 'التسعير', sev,
      title: 'تكلفة الخدمات غير مسجّلة — الهامش الحقيقي مجهول',
      finding: `${fmt(noCost.length)} خدمة من ${fmt(n)} (${pc(noCost.length / n)}) بلا تكلفة في الكتالوج. ` +
               `بدون التكلفة لا يمكن معرفة أي خدمة تربح وأيها تُستنزف، وكل قرار تسعير أو عرض يصبح تخميناً.`,
      metric: 'خدمات بتكلفة مسجّلة', value: pc(1 - noCost.length / n), target: '≥ 90%' }));
    M.recos.push(reco({ id: 'noCost', area: 'التسعير', sev, title: 'تعبئة تكلفة كل خدمة في الكتالوج',
      risk: 'تكلفة الخدمات غير مسجّلة — الهامش الحقيقي مجهول',
      steps: ['ابدأ بأعلى 20 خدمة إيراداً — تغطي عادة 70% من الإيراد.',
              'التكلفة = مستهلكات + أتعاب الطبيب + حصة الجهاز والغرفة لكل جلسة.',
              'اربط كل خدمة بقائمة مستهلكاتها في المخزن ليُحمَّل الصرف آلياً.',
              'أعد التسعير لأي خدمة هامشها أقل من 40% بعد التحميل.'] }));
    M.plan.push(task({ id: 'noCost', area: 'التسعير', sev, pr: 1,
      t: 'تسجيل تكلفة أعلى 20 خدمة إيراداً في كتالوج الأسعار',
      own: 'المحاسب + مدير التشغيل', wk: '١–٣', kpi: 'خدمات بتكلفة مسجّلة', tgt: '≥ 90%',
      risk: 'تكلفة الخدمات غير مسجّلة — الهامش الحقيقي مجهول',
      why: `${pc(noCost.length / n)} من الخدمات بلا تكلفة، فلا يمكن حساب هامش أي خدمة.`,
      steps: ['حصر مستهلكات كل خدمة بالكمية.', 'إضافة أتعاب الطبيب كنسبة أو مبلغ.',
              'إدخال الرقم في حقل التكلفة داخل شاشة الخدمة.'] }));
  }
  if (zeroP.length) {
    M.risks.push(risk({ id: 'zeroPrice', area: 'التسعير', sev: zeroP.length > n * .1 ? 'medium' : 'low',
      title: 'خدمات بسعر صفر في الكتالوج',
      finding: `${fmt(zeroP.length)} خدمة سعرها صفر — عند بيعها لن يُحمَّل المريض شيئاً وستظهر كإيراد مفقود.`,
      metric: 'خدمات بسعر صفر', value: fmt(zeroP.length), target: '0' }));
    M.plan.push(task({ id: 'zeroPrice', area: 'التسعير', sev: 'medium',
      t: 'تسعير أو إيقاف الخدمات ذات السعر صفر', own: 'المحاسب', wk: '١–٢',
      kpi: 'خدمات بسعر صفر', tgt: '0', pr: 2, risk: 'خدمات بسعر صفر في الكتالوج',
      why: `${fmt(zeroP.length)} خدمة قابلة للبيع بسعر صفر.` }));
  }
  if (neg.length) {
    M.risks.push(risk({ id: 'negMargin', area: 'التسعير', sev: 'high',
      title: 'خدمات تُباع بأقل من تكلفتها',
      finding: `${cnt(neg.length, 'خدمة واحدة', 'خدمتان', 'خدمات', 'خدمة')} سعرها المعلن أقل من التكلفة المسجّلة، أبرزها ` +
               neg.slice(0, 3).map(x => `«${x.nm}» (${cur(x.p)} مقابل تكلفة ${cur(x.c)})`).join('، ') + '.',
      metric: 'خدمات بهامش سالب', value: fmt(neg.length), target: '0' }));
  }
  return M;
};

/* ---------- جرد المخزون ---------- */
A.inventory = function (rows) {
  const n = rows.length;
  const val = sum(rows, r => N(r.total) || N(r.qty) * N(r.cost));
  const negQ = rows.filter(r => N(r.qty) < 0);
  const zeroQ = rows.filter(r => N(r.qty) === 0);
  const noCost = rows.filter(r => N(r.cost) <= 0 && N(r.qty) !== 0);
  const noBar = rows.filter(r => !S(r.barcode));
  const g = grp(rows, 'group', r => N(r.total) || N(r.qty) * N(r.cost));
  const st = grp(rows, 'store', r => N(r.total) || N(r.qty) * N(r.cost));
  const topV = rows.slice().sort((a, b) => (N(b.total) || N(b.qty) * N(b.cost)) - (N(a.total) || N(a.qty) * N(a.cost)));

  const M = {
    headline: `${cnt(n, 'صنف واحد', 'صنفان', 'أصناف', 'صنفاً')} بقيمة ${cur(val)}، ` +
              `منها ${fmt(negQ.length)} برصيد سالب.`,
    kpis: [
      kpi('عدد الأصناف', fmt(n), 'صنف', `${fmt(st.length)} مخزن · ${fmt(g.length)} مجموعة`),
      kpi('قيمة المخزون', cur(val), '', val > 0 ? `متوسط الصنف ${cur(val / (n || 1))}` : 'التكلفة غير مسجّلة', val > 0 ? 'k2' : 'k6'),
      kpi('أرصدة سالبة', fmt(negQ.length), 'صنف', negQ.length ? 'صرف بلا إذن وارد — خلل جرد' : 'لا يوجد', negQ.length ? 'k5' : 'k4'),
      kpi('أصناف بلا تكلفة', fmt(noCost.length), 'صنف', pc(n ? noCost.length / n : 0) + ' من الأصناف', noCost.length ? 'k5' : 'k4'),
      kpi('أصناف بلا باركود', fmt(noBar.length), 'صنف', pc(n ? noBar.length / n : 0) + ' — يبطئ الصرف', 'k6'),
      kpi('أصناف برصيد صفر', fmt(zeroQ.length), 'صنف', 'راجع إن كانت نافدة فعلاً', 'k3')
    ],
    charts: [
      cht('hbars', 'قيمة المخزون حسب المجموعة', 'أين تتجمّد أموالك',
          g.filter(x => x.v > 0).slice(0, 10).map(x => ({ label: x.k, value: Math.round(x.v) })), { suffix: ' ج' }),
      cht('donut', 'عدد الأصناف لكل مخزن', '', byCount(st).slice(0, 6).map(x => ({ label: x.k, value: x.n })))
    ],
    tables: [
      tbl('أعلى عشرين صنفاً قيمة', 'الأصناف التي تحتجز أكبر قدر من رأس المال',
          ['الصنف', 'المخزن', 'الكمية', 'التكلفة', 'القيمة'],
          topV.slice(0, 20).map(r => [S(r.item), S(r.store), fmt(N(r.qty)), cur(N(r.cost)),
                                      cur(N(r.total) || N(r.qty) * N(r.cost))])),
      tbl('المجموعات حسب القيمة', '', ['المجموعة', 'الأصناف', 'القيمة', 'الحصة'],
          g.slice(0, 12).map(x => [x.k, fmt(x.n), cur(x.v), pc(val ? x.v / val : 0)]))
    ].concat(negQ.length ? [tbl('أصناف برصيد سالب', 'رصيد سالب يعني صرفاً بلا وارد مسجّل — خلل يجب إقفاله',
          ['الصنف', 'المخزن', 'الرصيد'],
          negQ.slice(0, 25).map(r => [S(r.item), S(r.store), fmt(N(r.qty))]))] : []),
    blocks: [blk('المخزون والمستهلكات',
      `يضم الجرد ${cnt(n, 'صنفاً واحداً', 'صنفين', 'أصناف', 'صنفاً')} في ${cnt(st.length, 'مخزن واحد', 'مخزنين', 'مخازن', 'مخزناً')} ` +
      `بقيمة إجمالية ${cur(val)}. ` +
      (negQ.length ? `${cnt(negQ.length, 'صنف واحد', 'صنفان', 'أصناف', 'صنفاً')} برصيد سالب — أي صُرف أكثر مما دخل، وهذا خلل جرد يجب إقفاله قبل أي قرار شراء. ` : '') +
      (noCost.length ? `${fmt(noCost.length)} صنف بلا تكلفة، فقيمة المخزون المعروضة أقل من الحقيقة.` : ''))],
    risks: [], recos: [], plan: []
  };

  if (negQ.length) {
    M.risks.push(risk({ id: 'negStock', area: 'المخزون', sev: negQ.length > n * .05 ? 'high' : 'medium',
      title: 'أصناف برصيد سالب في الجرد',
      finding: `${cnt(negQ.length, 'صنف واحد', 'صنفان', 'أصناف', 'صنفاً')} (${pc(negQ.length / (n || 1))} من الأصناف) برصيد سالب، ` +
               `أبرزها ${negQ.slice(0, 3).map(r => `«${S(r.item)}» (${fmt(N(r.qty))})`).join('، ')}. ` +
               `الرصيد السالب يعني صرفاً بلا إذن وارد، فتصبح تكلفة المستهلكات وقيمة المخزون كلاهما غير صحيح.`,
      metric: 'أصناف برصيد سالب', value: fmt(negQ.length), target: '0' }));
    M.recos.push(reco({ id: 'negStock', area: 'المخزون', title: 'إقفال الأرصدة السالبة وضبط دورة الصرف',
      risk: 'أصناف برصيد سالب في الجرد', sev: 'high',
      steps: ['جرد فعلي للأصناف السالبة وتسوية الفرق بقيد معتمد.',
              'منع النظام من الصرف عند رصيد صفر إلا بإذن استثناء موقّع.',
              'ربط إذن الصرف برقم الإيصال أو الخدمة ليُحمَّل على تكلفتها.',
              'جرد دوري شهري لأعلى 30 صنفاً قيمة.'] }));
    M.plan.push(task({ id: 'negStock', area: 'المخزون', sev: 'high', pr: 1,
      t: 'جرد فعلي وتسوية الأصناف ذات الرصيد السالب', own: 'أمين المخزن + المحاسب', wk: '١–٢',
      kpi: 'أصناف برصيد سالب', tgt: '0', risk: 'أصناف برصيد سالب في الجرد',
      why: `${fmt(negQ.length)} صنف برصيد سالب يفسد تكلفة المستهلكات وقيمة المخزون.`,
      steps: ['طباعة قائمة الأصناف السالبة.', 'عدّ فعلي في المخزن.', 'قيد تسوية معتمد من المدير.'] }));
    M.plan.push(task({ id: 'negStock', area: 'المخزون', sev: 'high', pr: 2,
      t: 'منع الصرف من النظام عند رصيد صفر', own: 'مطوّر النظام', wk: '٢–٣',
      kpi: 'حالات صرف بلا رصيد', tgt: '0', risk: 'أصناف برصيد سالب في الجرد',
      why: 'الرصيد السالب يتكوّن أساساً لأن النظام يسمح بالصرف بلا رصيد.' }));
  }
  if (noCost.length && val === 0) {
    M.risks.push(risk({ id: 'stockNoVal', area: 'المخزون', sev: 'high',
      title: 'المخزون بلا تقييم مالي',
      finding: `لا توجد تكلفة مسجّلة لأي صنف، فقيمة المخزون تظهر صفراً. هذا يخفي رأس مال مجمّد ويمنع حساب تكلفة المستهلكات لكل خدمة.`,
      metric: 'قيمة المخزون', value: cur(0), target: 'قيمة فعلية' }));
    M.plan.push(task({ id: 'stockNoVal', area: 'المخزون', sev: 'high', pr: 1,
      t: 'إدخال تكلفة الشراء لكل صنف في المخزن', own: 'أمين المخزن + المشتريات', wk: '١–٣',
      kpi: 'أصناف بتكلفة مسجّلة', tgt: '100%', risk: 'المخزون بلا تقييم مالي',
      why: 'بدون تكلفة الصنف لا قيمة للمخزون ولا تكلفة للخدمة.' }));
  }
  return M;
};

/* ---------- حركة الأصناف ---------- */
A.itemMoves = function (rows) {
  const n = rows.length;
  const neg = rows.filter(r => N(r.balance) < 0), zero = rows.filter(r => N(r.balance) === 0);
  return {
    headline: `${cnt(n, 'صنف واحد', 'صنفان', 'أصناف', 'صنفاً')} متحرّك، ${fmt(zero.length)} منها برصيد صفر.`,
    kpis: [
      kpi('أصناف متحرّكة', fmt(n), 'صنف', 'ظهرت لها حركة في الفترة'),
      kpi('أصناف برصيد صفر', fmt(zero.length), 'صنف', pc(n ? zero.length / n : 0) + ' — مرشّحة للنفاذ', zero.length ? 'k5' : 'k4'),
      kpi('أرصدة سالبة', fmt(neg.length), 'صنف', neg.length ? 'خلل جرد' : 'لا يوجد', neg.length ? 'k5' : 'k4')
    ],
    charts: [],
    tables: [tbl('أصناف تحتاج متابعة', 'رصيد صفر أو سالب', ['الصنف', 'الرصيد'],
      neg.concat(zero).slice(0, 25).map(r => [S(r.item), fmt(N(r.balance))]))],
    blocks: [blk('حركة الأصناف',
      `تحرّك ${cnt(n, 'صنف واحد', 'صنفان', 'أصناف', 'صنفاً')} خلال الفترة، ` +
      `${fmt(zero.length)} منها انتهى رصيدها إلى صفر و${fmt(neg.length)} إلى رصيد سالب.`)],
    risks: zero.length > n * .4 ? [risk({ id: 'stockOut', area: 'المخزون', sev: 'medium',
      title: 'نسبة كبيرة من الأصناف نفدت',
      finding: `${pc(zero.length / n)} من الأصناف المتحرّكة انتهت بالرصيد صفر — خطر توقّف خدمة بسبب نفاد مستهلك.`,
      metric: 'أصناف برصيد صفر', value: pc(zero.length / n), target: '≤ 20%' })] : [],
    recos: [], plan: []
  };
};

/* ---------- حدود الطلب والنفاذ ---------- */
A.orderLimit = function (rows) {
  const below = rows.filter(r => N(r.balance) <= N(r.reorder) || N(r.balance) <= N(r.min));
  return {
    headline: `${cnt(rows.length, 'صنف واحد', 'صنفان', 'أصناف', 'صنفاً')} تحت المراقبة، ${fmt(below.length)} منها بلغ حد الطلب.`,
    kpis: [
      kpi('أصناف مراقَبة', fmt(rows.length), 'صنف', 'لها حد إعادة طلب'),
      kpi('بلغت حد الطلب', fmt(below.length), 'صنف', below.length ? 'اطلب الآن' : 'لا يوجد', below.length ? 'k5' : 'k4')
    ],
    charts: [],
    tables: [tbl('أصناف بلغت حد إعادة الطلب', 'اطلبها قبل أن تتوقّف خدمة بسببها',
      ['الصنف', 'الرصيد', 'حد الطلب', 'الحد الأدنى'],
      rows.slice(0, 25).map(r => [S(r.item), fmt(N(r.balance)), fmt(N(r.reorder)), fmt(N(r.min))]))],
    blocks: [blk('حدود الطلب',
      `${cnt(below.length, 'صنف واحد', 'صنفان', 'أصناف', 'صنفاً')} بلغ حد إعادة الطلب ويحتاج أمر شراء.`)],
    risks: below.length ? [risk({ id: 'reorder', area: 'المخزون', sev: 'medium',
      title: 'أصناف بلغت حد إعادة الطلب',
      finding: `${cnt(below.length, 'صنف واحد', 'صنفان', 'أصناف', 'صنفاً')} رصيده عند أو تحت حد الطلب: ` +
               below.slice(0, 5).map(r => `«${S(r.item)}» (${fmt(N(r.balance))})`).join('، ') + '.',
      metric: 'أصناف تحت حد الطلب', value: fmt(below.length), target: '0' })] : [],
    recos: below.length ? [reco({ id: 'reorder', area: 'المخزون', title: 'إصدار أمر شراء للأصناف الحرجة',
      steps: ['طباعة قائمة الأصناف تحت الحد وإرسالها للمشتريات.',
              'مراجعة حد الطلب: يجب أن يغطي مدة التوريد × متوسط الاستهلاك اليومي.'] })] : [],
    plan: below.length ? [task({ id: 'reorder', area: 'المخزون', sev: 'medium', pr: 1,
      t: 'إصدار أمر شراء للأصناف التي بلغت حد الطلب', own: 'مدير المشتريات', wk: '١',
      kpi: 'أصناف تحت حد الطلب', tgt: '0', risk: 'أصناف بلغت حد إعادة الطلب',
      why: `${fmt(below.length)} صنف عند حد الطلب أو تحته.` })] : []
  };
};

/* ---------- بيانات المرضى ---------- */
A.patients = function (rows) {
  const n = rows.length;
  const F = [['phone', 'الهاتف'], ['nid', 'الرقم القومي'], ['birth', 'تاريخ الميلاد'],
             ['address', 'العنوان'], ['email', 'البريد الإلكتروني']];
  const rates = F.map(([k, nm]) => ({ k, nm, r: fill(rows, k) }));
  const phone = rates.find(x => x.k === 'phone').r;
  const dupPhone = (() => {
    const m = new Map(); rows.forEach(r => { const p = S(r.phone); if (!p) return; m.set(p, (m.get(p) || 0) + 1); });
    return [...m.values()].filter(v => v > 1).length;
  })();
  const br = grp(rows, 'branch');

  const M = {
    headline: `${cnt(n, 'مريض واحد', 'مريضان', 'مرضى', 'مريضاً')} مسجّل، اكتمال الهاتف ${pc(phone)}.`,
    kpis: [
      kpi('المرضى المسجّلون', fmt(n), 'مريض', `${fmt(br.length)} فرع`)
    ].concat(rates.map(x => kpi('اكتمال ' + x.nm, pc(x.r), '', `${fmt(Math.round(x.r * n))} من ${fmt(n)}`,
                                x.r > .8 ? 'k4' : x.r > .5 ? 'k3' : 'k5')))
      .concat([kpi('أرقام مكرّرة', fmt(dupPhone), 'رقم', dupPhone ? 'ملفات مزدوجة محتملة' : 'لا يوجد', dupPhone ? 'k5' : 'k4')]),
    charts: [cht('hbars', 'اكتمال بيانات المريض', 'كل حقل ناقص يقلّل قدرتك على التسويق والتذكير',
      rates.map(x => ({ label: x.nm, value: Math.round(x.r * 100) })), { suffix: '%' })],
    tables: [tbl('نسبة اكتمال كل حقل', 'الحقول الناقصة تعطّل حملات المتابعة والتذكير',
      ['الحقل', 'مكتمل', 'ناقص', 'نسبة الاكتمال'],
      rates.map(x => [x.nm, fmt(Math.round(x.r * n)), fmt(n - Math.round(x.r * n)), pc(x.r)]))],
    blocks: [blk('جودة قاعدة بيانات المرضى',
      `القاعدة تضم ${cnt(n, 'مريضاً واحداً', 'مريضين', 'مرضى', 'مريضاً')}. ` +
      `اكتمال الهاتف ${pc(phone)}، والرقم القومي ${pc(rates.find(x => x.k === 'nid').r)}، ` +
      `وتاريخ الميلاد ${pc(rates.find(x => x.k === 'birth').r)}. ` +
      (dupPhone ? `${fmt(dupPhone)} رقم هاتف مكرّر — احتمال ملفات مزدوجة لنفس المريض. ` : '') +
      `كل حقل ناقص يقلّل قدرتك على التذكير بالمواعيد وحملات إعادة الاستدعاء.`)],
    risks: [], recos: [], plan: []
  };

  const worst = rates.slice().sort((a, b) => a.r - b.r)[0];
  if (worst && worst.r < .5) {
    M.risks.push(risk({ id: 'patData', area: 'الحوكمة', sev: phone < .8 ? 'high' : 'medium',
      title: 'بيانات المرضى ناقصة',
      finding: `أقل الحقول اكتمالاً «${worst.nm}» بنسبة ${pc(worst.r)}. ` +
               `اكتمال الهاتف ${pc(phone)} — وهو الحقل الوحيد الذي يمكّنك من التذكير بالموعد وإعادة الاستدعاء.`,
      metric: 'اكتمال بيانات المريض', value: pc(worst.r), target: '≥ 80% للهاتف' }));
    M.recos.push(reco({ id: 'patData', area: 'الحوكمة', title: 'رفع اكتمال ملف المريض',
      risk: 'بيانات المرضى ناقصة',
      steps: ['جعل الهاتف وتاريخ الميلاد حقلين إلزاميين في شاشة فتح الملف.',
              'التحقق من صيغة الرقم (11 خانة تبدأ بـ01) قبل الحفظ.',
              'سؤال المريض عن التحديث في كل زيارة وتسجيله فوراً.',
              'تقرير أسبوعي بالملفات الناقصة لكل موظف استقبال.'] }));
    M.plan.push(task({ id: 'patData', area: 'الحوكمة', sev: 'medium', pr: 2,
      t: 'جعل الهاتف وتاريخ الميلاد إلزاميين عند فتح ملف مريض',
      own: 'مطوّر النظام + مدير الاستقبال', wk: '١–٢', kpi: 'اكتمال الهاتف', tgt: '≥ 95%',
      risk: 'بيانات المرضى ناقصة', why: `اكتمال الهاتف الآن ${pc(phone)}.` }));
  }
  if (dupPhone > n * .03) {
    M.risks.push(risk({ id: 'dupFile', area: 'الحوكمة', sev: 'medium',
      title: 'ملفات مرضى مزدوجة محتملة',
      finding: `${fmt(dupPhone)} رقم هاتف مسجّل على أكثر من ملف. الملف المزدوج يفسد حساب «المريض المتكرر» ويكرّر التسويق للشخص نفسه.`,
      metric: 'أرقام مكرّرة', value: fmt(dupPhone), target: '0' }));
  }
  return M;
};

/* ---------- أرصدة العملاء / المستحقات ---------- */
A.patientBalance = function (rows) {
  const due = rows.filter(r => N(r.remaining) > 0);
  const tot = sum(rows, r => N(r.amount)), paid = sum(rows, r => N(r.paid)), rem = sum(rows, r => N(r.remaining));
  const rate = tot ? paid / tot : 0;
  const byPat = grp(due, r => S(r.patient) || ('ملف ' + S(r.fileNo)), r => N(r.remaining));
  const byDoc = grp(due, 'doctor', r => N(r.remaining));
  const dates = uniq(rows.map(r => r.date).filter(isDate)).sort();

  const M = {
    headline: rem > 0
      ? `مستحقات غير محصّلة ${cur(rem)} على ${cnt(byPat.length, 'مريض واحد', 'مريضان', 'مرضى', 'مريضاً')}.`
      : `لا توجد مستحقات مفتوحة — التحصيل ${pc(rate)}.`,
    kpis: [
      kpi('قيمة الخدمات', cur(tot), '', `${fmt(rows.length)} سطر`),
      kpi('المحصّل', cur(paid), '', `نسبة التحصيل ${pc(rate)}`, rate > .95 ? 'k4' : 'k3'),
      kpi('المتبقّي', cur(rem), '', `${fmt(due.length)} سطر مفتوح`, rem > 0 ? 'k5' : 'k4'),
      kpi('نسبة التحصيل', pc(rate), '', rate >= .95 ? 'ضمن المستهدف' : 'دون 95%', rate >= .95 ? 'k4' : 'k5'),
      kpi('مرضى عليهم رصيد', fmt(byPat.length), 'مريض', byPat[0] ? `أكبر رصيد ${cur(byPat[0].v)}` : '', 'k6'),
      kpi('متوسط الرصيد المفتوح', cur(byPat.length ? rem / byPat.length : 0), '', '', 'k2')
    ],
    charts: rem > 0 ? [
      cht('hbars', 'أعلى الأرصدة المفتوحة', 'ابدأ التحصيل من الأعلى',
          byPat.slice(0, 12).map(x => ({ label: x.k, value: Math.round(x.v) })), { suffix: ' ج' }),
      cht('donut', 'المستحقات حسب الطبيب', '', byDoc.slice(0, 7).map(x => ({ label: x.k, value: Math.round(x.v) })))
    ] : [],
    tables: [
      tbl('كشف المستحقات لكل مريض', 'قائمة عمل التحصيل — مرتّبة بالأكبر',
          ['المريض', 'عدد الزيارات', 'المتبقّي'],
          byPat.slice(0, 25).map(x => [x.k, fmt(x.n), cur(x.v)])),
      tbl('المستحقات حسب الطبيب', 'يكشف من يسمح بالخروج بلا سداد',
          ['الطبيب', 'الزيارات المفتوحة', 'المتبقّي'],
          byDoc.slice(0, 15).map(x => [x.k, fmt(x.n), cur(x.v)]))
    ],
    blocks: [blk('المستحقات والتحصيل',
      `قيمة الخدمات ${cur(tot)} حُصّل منها ${cur(paid)} (${pc(rate)}) وبقي ${cur(rem)} ` +
      `على ${cnt(byPat.length, 'مريض واحد', 'مريضين', 'مرضى', 'مريضاً')}. ` +
      (byPat[0] ? `أكبر رصيد «${byPat[0].k}» بـ${cur(byPat[0].v)}. ` : '') +
      (byDoc[0] && rem > 0 ? `أعلى الأطباء رصيداً مفتوحاً «${byDoc[0].k}» بـ${cur(byDoc[0].v)}.` : ''))],
    risks: [], recos: [], plan: []
  };

  if (rem > 0 && tot > 0 && rem / tot > .05) {
    const sev = rem / tot > .2 ? 'high' : 'medium';
    M.risks.push(risk({ id: 'ar', area: 'التحصيل', sev,
      title: 'مستحقات غير محصّلة على المرضى',
      finding: `${cur(rem)} (${pc(rem / tot)} من قيمة الخدمات) لم تُحصَّل بعد، موزّعة على ${fmt(byPat.length)} مريضاً. ` +
               (byPat[0] ? `أكبرها «${byPat[0].k}» بـ${cur(byPat[0].v)}.` : ''),
      impact: rem, impactNote: `تحصيل هذه الأرصدة يضيف ${cur(rem)} سيولة فورية.`,
      metric: 'نسبة المتبقّي', value: pc(rem / tot), target: '≤ 5%' }));
    M.recos.push(reco({ id: 'ar', area: 'التحصيل', sev, impact: rem,
      title: 'حملة تحصيل منظّمة للأرصدة المفتوحة', risk: 'مستحقات غير محصّلة على المرضى',
      steps: ['طباعة كشف الأرصدة وترتيبه تنازلياً، والبدء بأعلى 20 رصيداً — يغطون عادة 80% من المبلغ.',
              'اتصال خلال 48 ساعة، ثم رسالة، ثم عرض تقسيط لمن يزيد رصيده عن حد معين.',
              'منع فتح زيارة جديدة لمريض عليه رصيد متجاوز 30 يوماً إلا بموافقة المدير.',
              'تقرير أرصدة أسبوعي على مكتب المدير مع مسؤول محدّد لكل حالة.'] }));
    M.plan.push(task({ id: 'ar', area: 'التحصيل', sev, pr: 1, impact: rem,
      t: 'حملة تحصيل لأعلى 20 رصيداً مفتوحاً', own: 'المحاسب + خدمة العملاء', wk: '١–٣',
      kpi: 'نسبة المتبقّي', tgt: '≤ 5%', risk: 'مستحقات غير محصّلة على المرضى',
      why: `${cur(rem)} مستحقات مفتوحة تمثّل ${pc(rem / tot)} من قيمة الخدمات.`,
      steps: ['استخراج الكشف من الداشبورد.', 'توزيع الحالات على مسؤولين بالاسم.',
              'متابعة يومية حتى الإقفال.'] }));
    M.plan.push(task({ id: 'ar', area: 'التحصيل', sev, pr: 2,
      t: 'سياسة: لا زيارة جديدة مع رصيد متجاوز 30 يوماً بلا موافقة',
      own: 'مدير المركز', wk: '٢', kpi: 'أرصدة تتجاوز 30 يوماً', tgt: 'تناقص شهري',
      risk: 'مستحقات غير محصّلة على المرضى',
      why: 'استمرار الخدمة مع رصيد مفتوح يضاعف المديونية.' }));
  }
  return M;
};

/* ---------- مستحقات الأطباء ---------- */
A.doctorClaim = function (rows) {
  const tot = sum(rows, r => N(r.value)), svc = sum(rows, r => N(r.svcValue));
  const ratio = svc ? tot / svc : 0;
  const byDoc = grp(rows, 'doctor', r => N(r.value)).map(d => {
    const rs = rows.filter(r => S(r.doctor) === d.k);
    const sv = sum(rs, r => N(r.svcValue));
    return Object.assign({}, d, { svc: sv, ratio: sv ? d.v / sv : 0 });
  });
  const ins = grp(rows.filter(r => S(r.insurer)), 'insurer', r => N(r.svcValue));
  const high = byDoc.filter(d => d.svc > 0 && d.ratio > .5);

  const M = {
    headline: `مستحقات أطباء ${cur(tot)} مقابل خدمات ${cur(svc)} — نسبة ${pc(ratio)}.`,
    kpis: [
      kpi('إجمالي المستحقات', cur(tot), '', `${fmt(rows.length)} بند`),
      kpi('قيمة الخدمات', cur(svc), '', 'الأساس المحتسب عليه', 'k2'),
      kpi('نسبة الأطباء', pc(ratio), '', ratio > .4 ? 'أعلى من المعتاد' : 'ضمن المألوف', ratio > .4 ? 'k5' : 'k4'),
      kpi('عدد الأطباء', fmt(byDoc.length), 'طبيب', byDoc[0] ? `أعلاهم ${byDoc[0].k}` : '', 'k3'),
      kpi('أعلى نسبة فردية', byDoc.filter(d => d.svc > 0)[0] ? pc(Math.max.apply(null, byDoc.filter(d => d.svc > 0).map(d => d.ratio))) : '—',
          '', 'راجع العقد إن تجاوزت 50%', 'k6'),
      kpi('حالات تأمين', fmt(ins.length), 'جهة', ins.length ? cur(sum(ins, x => x.v)) : 'لا يوجد', 'k2')
    ],
    charts: [
      cht('hbars', 'المستحق لكل طبيب', '', byDoc.slice(0, 12).map(d => ({ label: d.k, value: Math.round(d.v) })), { suffix: ' ج' })
    ],
    tables: [
      tbl('مستحقات الأطباء بالتفصيل', 'قارن النسبة الفعلية بالعقد قبل الصرف',
          ['الطبيب', 'البنود', 'قيمة الخدمات', 'المستحق', 'النسبة الفعلية'],
          byDoc.slice(0, 25).map(d => [d.k, fmt(d.n), cur(d.svc), cur(d.v), d.svc ? pc(d.ratio) : '—']))
    ].concat(ins.length ? [tbl('الخدمات حسب جهة التأمين', 'كل جنيه هنا معلّق حتى تحصيل المطالبة',
          ['الجهة', 'البنود', 'قيمة الخدمات'], ins.slice(0, 12).map(x => [x.k, fmt(x.n), cur(x.v)]))] : []),
    blocks: [blk('أتعاب الأطباء',
      `المستحق للأطباء ${cur(tot)} على خدمات بقيمة ${cur(svc)}، أي ${pc(ratio)} من قيمة الخدمة. ` +
      (byDoc[0] ? `أعلاهم «${byDoc[0].k}» بـ${cur(byDoc[0].v)}. ` : '') +
      (high.length ? `${cnt(high.length, 'طبيب واحد', 'طبيبان', 'أطباء', 'طبيباً')} نسبتهم الفعلية تتجاوز 50% من قيمة الخدمة.` : ''))],
    risks: [], recos: [], plan: []
  };

  const insVal = sum(ins, x => x.v);
  if (svc > 0 && insVal / svc > .3) {
    M.risks.push(risk({ id: 'claimIns', area: 'التحصيل', sev: insVal / svc > .7 ? 'high' : 'medium',
      title: 'معظم الخدمات المحتسَبة عليها أتعاب مغطّاة بالتأمين',
      finding: `${cur(insVal)} من أصل ${cur(svc)} (${pc(insVal / svc)}) خدمات لجهات تأمين: ` +
               ins.slice(0, 3).map(x => `${x.k} ${cur(x.v)}`).join('، ') + '. ' +
               `أتعاب الطبيب تُستحق فوراً بينما تحصيل التأمين مؤجّل — فجوة سيولة مباشرة.`,
      metric: 'حصة التأمين من الخدمات', value: pc(insVal / svc), target: '≤ 30%' }));
    M.recos.push(reco({ id: 'claimIns', area: 'التحصيل', title: 'مواءمة صرف الأتعاب مع تحصيل التأمين',
      risk: 'معظم الخدمات المحتسَبة عليها أتعاب مغطّاة بالتأمين',
      steps: ['ربط صرف أتعاب الطبيب على حالات التأمين بتحصيل المطالبة فعلياً، أو صرف دفعة مقدّمة جزئية.',
              'كشف عمري للمطالبات ومتابعة أسبوعية مع كل جهة.',
              'مراجعة شروط التعاقد مع الجهات الأبطأ في السداد.'] }));
    M.plan.push(task({ id: 'claimIns', area: 'التحصيل', sev: 'medium', pr: 2,
      t: 'ربط صرف أتعاب حالات التأمين بتحصيل المطالبة', own: 'المحاسب + مدير المركز',
      wk: '٢–٣', kpi: 'حصة التأمين من الخدمات', tgt: '≤ 30%',
      risk: 'معظم الخدمات المحتسَبة عليها أتعاب مغطّاة بالتأمين',
      why: `${pc(insVal / svc)} من الخدمات تأمينية — الأتعاب تخرج قبل أن يدخل المال.` }));
  }
  if (high.length) {
    M.risks.push(risk({ id: 'docPct', area: 'ربحية الأطباء', sev: 'high',
      title: 'نسبة أتعاب بعض الأطباء تتجاوز نصف قيمة الخدمة',
      finding: high.slice(0, 4).map(d => `${d.k} ${pc(d.ratio)}`).join('، ') +
               `. بعد التكاليف الثابتة والمستهلكات قد يصبح صافي المركز من هذه الخدمات قريباً من الصفر.`,
      impact: sum(high, d => Math.max(0, d.v - d.svc * .4)),
      metric: 'نسبة الطبيب من قيمة الخدمة', value: pc(high[0].ratio), target: '≤ 50%' }));
    M.recos.push(reco({ id: 'docPct', area: 'ربحية الأطباء', sev: 'high',
      title: 'إعادة التفاوض على نسب الأطباء المرتفعة', risk: 'نسبة أتعاب بعض الأطباء تتجاوز نصف قيمة الخدمة',
      steps: ['احسب لكل طبيب: إيراده − أتعابه − مستهلكاته − حصته من الثابت = صافيه للمركز.',
              'ابدأ التفاوض بمن صافيه سالب أو قريب من الصفر.',
              'اقترح هيكلاً متدرّجاً: نسبة أقل على الشريحة الأولى وأعلى على ما يتجاوز مستهدفاً شهرياً.',
              'اربط أي نسبة مرتفعة بحد أدنى من الأيام والحضور.'] }));
    M.plan.push(task({ id: 'docPct', area: 'ربحية الأطباء', sev: 'high', pr: 1,
      t: 'إعداد كشف ربحية لكل طبيب والتفاوض على النسب المرتفعة',
      own: 'المحاسب + مدير المركز', wk: '٢–٤', kpi: 'نسبة الطبيب من قيمة الخدمة', tgt: '≤ 50%',
      risk: 'نسبة أتعاب بعض الأطباء تتجاوز نصف قيمة الخدمة',
      why: `${cnt(high.length, 'طبيب واحد', 'طبيبان', 'أطباء', 'طبيباً')} نسبتهم تتجاوز 50%.` }));
  }
  return M;
};

/* ---------- المطالبات التأمينية ---------- */
A.insuranceClaim = function (rows) {
  const prov = grp(rows.filter(r => S(r.provider) && !/اسم الجهة/.test(S(r.provider))), 'provider');
  return {
    headline: `${cnt(prov.length, 'جهة تأمين واحدة', 'جهتا تأمين', 'جهات تأمين', 'جهة تأمين')} في التقرير.`,
    kpis: [kpi('جهات التأمين', fmt(prov.length), 'جهة', 'الجهات الظاهرة في المطالبات'),
           kpi('سطور المطالبة', fmt(rows.length), 'سطر', '', 'k2')],
    charts: [],
    tables: [tbl('جهات التأمين', '', ['الجهة', 'عدد السطور'], prov.slice(0, 20).map(x => [x.k, fmt(x.n)]))],
    blocks: [blk('المطالبات التأمينية',
      `التقرير يغطي ${cnt(prov.length, 'جهة واحدة', 'جهتين', 'جهات', 'جهة')}. ` +
      `المطالبات التأمينية إيراد معلّق: مسجّل ولم يُحصَّل بعد، وكل يوم تأخير في تقديمها يؤخّر السيولة.`)],
    risks: [risk({ id: 'insTrack', area: 'التحصيل', sev: 'medium',
      title: 'المطالبات التأمينية بلا متابعة عمرية',
      finding: `التقرير لا يحمل مبالغ ولا تواريخ مطالبة كافية لحساب عمر الدين. بدون كشف عمري لا يمكن معرفة أي مطالبة تجاوزت مهلة الرفض.`,
      metric: 'كشف عمري للمطالبات', value: 'غير متاح', target: 'شهري' })],
    recos: [reco({ id: 'insTrack', area: 'التحصيل', title: 'بناء كشف عمري للمطالبات التأمينية',
      risk: 'المطالبات التأمينية بلا متابعة عمرية',
      steps: ['تسجيل تاريخ تقديم كل مطالبة ومبلغها وحالتها في النظام.',
              'كشف شهري: 0–30، 31–60، 61–90، فوق 90 يوماً.',
              'رفع أي مطالبة تجاوزت 60 يوماً للمدير قبل انتهاء مهلة الجهة.'] })],
    plan: [task({ id: 'insTrack', area: 'التحصيل', sev: 'medium', pr: 2,
      t: 'إنشاء كشف عمري للمطالبات التأمينية', own: 'المحاسب', wk: '٢–٣',
      kpi: 'مطالبات تتجاوز 60 يوماً', tgt: '0', risk: 'المطالبات التأمينية بلا متابعة عمرية',
      why: 'لا يوجد حالياً ما يقيس عمر المطالبة أو يمنع سقوطها بالتقادم.' })]
  };
};

/* ---------- كشف الحساب ---------- */
A.accountDisplay = function (rows) {
  const d = sum(rows, r => N(r.debit)), c = sum(rows, r => N(r.credit));
  const gap = Math.abs(d - c);
  const dates = uniq(rows.map(r => r.date).filter(isDate)).sort();
  const kinds = grp(rows, r => {
    const t = S(r.desc);
    const m = t.match(/قيد\s+([^\s:رقم]+)/);
    return m ? 'قيد ' + m[1] : (t.split(/\s+/)[0] || 'غير محدّد');
  }, r => N(r.debit) + N(r.credit));

  return {
    headline: `${cnt(rows.length, 'قيد واحد', 'قيدان', 'قيود', 'قيداً')} بإجمالي مدين ${cur(d)} ودائن ${cur(c)}.`,
    kpis: [
      kpi('عدد القيود', fmt(rows.length), 'قيد', dates.length ? `على ${fmt(dates.length)} يوم` : ''),
      kpi('إجمالي المدين', cur(d), '', '', 'k2'),
      kpi('إجمالي الدائن', cur(c), '', '', 'k3'),
      kpi('فرق التوازن', cur(gap), '', gap < 1 ? 'الكشف متوازن' : 'يحتاج مراجعة', gap < 1 ? 'k4' : 'k5'),
      kpi('متوسط القيد', cur(rows.length ? (d + c) / 2 / rows.length : 0), '', '', 'k6'),
      kpi('أنواع القيود', fmt(kinds.length), 'نوع', kinds[0] ? `أكثرها «${kinds[0].k}»` : '', 'k2')
    ],
    charts: [cht('hbars', 'حجم الحركة حسب نوع القيد', 'مدين + دائن',
      kinds.slice(0, 10).map(x => ({ label: x.k, value: Math.round(x.v) })), { suffix: ' ج' })],
    tables: [tbl('أنواع القيود', '', ['نوع القيد', 'العدد', 'إجمالي الحركة'],
      kinds.slice(0, 15).map(x => [x.k, fmt(x.n), cur(x.v)]))],
    blocks: [blk('حركة كشف الحساب',
      `الكشف يضم ${cnt(rows.length, 'قيداً واحداً', 'قيدين', 'قيوداً', 'قيداً')} بإجمالي مدين ${cur(d)} ودائن ${cur(c)}` +
      (gap < 1 ? '، وهو متوازن.' : `، بفرق ${cur(gap)} يحتاج مراجعة.`))],
    risks: gap >= 1 ? [risk({ id: 'unbal', area: 'الحوكمة', sev: 'high',
      title: 'كشف الحساب غير متوازن',
      finding: `فرق ${cur(gap)} بين المدين والدائن. القيد غير المتوازن يعني قيداً ناقص الطرف أو ترحيلاً خاطئاً، ويفسد كل تقرير مالي بعده.`,
      metric: 'فرق المدين والدائن', value: cur(gap), target: '0' })] : [],
    recos: gap >= 1 ? [reco({ id: 'unbal', area: 'الحوكمة', sev: 'high',
      title: 'مراجعة القيود غير المتوازنة', risk: 'كشف الحساب غير متوازن',
      steps: ['استخراج القيود التي طرفها الآخر مفقود.', 'مراجعة ترحيلات نهاية اليوم.',
              'منع النظام من حفظ قيد غير متوازن.'] })] : [],
    plan: gap >= 1 ? [task({ id: 'unbal', area: 'الحوكمة', sev: 'high', pr: 1,
      t: 'مراجعة وتصحيح القيود غير المتوازنة', own: 'المحاسب', wk: '١',
      kpi: 'فرق المدين والدائن', tgt: '0', risk: 'كشف الحساب غير متوازن',
      why: `فرق ${cur(gap)} بين المدين والدائن.` })] : []
  };
};

/* ---------- حساب الأستاذ لمراكز التكلفة ---------- */
A.costCenter = function (rows) {
  const rev = sum(rows, r => N(r.revenue)), exp = sum(rows, r => N(r.expense));
  const acc = grp(rows, 'account', r => N(r.revenue) + N(r.expense));
  const ctr = grp(rows.filter(r => S(r.center)), 'center', r => N(r.revenue) - N(r.expense));
  const accRev = grp(rows, 'account', r => N(r.revenue)).filter(x => x.v > 0);
  const accExp = grp(rows, 'account', r => N(r.expense)).filter(x => x.v > 0);

  return {
    headline: `${cnt(rows.length, 'حركة واحدة', 'حركتان', 'حركات', 'حركة')} بإيراد ${cur(rev)} ومصروف ${cur(exp)}.`,
    kpis: [
      kpi('حركات الأستاذ', fmt(rows.length), 'حركة', `${fmt(acc.length)} حساب`),
      kpi('الإيراد المسجّل', cur(rev), '', '', 'k2'),
      kpi('المصروف المسجّل', cur(exp), '', '', 'k5'),
      kpi('الصافي', cur(rev - exp), '', rev ? `هامش ${pc((rev - exp) / rev)}` : '', rev - exp >= 0 ? 'k4' : 'k5'),
      kpi('عدد الحسابات', fmt(acc.length), 'حساب', accRev[0] ? `أعلى إيراد «${accRev[0].k}»` : '', 'k3'),
      kpi('مراكز التكلفة', fmt(ctr.length), 'مركز', ctr.length ? '' : 'غير مفعّلة في القيود', ctr.length ? 'k2' : 'k6')
    ],
    charts: [
      cht('hbars', 'أعلى الحسابات إيراداً', '', accRev.slice(0, 10).map(x => ({ label: x.k, value: Math.round(x.v) })), { suffix: ' ج' }),
      cht('hbars', 'أعلى الحسابات مصروفاً', '', accExp.slice(0, 10).map(x => ({ label: x.k, value: Math.round(x.v) })), { suffix: ' ج' })
    ],
    tables: [tbl('حركة الحسابات', 'إيراد ومصروف كل حساب', ['الحساب', 'الحركات', 'إيراد', 'مصروف', 'صافي'],
      acc.slice(0, 20).map(a => {
        const rs = rows.filter(r => S(r.account) === a.k);
        const rv = sum(rs, r => N(r.revenue)), ex = sum(rs, r => N(r.expense));
        return [a.k, fmt(a.n), cur(rv), cur(ex), cur(rv - ex)];
      }))].concat(ctr.length ? [tbl('مراكز التكلفة', 'صافي كل مركز', ['المركز', 'الحركات', 'الصافي'],
        ctr.slice(0, 15).map(x => [x.k, fmt(x.n), cur(x.v)]))] : []),
    blocks: [blk('الأستاذ العام ومراكز التكلفة',
      `سُجّلت ${cnt(rows.length, 'حركة واحدة', 'حركتان', 'حركات', 'حركة')} على ${cnt(acc.length, 'حساب واحد', 'حسابين', 'حسابات', 'حساباً')} ` +
      `بإيراد ${cur(rev)} ومصروف ${cur(exp)} وصافي ${cur(rev - exp)}. ` +
      (ctr.length ? `مراكز التكلفة المفعّلة ${fmt(ctr.length)}.`
                  : 'لا يوجد مركز تكلفة على أي حركة — أي لا يمكن معرفة ربحية كل قسم على حدة.'))],
    risks: !ctr.length ? [risk({ id: 'noCenter', area: 'الحوكمة', sev: 'medium',
      title: 'مراكز التكلفة غير مفعّلة على القيود',
      finding: `${fmt(rows.length)} حركة بلا مركز تكلفة. بدونها لا يمكن معرفة ربحية الأسنان مقابل الجلدية مقابل المعمل، ويظل كل قرار توسّع أو إغلاق تخميناً.`,
      metric: 'حركات بمركز تكلفة', value: '0%', target: '≥ 95%' })] : [],
    recos: !ctr.length ? [reco({ id: 'noCenter', area: 'الحوكمة', title: 'تفعيل مراكز التكلفة على كل قيد',
      risk: 'مراكز التكلفة غير مفعّلة على القيود',
      steps: ['تعريف مركز تكلفة لكل قسم طبي وللإدارة والمخزن.',
              'جعل الحقل إلزامياً على شاشة القيد.',
              'قاعدة توزيع للمصروف المشترك (إيجار، كهرباء) بنسبة المساحة أو الإيراد.',
              'أول تقرير ربحية أقسام بعد شهر من التفعيل.'] })] : [],
    plan: !ctr.length ? [task({ id: 'noCenter', area: 'الحوكمة', sev: 'medium', pr: 2,
      t: 'تفعيل مراكز التكلفة وجعلها إلزامية على القيد', own: 'المحاسب + مطوّر النظام',
      wk: '٢–٤', kpi: 'حركات بمركز تكلفة', tgt: '≥ 95%',
      risk: 'مراكز التكلفة غير مفعّلة على القيود',
      why: 'بدون مركز تكلفة لا تُعرف ربحية أي قسم.' })] : []
  };
};

/* ---------- ميزان المراجعة / الدليل المحاسبي ---------- */
function accountStructure(rows, nm, levelKeys) {
  const accs = rows.map(r => S(r.account) || levelKeys.map(k => S(r[k])).filter(Boolean)[0]).filter(Boolean);
  const codes = rows.map(r => S(r.code)).filter(Boolean);
  const lv = {};
  levelKeys.forEach(k => { const v = rows.filter(r => S(r[k])).length; if (v) lv[k] = v; });
  return { accs, codes, lv };
}
A.trialBalance = function (rows) {
  const accs = rows.map(r => S(r.account)).filter(Boolean);
  const codes = rows.map(r => S(r.code)).filter(Boolean);
  const dup = accs.length - uniq(accs).length;
  const roots = grp(rows.filter(r => S(r.code)), r => S(r.code).slice(0, 2));
  return {
    headline: `${cnt(rows.length, 'حساب واحد', 'حسابان', 'حسابات', 'حساباً')} في ميزان المراجعة.`,
    kpis: [
      kpi('عدد الحسابات', fmt(rows.length), 'حساب', `${fmt(uniq(accs).length)} اسماً مميزاً`),
      kpi('حسابات مرمّزة', pc(rows.length ? codes.length / rows.length : 0), '', `${fmt(codes.length)} حساب له كود`, codes.length === rows.length ? 'k4' : 'k5'),
      kpi('أسماء مكرّرة', fmt(dup), 'حساب', dup ? 'قد تسبب ترحيلاً خاطئاً' : 'لا يوجد', dup ? 'k5' : 'k4'),
      kpi('المجموعات الرئيسية', fmt(roots.length), 'مجموعة', '', 'k2')
    ],
    charts: [cht('hbars', 'عدد الحسابات لكل مجموعة رئيسية', 'أول رقمين من الكود',
      roots.slice(0, 10).map(x => ({ label: x.k, value: x.n })), { suffix: ' حساب' })],
    tables: [tbl('عيّنة من شجرة الحسابات', '', ['الكود', 'الحساب'],
      rows.slice(0, 30).map(r => [S(r.code) || '—', S(r.account) || '—']))],
    blocks: [blk('هيكل الحسابات',
      `يضم الميزان ${cnt(rows.length, 'حساباً واحداً', 'حسابين', 'حسابات', 'حساباً')} موزّعة على ` +
      `${cnt(roots.length, 'مجموعة واحدة', 'مجموعتين', 'مجموعات', 'مجموعة')} رئيسية. ` +
      `هذا التقرير لا يحمل أرصدة في نسخته المصدَّرة، لذا يصلح لمراجعة الهيكل لا للتحليل المالي — ` +
      `صدّره بالأرصدة من النظام لتحصل على تحليل مالي كامل.`)],
    risks: [risk({ id: 'tbNoBal', area: 'الحوكمة', sev: 'low',
      title: 'ميزان المراجعة مصدَّر بلا أرصدة',
      finding: `الملف يحتوي على أسماء وأكواد الحسابات فقط دون أعمدة مدين/دائن. لا يمكن التحقق من توازن الدفاتر منه.`,
      metric: 'أعمدة الأرصدة', value: 'غير موجودة', target: 'مدين ودائن' })],
    recos: [reco({ id: 'tbNoBal', area: 'الحوكمة', title: 'تصدير ميزان المراجعة بالأرصدة',
      risk: 'ميزان المراجعة مصدَّر بلا أرصدة',
      steps: ['اختر خيار «بالمجاميع والأرصدة» عند التصدير من النظام.',
              'ارفع الملف مرة أخرى للحصول على تحليل مالي كامل.'] })],
    plan: []
  };
};
A.trialTotals = function (rows) { const M = A.trialBalance(rows); M.headline = `${fmt(rows.length)} حساب في ميزان المجاميع والأرصدة.`; return M; };
A.chartOfAccounts = function (rows) {
  const L = ['l1', 'l2', 'l3', 'l4', 'l5'];
  const per = L.map((k, i) => ({ lv: i + 1, n: rows.filter(r => S(r[k])).length }));
  const deepest = per.filter(x => x.n).slice(-1)[0];
  const names = rows.map(r => L.map(k => S(r[k])).filter(Boolean).slice(-1)[0]).filter(Boolean);
  return {
    headline: `دليل محاسبي بـ${cnt(rows.length, 'بند واحد', 'بندان', 'بنود', 'بنداً')} على ${deepest ? deepest.lv : 0} مستويات.`,
    kpis: [
      kpi('بنود الدليل', fmt(rows.length), 'بند', `${fmt(uniq(names).length)} اسماً مميزاً`),
      kpi('عمق الشجرة', String(deepest ? deepest.lv : 0), 'مستوى', 'كلما زاد العمق زادت دقة التقارير', 'k2')
    ].concat(per.filter(x => x.n).map(x => kpi('حسابات المستوى ' + x.lv, fmt(x.n), 'حساب', '', 'k3'))),
    charts: [cht('hbars', 'توزيع الحسابات على المستويات', '',
      per.filter(x => x.n).map(x => ({ label: 'مستوى ' + x.lv, value: x.n })), { suffix: ' حساب' })],
    tables: [tbl('عيّنة من الدليل', '', ['مستوى 1', 'مستوى 2', 'مستوى 3', 'مستوى 4'],
      rows.slice(0, 30).map(r => [S(r.l1) || '', S(r.l2) || '', S(r.l3) || '', S(r.l4) || '']))],
    blocks: [blk('الدليل المحاسبي',
      `الدليل يضم ${cnt(rows.length, 'بنداً واحداً', 'بندين', 'بنوداً', 'بنداً')} على ${deepest ? deepest.lv : 0} مستويات. ` +
      `عمق الدليل يحدّد أقصى تفصيل ممكن في تقاريرك المالية: كل مستوى إضافي يعني سؤالاً أدق يمكنك الإجابة عليه.`)],
    risks: (deepest && deepest.lv < 4) ? [risk({ id: 'shallowCoa', area: 'الحوكمة', sev: 'low',
      title: 'الدليل المحاسبي ضحل',
      finding: `الدليل يصل إلى ${deepest.lv} مستويات فقط، وهو غير كافٍ للتحليل التفصيلي (المعتاد 4–5 مستويات).`,
      metric: 'عمق الدليل', value: String(deepest.lv), target: '4–5' })] : [],
    recos: [], plan: []
  };
};

/* ---------- توزيع المصروفات / التحليل المالي السنوي ---------- */
A.expenseDist = function (rows) {
  const g = grp(rows, 'branch', 'total');
  const tot = sum(rows, r => N(r.total));
  return {
    headline: `مصروفات موزّعة بإجمالي ${cur(tot)} على ${cnt(g.length, 'فرع واحد', 'فرعان', 'فروع', 'فرعاً')}.`,
    kpis: [
      kpi('إجمالي المصروف', cur(tot), '', `${fmt(rows.length)} سطر`),
      kpi('عدد الفروع/البنود', fmt(g.length), '', g[0] ? `أعلاها «${g[0].k}»` : '', 'k2'),
      kpi('متوسط البند', cur(rows.length ? tot / rows.length : 0), '', '', 'k3')
    ],
    charts: [cht('hbars', 'المصروف حسب البند', '', g.slice(0, 12).map(x => ({ label: x.k, value: Math.round(x.v) })), { suffix: ' ج' })],
    tables: [tbl('توزيع المصروف', '', ['البند', 'القيمة', 'الحصة'],
      g.slice(0, 20).map(x => [x.k, cur(x.v), pc(tot ? x.v / tot : 0)]))],
    blocks: [blk('توزيع المصروفات',
      `إجمالي المصروف في هذا التقرير ${cur(tot)} موزّعاً على ${cnt(g.length, 'بند واحد', 'بندين', 'بنود', 'بنداً')}، ` +
      `أعلاها «${g[0] ? g[0].k : '—'}» بـ${g[0] ? cur(g[0].v) : '—'} أي ${g[0] && tot ? pc(g[0].v / tot) : '—'} من الإجمالي.`)],
    risks: (g[0] && tot && g[0].v / tot > .5) ? [risk({ id: 'expConc', area: 'هيكل التكلفة', sev: 'medium',
      title: 'تركّز المصروف في بند واحد',
      finding: `«${g[0].k}» وحده يمثّل ${pc(g[0].v / tot)} من المصروف (${cur(g[0].v)}). أي زيادة فيه تنعكس مباشرة على الهامش.`,
      metric: 'حصة أكبر بند مصروف', value: pc(g[0].v / tot), target: '≤ 50%' })] : [],
    recos: [], plan: []
  };
};
A.financialYear = function (rows) { const M = A.expenseDist(rows); M.headline = 'تحليل مالي سنوي: ' + M.headline; return M; };

/* ---------- إحصائية العملاء حسب القناة ---------- */
A.newClients = function (rows) {
  const tot = sum(rows, r => N(r.amount)), cl = sum(rows, r => N(r.clients));
  const ch = rows.map(r => ({ k: S(r.channel) || 'غير محدّد', n: N(r.clients), v: N(r.amount) }))
                 .filter(x => x.n || x.v)
                 .map(x => Object.assign(x, { avg: x.n ? x.v / x.n : 0 }))
                 .sort((a, b) => b.v - a.v);
  const best = ch.filter(x => x.n >= 3).sort((a, b) => b.avg - a.avg)[0];
  const worst = ch.filter(x => x.n >= 3).sort((a, b) => a.avg - b.avg)[0];
  const top = ch[0];

  const M = {
    headline: `${cnt(cl, 'عميل واحد', 'عميلان', 'عملاء', 'عميلاً')} من ${cnt(ch.length, 'قناة واحدة', 'قناتان', 'قنوات', 'قناة')} بإجمالي ${cur(tot)}.`,
    kpis: [
      kpi('إجمالي العملاء', fmt(cl), 'عميل', `${fmt(ch.length)} قناة حجز`),
      kpi('قيمة الخدمات', cur(tot), '', `متوسط العميل ${cur(cl ? tot / cl : 0)}`, 'k2'),
      kpi('أعلى قناة عدداً', byCount(ch)[0] ? byCount(ch)[0].k : '—', '', byCount(ch)[0] ? `${fmt(byCount(ch)[0].n)} عميل` : '', 'k3'),
      kpi('أعلى قناة قيمة', top ? top.k : '—', '', top ? cur(top.v) : '', 'k4'),
      kpi('أعلى متوسط عميل', best ? cur(best.avg) : '—', '', best ? best.k : '', 'k4'),
      kpi('أدنى متوسط عميل', worst ? cur(worst.avg) : '—', '', worst ? worst.k : '', 'k5')
    ],
    charts: [
      cht('hbars', 'متوسط قيمة العميل لكل قناة', 'وجّه الإنفاق التسويقي للأعلى متوسطاً لا الأعلى عدداً',
          ch.filter(x => x.n >= 2).sort((a, b) => b.avg - a.avg).slice(0, 12)
            .map(x => ({ label: x.k, value: Math.round(x.avg) })), { suffix: ' ج' }),
      cht('donut', 'حصة كل قناة من الإيراد', '', ch.slice(0, 8).map(x => ({ label: x.k, value: Math.round(x.v) })))
    ],
    tables: [tbl('مردود قنوات الحجز', 'العدد وحده مضلّل — المتوسط هو ما يحدّد أين تنفق',
      ['القناة', 'العملاء', 'قيمة الخدمات', 'متوسط العميل', 'حصة الإيراد'],
      ch.slice(0, 20).map(x => [x.k, fmt(x.n), cur(x.v), cur(x.avg), pc(tot ? x.v / tot : 0)]))],
    blocks: [blk('قنوات جذب العملاء',
      `جاء ${cnt(cl, 'عميل واحد', 'عميلان', 'عملاء', 'عميلاً')} عبر ${cnt(ch.length, 'قناة واحدة', 'قناتين', 'قنوات', 'قناة')} ` +
      `بقيمة خدمات ${cur(tot)} ومتوسط ${cur(cl ? tot / cl : 0)} للعميل. ` +
      (top ? `أعلى القنوات إيراداً «${top.k}» بـ${cur(top.v)} (${pc(tot ? top.v / tot : 0)}). ` : '') +
      (best && worst && best.k !== worst.k
        ? `الفارق بين أعلى متوسط عميل («${best.k}» ${cur(best.avg)}) وأدناه («${worst.k}» ${cur(worst.avg)}) يقارب ${(best.avg / (worst.avg || 1)).toFixed(1)}×.` : ''))],
    risks: [], recos: [], plan: []
  };

  if (top && tot && top.v / tot > .5) {
    M.risks.push(risk({ id: 'chanConc', area: 'التركّز', sev: 'medium',
      title: 'الاعتماد على قناة حجز واحدة',
      finding: `«${top.k}» تجلب ${pc(top.v / tot)} من قيمة الخدمات. توقّف هذه القناة أو تغيّر تكلفتها يهدّد نصف الإيراد.`,
      metric: 'حصة أكبر قناة', value: pc(top.v / tot), target: '≤ 50%' }));
    M.recos.push(reco({ id: 'chanConc', area: 'التركّز', title: 'تنويع مصادر جذب المرضى',
      risk: 'الاعتماد على قناة حجز واحدة',
      steps: ['اختبار قناتين جديدتين بميزانية صغيرة محدّدة لمدة شهر.',
              'قياس متوسط قيمة العميل لكل قناة لا عدد العملاء فقط.',
              'بناء قناة مملوكة (قاعدة أرقام + رسائل) لا تعتمد على طرف ثالث.'] }));
  }
  if (best && worst && worst.avg > 0 && best.avg / worst.avg > 2.5) {
    M.risks.push(risk({ id: 'chanRoi', area: 'التسويق', sev: 'low',
      title: 'فجوة كبيرة في مردود قنوات الحجز',
      finding: `متوسط العميل من «${best.k}» ${cur(best.avg)} مقابل ${cur(worst.avg)} من «${worst.k}» — فارق ${(best.avg / worst.avg).toFixed(1)}×. ` +
               `توجيه الإنفاق للقناة الأعلى متوسطاً يرفع الإيراد بلا زيادة في عدد المرضى.`,
      metric: 'نسبة أعلى متوسط لأدناه', value: (best.avg / worst.avg).toFixed(1) + '×', target: '≤ 2.5×' }));
    M.plan.push(task({ id: 'chanRoi', area: 'التسويق', sev: 'low', pr: 3,
      t: `تحويل جزء من ميزانية «${worst.k}» إلى «${best.k}»`, own: 'مسؤول التسويق', wk: '٣–٤',
      kpi: 'متوسط قيمة العميل', tgt: `≥ ${cur(best.avg)}`, risk: 'فجوة كبيرة في مردود قنوات الحجز',
      why: `متوسط العميل من «${best.k}» يفوق «${worst.k}» بـ${(best.avg / worst.avg).toFixed(1)}×.` }));
  }
  return M;
};

/* ---------- بيان الحالة التفصيلي: تحليل تشغيلي مكمّل ---------- */
A.statusDetail = function (rows) {
  const tot = sum(rows, r => N(r.total));
  const disc = sum(rows, r => N(r.discount));
  const gross = sum(rows, r => N(r.price) * (N(r.qty) || 1)) || tot + disc;
  const dRate = gross ? disc / gross : 0;
  const withD = rows.filter(r => N(r.discount) > 0);
  const ch = grp(rows, 'channel', r => N(r.total));
  const svc = grp(rows, 'service', r => N(r.total));
  const docD = grp(rows, 'doctor', r => N(r.discount)).map(d => {
    const rs = rows.filter(r => S(r.doctor) === d.k);
    const g = sum(rs, r => N(r.price) * (N(r.qty) || 1)) || sum(rs, r => N(r.total)) + d.v;
    return Object.assign({}, d, { rate: g ? d.v / g : 0, gross: g });
  }).filter(d => d.gross > 0).sort((a, b) => b.rate - a.rate);
  const ins = grp(rows.filter(r => S(r.insurer)), 'insurer', r => N(r.total));
  const insShare = tot ? sum(ins, x => x.v) / tot : 0;
  const rated = rows.filter(r => S(r.rating));

  const M = {
    headline: `${cnt(rows.length, 'بند خدمة واحد', 'بندا خدمة', 'بنود خدمة', 'بند خدمة')} بقيمة ${cur(tot)} وخصم ${pc(dRate)}.`,
    kpis: [
      kpi('بنود الخدمة', fmt(rows.length), 'بند', `${fmt(svc.length)} خدمة مختلفة`),
      kpi('إجمالي الخصم', cur(disc), '', `${pc(dRate)} من السعر المعلن`, dRate > .15 ? 'k5' : 'k3'),
      kpi('بنود عليها خصم', pc(rows.length ? withD.length / rows.length : 0), '', `${fmt(withD.length)} بند`, 'k6'),
      kpi('قنوات الحجز', fmt(ch.length), 'قناة', ch[0] ? `أعلاها «${ch[0].k}» ${pc(tot ? ch[0].v / tot : 0)}` : '', 'k2'),
      kpi('حصة التأمين', pc(insShare), '', ins.length ? `${fmt(ins.length)} جهة` : 'لا يوجد', insShare > .3 ? 'k5' : 'k4'),
      kpi('بنود مقيَّمة', pc(rows.length ? rated.length / rows.length : 0), '', 'تقييم المريض مسجّل', rated.length ? 'k4' : 'k6')
    ],
    charts: [
      cht('hbars', 'نسبة الخصم لكل طبيب', 'الخصم قرار تسعير — لا يجب أن يُترك بلا سقف',
          docD.slice(0, 12).map(d => ({ label: d.k, value: +(d.rate * 100).toFixed(1) })), { suffix: '%' }),
      cht('donut', 'الإيراد حسب قناة الحجز', '', ch.slice(0, 7).map(x => ({ label: x.k, value: Math.round(x.v) })))
    ],
    tables: [
      tbl('الخصومات حسب الطبيب', 'من يمنح أكبر خصم نسبةً إلى ما يبيعه',
          ['الطبيب', 'البنود', 'السعر المعلن', 'الخصم', 'نسبة الخصم'],
          docD.slice(0, 20).map(d => [d.k, fmt(d.n), cur(d.gross), cur(d.v), pc(d.rate)])),
      tbl('الإيراد حسب قناة الحجز', 'أين يأتي المال فعلاً',
          ['القناة', 'البنود', 'الإيراد', 'الحصة', 'متوسط البند'],
          ch.slice(0, 12).map(x => [x.k, fmt(x.n), cur(x.v), pc(tot ? x.v / tot : 0), cur(x.n ? x.v / x.n : 0)]))
    ].concat(ins.length ? [tbl('الإيراد حسب جهة التأمين', 'إيراد مؤجّل التحصيل',
          ['الجهة', 'البنود', 'الإيراد', 'الحصة'],
          ins.slice(0, 12).map(x => [x.k, fmt(x.n), cur(x.v), pc(tot ? x.v / tot : 0)]))] : []),
    blocks: [blk('الخصومات وقنوات البيع',
      `بلغ الخصم ${cur(disc)} أي ${pc(dRate)} من السعر المعلن، على ${fmt(withD.length)} بنداً من ${fmt(rows.length)}. ` +
      (docD[0] ? `أعلى الأطباء خصماً «${docD[0].k}» بنسبة ${pc(docD[0].rate)}. ` : '') +
      (ch[0] ? `أعلى قناة «${ch[0].k}» بـ${pc(tot ? ch[0].v / tot : 0)} من الإيراد. ` : '') +
      (insShare > 0 ? `حصة التأمين ${pc(insShare)} — إيراد مسجّل لكن تحصيله مؤجّل.` : 'لا يوجد إيراد تأمين في هذه الفترة.'))],
    risks: [], recos: [], plan: []
  };

  if (dRate > .12) {
    const sev = dRate > .25 ? 'high' : 'medium';
    M.risks.push(risk({ id: 'discount', area: 'التسعير والخصومات', sev,
      title: 'الخصومات تلتهم جزءاً كبيراً من السعر المعلن',
      finding: `الخصم ${cur(disc)} أي ${pc(dRate)} من السعر المعلن. ` +
               (docD[0] ? `أعلى الممنوحين «${docD[0].k}» بنسبة ${pc(docD[0].rate)} مقابل متوسط عام ${pc(dRate)}.` : ''),
      impact: Math.max(0, disc - gross * .10),
      impactNote: `خفض متوسط الخصم إلى 10% يعيد ${cur(Math.max(0, disc - gross * .10))} في الفترة.`,
      metric: 'نسبة الخصم', value: pc(dRate), target: '≤ 12%' }));
    M.recos.push(reco({ id: 'discount', area: 'التسعير والخصومات', sev,
      title: 'ضبط سياسة الخصم بسقف وصلاحية', risk: 'الخصومات تلتهم جزءاً كبيراً من السعر المعلن',
      impact: Math.max(0, disc - gross * .10),
      steps: ['سقف خصم لكل مستوى: استقبال 5%، مدير عيادة 10%، مدير المركز فوق ذلك.',
              'إلزام حقل «سبب الخصم» قبل الحفظ ومنع الحفظ بدونه.',
              'مراجعة أسبوعية لأعلى ثلاثة أطباء في نسبة الخصم.',
              'استبدال الخصم المفتوح بباقات مسعّرة مسبقاً تحمي الهامش.'] }));
    M.plan.push(task({ id: 'discount', area: 'التسعير والخصومات', sev, pr: 1,
      impact: Math.max(0, disc - gross * .10),
      t: 'اعتماد سقف خصم بصلاحية على شاشة الفاتورة', own: 'مدير المركز + مطوّر النظام',
      wk: '١–٢', kpi: 'نسبة الخصم', tgt: '≤ 12%',
      risk: 'الخصومات تلتهم جزءاً كبيراً من السعر المعلن',
      why: `الخصم الحالي ${pc(dRate)} من السعر المعلن أي ${cur(disc)} في الفترة.`,
      steps: ['تحديد سقف لكل مستوى صلاحية.', 'برمجة المنع في النظام.',
              'حقل سبب الخصم إلزامي.', 'تقرير خصومات أسبوعي.'] }));
  }
  if (insShare > .3) {
    M.risks.push(risk({ id: 'insShare', area: 'التحصيل', sev: 'medium',
      title: 'حصة كبيرة من الإيراد معلّقة على شركات التأمين',
      finding: `${pc(insShare)} من الإيراد (${cur(sum(ins, x => x.v))}) عبر ${cnt(ins.length, 'جهة واحدة', 'جهتان', 'جهات', 'جهة')}. ` +
               `هذا إيراد مسجّل لكنه لم يدخل الخزينة، ويخضع لمهل ورفض جزئي.`,
      metric: 'حصة التأمين من الإيراد', value: pc(insShare), target: '≤ 30%' }));
  }
  return M;
};

/* ---------- بيان الحالة المجمع ---------- */
A.statusSummary = function (rows) {
  const net = sum(rows, r => N(r.net)), gross = sum(rows, r => N(r.gross)), disc = sum(rows, r => N(r.discount));
  const q = sum(rows, r => N(r.qty));
  const docs = grp(rows, 'doctor', r => N(r.net));
  const svc = grp(rows, 'service', r => N(r.net));
  const dRate = gross ? disc / gross : 0;
  const M = {
    headline: `${cnt(svc.length, 'خدمة واحدة', 'خدمتان', 'خدمات', 'خدمة')} بصافي ${cur(net)} لـ${cnt(docs.length, 'طبيب واحد', 'طبيبان', 'أطباء', 'طبيباً')}.`,
    kpis: [
      kpi('الصافي', cur(net), '', `${fmt(q)} وحدة مباعة`),
      kpi('السعر المعلن', cur(gross), '', `خصم ${cur(disc)} (${pc(dRate)})`, 'k2'),
      kpi('عدد الخدمات', fmt(svc.length), 'خدمة', svc[0] ? `أعلاها «${svc[0].k}»` : '', 'k3'),
      kpi('عدد الأطباء', fmt(docs.length), 'طبيب', docs[0] ? `أعلاهم «${docs[0].k}»` : '', 'k2'),
      kpi('متوسط سعر الوحدة', cur(q ? net / q : 0), '', '', 'k6'),
      kpi('حصة أعلى طبيب', pc(net && docs[0] ? docs[0].v / net : 0), '', docs[0] ? docs[0].k : '',
          net && docs[0] && docs[0].v / net > .25 ? 'k5' : 'k4')
    ],
    charts: [
      cht('hbars', 'الصافي لكل طبيب', '', docs.slice(0, 12).map(d => ({ label: d.k, value: Math.round(d.v) })), { suffix: ' ج' }),
      cht('hbars', 'أعلى الخدمات صافياً', '', svc.slice(0, 12).map(s => ({ label: s.k, value: Math.round(s.v) })), { suffix: ' ج' })
    ],
    tables: [
      tbl('أداء الأطباء', '', ['الطبيب', 'البنود', 'الصافي', 'الحصة'],
          docs.slice(0, 20).map(d => [d.k, fmt(d.n), cur(d.v), pc(net ? d.v / net : 0)])),
      tbl('أعلى الخدمات', '', ['الخدمة', 'البنود', 'الصافي', 'الحصة'],
          svc.slice(0, 20).map(s => [s.k, fmt(s.n), cur(s.v), pc(net ? s.v / net : 0)]))
    ],
    blocks: [blk('الخدمات والأطباء',
      `صافي الخدمات ${cur(net)} من سعر معلن ${cur(gross)} بخصم ${pc(dRate)}. ` +
      `أعلى طبيب «${docs[0] ? docs[0].k : '—'}» بـ${docs[0] ? pc(net ? docs[0].v / net : 0) : '—'} من الصافي، ` +
      `وأعلى خدمة «${svc[0] ? svc[0].k : '—'}» بـ${svc[0] ? pc(net ? svc[0].v / net : 0) : '—'}.`)],
    risks: [], recos: [], plan: []
  };
  if (docs[0] && net && docs[0].v / net > .3) {
    M.risks.push(risk({ id: 'docConc2', area: 'التركّز', sev: 'medium',
      title: 'تركّز الإيراد في طبيب واحد',
      finding: `«${docs[0].k}» يحقّق ${pc(docs[0].v / net)} من صافي الخدمات (${cur(docs[0].v)}). رحيله أو مرضه يهدّد ثلث الإيراد.`,
      impact: docs[0].v * .3,
      metric: 'حصة أعلى طبيب', value: pc(docs[0].v / net), target: '≤ 30%' }));
  }
  return M;
};

/* ---------- إيصالات الاستلام ---------- */
A.receipts = function (rows) {
  const tot = sum(rows, r => N(r.amount));
  const users = grp(rows, 'user', r => N(r.amount));
  const docs = grp(rows, 'doctor', r => N(r.amount));
  const noFee = rows.filter(r => N(r.docPct) === 0 && N(r.docAmount) === 0 && S(r.doctor) && !/تمريض|خدمات/.test(S(r.doctor)));
  const fees = sum(rows, r => N(r.docAmount));
  const dates = uniq(rows.map(r => r.date).filter(isDate));

  const M = {
    headline: `${cnt(rows.length, 'إيصال واحد', 'إيصالان', 'إيصالات', 'إيصالاً')} بإجمالي ${cur(tot)}.`,
    kpis: [
      kpi('عدد الإيصالات', fmt(rows.length), 'إيصال', dates.length ? `على ${fmt(dates.length)} يوم` : ''),
      kpi('إجمالي التحصيل', cur(tot), '', `متوسط الإيصال ${cur(rows.length ? tot / rows.length : 0)}`, 'k2'),
      kpi('أتعاب الأطباء', cur(fees), '', tot ? `${pc(fees / tot)} من التحصيل` : '', fees / (tot || 1) > .4 ? 'k5' : 'k4'),
      kpi('موظفو التحصيل', fmt(users.length), 'موظف', users[0] ? `أعلاهم «${users[0].k}»` : '', 'k3'),
      kpi('إيصالات بلا نسبة طبيب', fmt(noFee.length), 'إيصال', noFee.length ? 'قد تكون أتعاب غير مسجّلة' : 'لا يوجد', noFee.length ? 'k5' : 'k4'),
      kpi('متوسط اليوم', cur(dates.length ? tot / dates.length : 0), '', '', 'k6')
    ],
    charts: [
      cht('hbars', 'التحصيل لكل موظف', 'الفروق تكشف مشاكل تدريب أو التزام',
          users.slice(0, 12).map(u => ({ label: u.k, value: Math.round(u.v) })), { suffix: ' ج' }),
      cht('hbars', 'التحصيل لكل طبيب', '', docs.slice(0, 12).map(d => ({ label: d.k, value: Math.round(d.v) })), { suffix: ' ج' })
    ],
    tables: [
      tbl('أداء موظفي التحصيل', '', ['الموظف', 'الإيصالات', 'المبلغ', 'متوسط الإيصال', 'الحصة'],
          users.slice(0, 15).map(u => [u.k, fmt(u.n), cur(u.v), cur(u.n ? u.v / u.n : 0), pc(tot ? u.v / tot : 0)])),
      tbl('التحصيل وأتعاب الأطباء', '', ['الطبيب', 'الإيصالات', 'المحصّل', 'الأتعاب', 'النسبة الفعلية'],
          docs.slice(0, 20).map(d => {
            const rs = rows.filter(r => S(r.doctor) === d.k);
            const f = sum(rs, r => N(r.docAmount));
            return [d.k, fmt(d.n), cur(d.v), cur(f), d.v ? pc(f / d.v) : '—'];
          }))
    ],
    blocks: [blk('التحصيل والإيصالات',
      `حُصّل ${cur(tot)} عبر ${cnt(rows.length, 'إيصال واحد', 'إيصالين', 'إيصالات', 'إيصالاً')} ` +
      `بمتوسط ${cur(rows.length ? tot / rows.length : 0)} للإيصال. ` +
      `شارك في التحصيل ${cnt(users.length, 'موظف واحد', 'موظفان', 'موظفون', 'موظفاً')}، ` +
      `أعلاهم «${users[0] ? users[0].k : '—'}» بـ${users[0] ? pc(tot ? users[0].v / tot : 0) : '—'}. ` +
      `أتعاب الأطباء المسجّلة ${cur(fees)} أي ${pc(tot ? fees / tot : 0)} من التحصيل.`)],
    risks: [], recos: [], plan: []
  };
  if (noFee.length > rows.length * .2) {
    M.risks.push(risk({ id: 'noFeeRec', area: 'ربحية الأطباء', sev: 'medium',
      title: 'إيصالات بلا نسبة طبيب مسجّلة',
      finding: `${fmt(noFee.length)} إيصالاً (${pc(noFee.length / rows.length)}) مرتبط بطبيب لكن بلا نسبة أو مبلغ أتعاب. ` +
               `هذا يجعل أتعاب الأطباء الظاهرة أقل من الحقيقة ويشوّه حساب ربحية كل طبيب.`,
      metric: 'إيصالات بنسبة طبيب', value: pc(1 - noFee.length / rows.length), target: '≥ 95%' }));
    M.plan.push(task({ id: 'noFeeRec', area: 'ربحية الأطباء', sev: 'medium', pr: 2,
      t: 'إلزام تسجيل نسبة الطبيب على كل إيصال مرتبط بطبيب',
      own: 'المحاسب + مطوّر النظام', wk: '٢–٣', kpi: 'إيصالات بنسبة طبيب', tgt: '≥ 95%',
      risk: 'إيصالات بلا نسبة طبيب مسجّلة',
      why: `${pc(noFee.length / rows.length)} من الإيصالات بلا نسبة طبيب.` }));
  }
  const share = users[0] && tot ? users[0].v / tot : 0;
  if (users.length > 2 && share > .5) {
    M.risks.push(risk({ id: 'userConc', area: 'الحوكمة', sev: 'low',
      title: 'تركّز التحصيل في موظف واحد',
      finding: `«${users[0].k}» حصّل ${pc(share)} من الإجمالي. تركّز النقد في يد واحدة يرفع مخاطر الفروق ويصعّب التغطية عند الغياب.`,
      metric: 'حصة أعلى موظف', value: pc(share), target: '≤ 50%' }));
  }
  return M;
};

/* ---------- تحليل الإيرادات اليومي ---------- */
A.doctorLaser = function (rows) {
  const due = sum(rows, r => N(r.due)), got = sum(rows, r => N(r.collected));
  const rate = due ? got / due : 0;
  const gap = Math.max(0, due - got);
  const meth = grp(rows.filter(r => S(r.method)), 'method', r => N(r.collected));
  const docs = grp(rows, 'doctor', r => N(r.collected));
  const svc = grp(rows, 'service', r => N(r.collected));
  const pkg = rows.filter(r => N(r.pkgLeft) > 0 || N(r.pkgRemainValue) > 0);
  const pkgVal = sum(pkg, r => N(r.pkgRemainValue));
  const dates = uniq(rows.map(r => r.date).filter(isDate)).sort();

  const M = {
    headline: `${cnt(rows.length, 'عملية واحدة', 'عمليتان', 'عمليات', 'عملية')} بمطلوب ${cur(due)} ومحصّل ${cur(got)}.`,
    kpis: [
      kpi('عمليات البيع', fmt(rows.length), 'عملية', dates.length ? `على ${fmt(dates.length)} يوم` : ''),
      kpi('المطلوب', cur(due), '', '', 'k2'),
      kpi('المحصّل', cur(got), '', `نسبة التحصيل ${pc(rate)}`, rate >= .95 ? 'k4' : 'k5'),
      kpi('فجوة التحصيل', cur(gap), '', gap > 0 ? 'لم يدخل الخزينة بعد' : 'لا فجوة', gap > 0 ? 'k5' : 'k4'),
      kpi('طرق السداد', fmt(meth.length), 'طريقة', meth[0] ? `أعلاها «${meth[0].k}»` : '', 'k3'),
      kpi('رصيد الباقات المتبقّي', cur(pkgVal), '', `${fmt(pkg.length)} باقة مفتوحة`, pkgVal > 0 ? 'k6' : 'k4')
    ],
    charts: [
      cht('donut', 'التحصيل حسب طريقة السداد', '', meth.slice(0, 7).map(x => ({ label: x.k, value: Math.round(x.v) }))),
      cht('hbars', 'التحصيل لكل طبيب', '', docs.slice(0, 12).map(d => ({ label: d.k, value: Math.round(d.v) })), { suffix: ' ج' })
    ],
    tables: [
      tbl('التحصيل حسب الطبيب', '', ['الطبيب', 'العمليات', 'المطلوب', 'المحصّل', 'نسبة التحصيل'],
          docs.slice(0, 20).map(d => {
            const rs = rows.filter(r => S(r.doctor) === d.k);
            const dd = sum(rs, r => N(r.due));
            return [d.k, fmt(d.n), cur(dd), cur(d.v), dd ? pc(d.v / dd) : '—'];
          })),
      tbl('أعلى الخدمات تحصيلاً', '', ['الخدمة', 'العمليات', 'المحصّل'],
          svc.slice(0, 15).map(s => [s.k, fmt(s.n), cur(s.v)]))
    ].concat(pkg.length ? [tbl('الباقات المفتوحة', 'التزام خدمة مستقبلي مقابل مال محصّل بالفعل',
          ['المريض', 'الخدمة', 'المستهلك', 'المتبقّي', 'قيمة المتبقّي'],
          pkg.slice(0, 20).map(r => [S(r.patient), S(r.service), fmt(N(r.pkgUsed)), fmt(N(r.pkgLeft)), cur(N(r.pkgRemainValue))]))] : []),
    blocks: [blk('البيع والتحصيل اليومي',
      `المطلوب ${cur(due)} حُصّل منه ${cur(got)} أي ${pc(rate)}` + (gap > 0 ? `، بفجوة ${cur(gap)} لم تدخل الخزينة. ` : '. ') +
      `أعلى طرق السداد «${meth[0] ? meth[0].k : '—'}»، وأعلى طبيب تحصيلاً «${docs[0] ? docs[0].k : '—'}». ` +
      (pkg.length ? `يوجد ${cnt(pkg.length, 'باقة واحدة', 'باقتان', 'باقات', 'باقة')} مفتوحة بقيمة متبقّية ${cur(pkgVal)} — التزام خدمة مقابل مال محصّل.` : ''))],
    risks: [], recos: [], plan: []
  };
  if (due > 0 && gap / due > .05) {
    M.risks.push(risk({ id: 'collGap', area: 'التحصيل', sev: gap / due > .2 ? 'high' : 'medium',
      title: 'فجوة بين المطلوب والمحصّل',
      finding: `${cur(gap)} (${pc(gap / due)} من المطلوب) لم يُحصَّل في نفس اليوم. كل يوم تأخير يزيد احتمال عدم التحصيل نهائياً.`,
      impact: gap, impactNote: `إغلاق الفجوة يضيف ${cur(gap)} سيولة.`,
      metric: 'نسبة التحصيل الفوري', value: pc(rate), target: '≥ 95%' }));
    M.plan.push(task({ id: 'collGap', area: 'التحصيل', sev: 'high', pr: 1, impact: gap,
      t: 'إقفال يومي: لا تخرج زيارة بلا سداد أو خطة سداد موقّعة',
      own: 'مدير الاستقبال', wk: '١', kpi: 'نسبة التحصيل الفوري', tgt: '≥ 95%',
      risk: 'فجوة بين المطلوب والمحصّل',
      why: `${cur(gap)} من المطلوب لم يُحصَّل في نفس اليوم.` }));
  }
  if (pkgVal > 0) {
    M.risks.push(risk({ id: 'pkgLiab', area: 'الحوكمة', sev: 'low',
      title: 'التزام خدمات مستقبلي من الباقات',
      finding: `${cur(pkgVal)} قيمة جلسات مدفوعة ولم تُقدَّم بعد على ${fmt(pkg.length)} باقة. ` +
               `هذا مال في الخزينة مقابل التزام لم يُنفَّذ — يجب ألا يُحسب كربح متاح للتوزيع.`,
      metric: 'قيمة الباقات المتبقّية', value: cur(pkgVal), target: 'مُدار ومُتابع' }));
    M.recos.push(reco({ id: 'pkgLiab', area: 'الحوكمة', title: 'إدارة التزام الباقات المفتوحة',
      risk: 'التزام خدمات مستقبلي من الباقات',
      steps: ['فصل إيراد الباقات في حساب «إيراد مؤجّل» ونقله للإيراد مع كل جلسة تُقدَّم.',
              'تحديد صلاحية زمنية لكل باقة وإبلاغ المريض بها.',
              'حملة تذكير للباقات التي مضى على آخر جلسة فيها أكثر من 60 يوماً.'] }));
  }
  return M;
};

/* ---------- الإيراد اليومي وطرق الدفع ---------- */
A.dailyRevenue = function (rows) {
  const rev = sum(rows, r => N(r.revenue)), fee = sum(rows, r => N(r.fees)), net = sum(rows, r => N(r.net));
  const m = rows.map(r => ({ k: S(r.method) || 'غير محدّد', v: N(r.revenue), f: N(r.fees), n: N(r.net) }))
                .sort((a, b) => b.v - a.v);
  const cash = m.filter(x => /نقد|كاش/.test(x.k)).reduce((s, x) => s + x.v, 0);
  const costly = m.filter(x => x.v > 0 && x.f / x.v > .02);
  return {
    headline: `إيراد ${cur(rev)} عبر ${cnt(m.length, 'طريقة دفع واحدة', 'طريقتا دفع', 'طرق دفع', 'طريقة دفع')}، رسوم ${cur(fee)}.`,
    kpis: [
      kpi('الإيراد', cur(rev), '', `${fmt(m.length)} طريقة دفع`),
      kpi('رسوم التحصيل', cur(fee), '', rev ? `${pc(fee / rev)} من الإيراد` : '', fee / (rev || 1) > .015 ? 'k5' : 'k4'),
      kpi('الصافي بعد الرسوم', cur(net || rev - fee), '', '', 'k4'),
      kpi('حصة النقدي', pc(rev ? cash / rev : 0), '', cash / (rev || 1) > .6 ? 'أعلى من المستهدف' : 'ضمن المستهدف',
          cash / (rev || 1) > .6 ? 'k5' : 'k4'),
      kpi('أعلى طريقة', m[0] ? m[0].k : '—', '', m[0] ? cur(m[0].v) : '', 'k2'),
      kpi('طرق مكلفة', fmt(costly.length), 'طريقة', costly.length ? 'رسومها تتجاوز 2%' : 'لا يوجد', costly.length ? 'k5' : 'k4')
    ],
    charts: [cht('donut', 'الإيراد حسب طريقة الدفع', '', m.map(x => ({ label: x.k, value: Math.round(x.v) })))],
    tables: [tbl('صافي كل طريقة دفع بعد الرسوم', 'قارن الصافي لا الإجمالي قبل تشجيع أي وسيلة',
      ['الطريقة', 'الإيراد', 'الرسوم', 'الصافي', 'نسبة الرسوم'],
      m.map(x => [x.k, cur(x.v), cur(x.f), cur(x.n || x.v - x.f), x.v ? pc(x.f / x.v) : '—']))],
    blocks: [blk('وسائل التحصيل وتكلفتها',
      `الإيراد ${cur(rev)} وُزّع على ${cnt(m.length, 'طريقة واحدة', 'طريقتين', 'طرق', 'طريقة')}، ` +
      `أعلاها «${m[0] ? m[0].k : '—'}». رسوم التحصيل ${cur(fee)} أي ${pc(rev ? fee / rev : 0)} من الإيراد. ` +
      `حصة النقدي ${pc(rev ? cash / rev : 0)}` + (cash / (rev || 1) > .6 ? ' — مرتفعة وتزيد مخاطر فروق الجرد.' : '.'))],
    risks: costly.length ? [risk({ id: 'feeCost', area: 'التحصيل', sev: 'low',
      title: 'رسوم بعض وسائل التحصيل مرتفعة',
      finding: costly.map(x => `${x.k} ${pc(x.f / x.v)}`).join('، ') + `. الرسوم تؤكل من الهامش بصمت.`,
      impact: sum(costly, x => x.f - x.v * .01),
      metric: 'نسبة رسوم التحصيل', value: pc(rev ? fee / rev : 0), target: '≤ 1%' })] : [],
    recos: [], plan: []
  };
};

/* ---------- فاتورة مريض ---------- */
A.invoice = function (rows) {
  const tot = sum(rows, r => N(r.total)), disc = sum(rows, r => N(r.discount)), tax = sum(rows, r => N(r.tax));
  const it = grp(rows, 'item', r => N(r.total));
  const cat = grp(rows.filter(r => S(r.category)), 'category', r => N(r.total));
  return {
    headline: `${cnt(rows.length, 'بند واحد', 'بندان', 'بنود', 'بنداً')} بإجمالي ${cur(tot)}.`,
    kpis: [
      kpi('بنود الفاتورة', fmt(rows.length), 'بند', `${fmt(it.length)} صنف مختلف`),
      kpi('الإجمالي', cur(tot), '', '', 'k2'),
      kpi('الخصم', cur(disc), '', tot + disc ? pc(disc / (tot + disc)) : '', disc ? 'k5' : 'k4'),
      kpi('الضريبة', cur(tax), '', '', 'k3'),
      kpi('متوسط البند', cur(rows.length ? tot / rows.length : 0), '', '', 'k6'),
      kpi('أعلى بند', it[0] ? it[0].k : '—', '', it[0] ? cur(it[0].v) : '', 'k2')
    ],
    charts: [cht('hbars', 'أعلى البنود قيمة', '', it.slice(0, 12).map(x => ({ label: x.k, value: Math.round(x.v) })), { suffix: ' ج' })],
    tables: [tbl('بنود الفاتورة', '', ['البند', 'العدد', 'القيمة'], it.slice(0, 25).map(x => [x.k, fmt(x.n), cur(x.v)]))]
      .concat(cat.length ? [tbl('حسب الفئة', '', ['الفئة', 'البنود', 'القيمة'], cat.map(x => [x.k, fmt(x.n), cur(x.v)]))] : []),
    blocks: [blk('تفاصيل الفاتورة',
      `الفاتورة تضم ${cnt(rows.length, 'بنداً واحداً', 'بندين', 'بنوداً', 'بنداً')} بإجمالي ${cur(tot)} ` +
      `وخصم ${cur(disc)} وضريبة ${cur(tax)}، بمتوسط ${cur(rows.length ? tot / rows.length : 0)} للبند.`)],
    risks: [], recos: [], plan: []
  };
};

/* ---------- زيارات المرضى بالأجهزة ---------- */
A.roomHistory = function (rows) {
  if (!rows.length) return emptyModule('زيارات المرضى بالأجهزة',
    'يقيس استغلال كل جهاز وغرفة: كم مريضاً دخل، ومتى، وكم استغرق.',
    ['استغلال الأجهزة غير مقيس — لا تعرف أي جهاز يستحق الصيانة أو الاستبدال.',
     'زمن الغرفة لكل مريض غير معروف، فلا يمكن تحسين جدولة المواعيد.'],
    'الأجهزة والغرف');
  const dev = grp(rows, 'device'); const room = grp(rows, 'room');
  const pat = uniq(rows.map(r => S(r.fileNo)).filter(Boolean));
  return {
    headline: `${cnt(rows.length, 'زيارة واحدة', 'زيارتان', 'زيارات', 'زيارة')} على ${fmt(dev.length)} جهاز.`,
    kpis: [
      kpi('زيارات الأجهزة', fmt(rows.length), 'زيارة', `${fmt(pat.length)} مريض`),
      kpi('عدد الأجهزة', fmt(dev.length), 'جهاز', dev[0] ? `أكثرها «${dev[0].k}»` : '', 'k2'),
      kpi('عدد الغرف', fmt(room.length), 'غرفة', '', 'k3')
    ],
    charts: [cht('hbars', 'استخدام كل جهاز', '', byCount(dev).slice(0, 12).map(x => ({ label: x.k, value: x.n })), { suffix: ' زيارة' })],
    tables: [tbl('استغلال الأجهزة', '', ['الجهاز', 'الزيارات'], byCount(dev).slice(0, 20).map(x => [x.k, fmt(x.n)]))],
    blocks: [blk('استغلال الأجهزة والغرف',
      `سُجّلت ${cnt(rows.length, 'زيارة واحدة', 'زيارتان', 'زيارات', 'زيارة')} على ${cnt(dev.length, 'جهاز واحد', 'جهازين', 'أجهزة', 'جهازاً')} ` +
      `في ${cnt(room.length, 'غرفة واحدة', 'غرفتين', 'غرف', 'غرفة')}.`)],
    risks: [], recos: [], plan: []
  };
};

/* ---------- تفاصيل العروض والباقات ---------- */
A.packages = function (rows) {
  if (!rows.length) return emptyModule('تفاصيل العروض والباقات',
    'يتابع كل باقة مباعة: كم جلسة استُهلكت وكم بقي وقيمة المتبقّي.',
    ['قيمة الجلسات المدفوعة وغير المقدَّمة غير معروفة — التزام مالي مخفي.',
     'لا يمكن تذكير المرضى بجلساتهم المتبقّية، فتضيع فرص إعادة الاستدعاء.'],
    'الباقات');
  const val = sum(rows, r => N(r.remainValue)), paid = sum(rows, r => N(r.paid));
  const open = rows.filter(r => N(r.left) > 0);
  const pkg = grp(rows, 'pkg', r => N(r.price));
  return {
    headline: `${cnt(rows.length, 'باقة واحدة', 'باقتان', 'باقات', 'باقة')}، متبقٍ بقيمة ${cur(val)}.`,
    kpis: [
      kpi('الباقات', fmt(rows.length), 'باقة', `${fmt(open.length)} مفتوحة`),
      kpi('المحصّل', cur(paid), '', '', 'k2'),
      kpi('قيمة المتبقّي', cur(val), '', 'التزام خدمة مستقبلي', val > 0 ? 'k5' : 'k4'),
      kpi('أنواع الباقات', fmt(pkg.length), 'نوع', pkg[0] ? `أعلاها «${pkg[0].k}»` : '', 'k3')
    ],
    charts: [cht('hbars', 'الباقات حسب النوع', '', pkg.slice(0, 12).map(x => ({ label: x.k, value: Math.round(x.v) })), { suffix: ' ج' })],
    tables: [tbl('الباقات المفتوحة', '', ['المريض', 'الباقة', 'مستهلك', 'متبقٍ', 'قيمة المتبقّي'],
      open.slice(0, 25).map(r => [S(r.patient), S(r.pkg), fmt(N(r.used)), fmt(N(r.left)), cur(N(r.remainValue))]))],
    blocks: [blk('العروض والباقات',
      `${cnt(rows.length, 'باقة واحدة', 'باقتان', 'باقات', 'باقة')} منها ${fmt(open.length)} مفتوحة بقيمة متبقّية ${cur(val)}. ` +
      `هذه أموال محصّلة مقابل خدمة لم تُقدَّم بعد — التزام لا ربح.`)],
    risks: val > 0 ? [risk({ id: 'pkgOpen', area: 'الحوكمة', sev: 'medium',
      title: 'التزام باقات مفتوح',
      finding: `${cur(val)} قيمة جلسات مدفوعة ولم تُقدَّم على ${fmt(open.length)} باقة.`,
      metric: 'قيمة الباقات المتبقّية', value: cur(val), target: 'مُدار بحساب إيراد مؤجّل' })] : [],
    recos: [], plan: []
  };
};

/* ---------- تسليم الورديات ---------- */
A.shift = function (rows) {
  if (!rows.length) return emptyModule('تسليم الورديات',
    'يوثّق تسليم نقدية الوردية من موظف لآخر بالمبلغ والتوقيع.',
    ['لا يوجد أثر مكتوب لتسليم النقدية بين الورديات — أي فرق في الخزينة لن يُعرف مسؤوله.',
     'الجرد النقدي اليومي غير موثّق، وهي أهم رقابة على التحصيل النقدي.'],
    'الحوكمة');
  const tot = sum(rows, r => N(r.amount));
  const emp = grp(rows, 'employee', r => N(r.amount));
  return {
    headline: `${cnt(rows.length, 'تسليمة واحدة', 'تسليمتان', 'تسليمات', 'تسليمة')} بإجمالي ${cur(tot)}.`,
    kpis: [kpi('التسليمات', fmt(rows.length), 'تسليمة', `${fmt(emp.length)} موظف`),
           kpi('إجمالي المسلَّم', cur(tot), '', '', 'k2')],
    charts: [cht('hbars', 'المسلَّم لكل موظف', '', emp.slice(0, 12).map(x => ({ label: x.k, value: Math.round(x.v) })), { suffix: ' ج' })],
    tables: [tbl('سجل التسليمات', '', ['التاريخ', 'المسلِّم', 'المستلم', 'المبلغ'],
      rows.slice(0, 25).map(r => [S(r.date), S(r.employee), S(r.receiver), cur(N(r.amount))]))],
    blocks: [blk('تسليم الورديات', `وثّق النظام ${cnt(rows.length, 'تسليمة واحدة', 'تسليمتين', 'تسليمات', 'تسليمة')} بإجمالي ${cur(tot)}.`)],
    risks: [], recos: [], plan: []
  };
};

/* ---------- قائمة زيارات المرضى ---------- */
A.visitList = function (rows) {
  const n = rows.length;
  const tot = sum(rows, r => N(r.amount));
  const zero = rows.filter(r => N(r.amount) <= 0);
  const noPhone = rows.filter(r => !S(r.phone));
  const docs = grp(rows, 'doctor', r => N(r.amount));
  const pat = uniq(rows.map(r => S(r.fileNo)).filter(Boolean));
  const dates = uniq(rows.map(r => r.date).filter(v => S(v))).length;

  const M = {
    headline: `${cnt(n, 'زيارة واحدة', 'زيارتان', 'زيارات', 'زيارة')} لـ${cnt(pat.length, 'مريض واحد', 'مريضان', 'مرضى', 'مريضاً')}` +
              (tot > 0 ? ` بإجمالي ${cur(tot)}.` : `، بلا أي مبلغ مسجّل.`),
    kpis: [
      kpi('عدد الزيارات', fmt(n), 'زيارة', `${fmt(pat.length)} مريض · ${fmt(docs.length)} طبيب`),
      kpi('إجمالي المبالغ', cur(tot), '', tot > 0 ? `متوسط الزيارة ${cur(n ? tot / n : 0)}` : 'عمود المبلغ فارغ', tot > 0 ? 'k2' : 'k5'),
      kpi('زيارات بمبلغ صفر', fmt(zero.length), 'زيارة', pc(n ? zero.length / n : 0) + ' من الزيارات', zero.length ? 'k5' : 'k4'),
      kpi('زيارات بلا هاتف', fmt(noPhone.length), 'زيارة', 'لا يمكن متابعتها لاحقاً', noPhone.length ? 'k5' : 'k4'),
      kpi('أكثر الأطباء زيارات', byCount(docs)[0] ? byCount(docs)[0].k : '—', '',
          byCount(docs)[0] ? `${fmt(byCount(docs)[0].n)} زيارة` : '', 'k3'),
      kpi('عدد الأيام', fmt(dates), 'يوم', dates ? `${(n / dates).toFixed(1)} زيارة في اليوم` : '', 'k6')
    ],
    charts: [cht('hbars', 'الزيارات لكل طبيب', '',
      byCount(docs).slice(0, 12).map(d => ({ label: d.k, value: d.n })), { suffix: ' زيارة' })],
    tables: [tbl('الزيارات حسب الطبيب', '', ['الطبيب', 'الزيارات', 'المبلغ', 'متوسط الزيارة'],
      byCount(docs).slice(0, 20).map(d => [d.k, fmt(d.n), cur(d.v), cur(d.n ? d.v / d.n : 0)]))],
    blocks: [blk('حركة الزيارات',
      `سُجّلت ${cnt(n, 'زيارة واحدة', 'زيارتان', 'زيارات', 'زيارة')} لـ${cnt(pat.length, 'مريض واحد', 'مريضين', 'مرضى', 'مريضاً')} ` +
      `على ${cnt(docs.length, 'طبيب واحد', 'طبيبين', 'أطباء', 'طبيباً')}. ` +
      (tot > 0 ? `إجمالي المبالغ ${cur(tot)} بمتوسط ${cur(n ? tot / n : 0)} للزيارة. ` : 'لم يُسجّل أي مبلغ على هذه الزيارات. ') +
      (zero.length ? `${fmt(zero.length)} زيارة بمبلغ صفر — إما مجاملات غير موثّقة أو تحصيل لم يُسجّل.` : ''))],
    risks: [], recos: [], plan: []
  };
  if (zero.length > n * .3) {
    M.risks.push(risk({ id: 'zeroVisit', area: 'الحوكمة', sev: zero.length === n ? 'high' : 'medium',
      title: 'زيارات مسجّلة بلا مبلغ',
      finding: `${fmt(zero.length)} زيارة من ${fmt(n)} (${pc(zero.length / n)}) بمبلغ صفر. ` +
               `إما خدمات مجانية غير موثّقة بسبب، أو تحصيل تم ولم يُربط بالزيارة — وفي الحالتين الإيراد الظاهر أقل من الحقيقي.`,
      metric: 'زيارات بمبلغ', value: pc(1 - zero.length / n), target: '≥ 95%' }));
    M.recos.push(reco({ id: 'zeroVisit', area: 'الحوكمة', title: 'إغلاق فجوة الزيارات بلا مبلغ',
      risk: 'زيارات مسجّلة بلا مبلغ',
      steps: ['منع إقفال الزيارة بلا مبلغ أو سبب إعفاء مكتوب.',
              'قائمة أسباب إعفاء مغلقة (متابعة مجانية، شكوى، عقد شركة) تُختار من قائمة.',
              'تقرير يومي بالزيارات صفرية القيمة على مكتب المدير.'] }));
    M.plan.push(task({ id: 'zeroVisit', area: 'الحوكمة', sev: 'medium', pr: 1,
      t: 'منع إقفال الزيارة بلا مبلغ أو سبب إعفاء موثّق', own: 'مدير الاستقبال + مطوّر النظام',
      wk: '١–٢', kpi: 'زيارات بمبلغ', tgt: '≥ 95%', risk: 'زيارات مسجّلة بلا مبلغ',
      why: `${pc(zero.length / n)} من الزيارات بلا مبلغ مسجّل.` }));
  }
  if (noPhone.length > n * .15) {
    M.risks.push(risk({ id: 'visitNoPhone', area: 'الحوكمة', sev: 'low',
      title: 'زيارات بلا رقم هاتف',
      finding: `${fmt(noPhone.length)} زيارة (${pc(noPhone.length / n)}) بلا رقم هاتف — لا يمكن التذكير بالمتابعة ولا إعادة الاستدعاء.`,
      metric: 'زيارات برقم هاتف', value: pc(1 - noPhone.length / n), target: '≥ 95%' }));
  }
  return M;
};

/* ---------- وحدة «تقرير فارغ» عامة ---------- */
function emptyModule(name, what, gaps, area) {
  return {
    empty: true,
    headline: `التقرير مرفوع لكنه لا يحتوي على أي سطر بيانات.`,
    kpis: [
      kpi('سطور البيانات', '0', 'سطر', 'التقرير فارغ في الفترة المختارة', 'k5'),
      kpi('حالة التفعيل', 'غير مفعّل', '', 'الميزة غير مستخدمة في النظام', 'k5'),
      kpi('أثر الفجوة', String(gaps.length), 'نقطة عمياء', 'قرارات لا يمكن اتخاذها بلا هذه البيانات', 'k6')
    ],
    charts: [], tables: [],
    blocks: [blk('فجوة بيانات: ' + name,
      `${what} — لكن الملف المرفوع لا يحتوي على أي سطر. ` +
      `يعني هذا أن الميزة غير مفعّلة في النظام أو لم تُستخدم في الفترة. ` + gaps.join(' '))],
    risks: [risk({ id: 'empty_' + name.replace(/\s/g, ''), area: area || 'الحوكمة', sev: 'medium',
      title: `«${name}» غير مفعّل — بيانات مفقودة`,
      finding: `${what} الملف المرفوع فارغ تماماً. ${gaps[0]}`,
      metric: 'سطور التقرير', value: '0', target: '> 0' })],
    recos: [reco({ id: 'empty_' + name.replace(/\s/g, ''), area: area || 'الحوكمة',
      title: `تفعيل «${name}» في النظام`, risk: `«${name}» غير مفعّل — بيانات مفقودة`,
      steps: ['التأكد من تفعيل الشاشة وصلاحيات الموظفين عليها.',
              'تدريب الفريق على استخدامها كجزء من الدورة اليومية.',
              'مراجعة التقرير بعد أسبوعين للتأكد من امتلائه.'] })],
    plan: [task({ id: 'empty_' + name.replace(/\s/g, ''), area: area || 'الحوكمة', sev: 'medium', pr: 2,
      t: `تفعيل «${name}» وإدخال بياناته`, own: 'مدير التشغيل', wk: '٢–٤',
      kpi: 'سطور التقرير', tgt: '> 0', risk: `«${name}» غير مفعّل — بيانات مفقودة`,
      why: gaps.join(' ') })]
  };
}

/* ============================================================
   البناء العام
   ============================================================ */
function build(datasets, ctx) {
  const out = { modules: [], risks: [], recos: [], plan: [], kpis: [], blocks: [], names: [] };
  (datasets || []).forEach(ds => {
    const fn = A[ds.id];
    let M = null;
    try {
      M = fn ? fn(ds.rows || [], ds, ctx || {}) : null;
      if (!M && (!ds.rows || !ds.rows.length))
        M = emptyModule(ds.name, (ds.info && ds.info.what) || '', [(ds.info && ds.info.why) || ''], ds.group);
    } catch (e) {
      if (root.console) console.error('insight ' + ds.id, e);
      M = null;
    }
    if (!M) return;

    /* ضمان ألا يخلو أي تقرير من ملاحظة وتوصية ومهمة خاصة به */
    const inf = ds.info || {};
    if (!(M.risks || []).length && !M.empty) {
      const watch = (inf.watch || []).filter(Boolean);
      M.risks = [risk({ id: 'watch_' + ds.id, area: ds.group || 'الحوكمة', sev: 'low',
        title: `نقاط تحتاج مراقبة في «${ds.name}»`,
        finding: (M.headline || '') + ' لم تُرصد مخاطرة رقمية في هذه النسخة، ' +
                 (watch.length ? 'لكن هذه هي المؤشرات التي يجب أن تراقبها فيه: ' + watch.join(' ')
                               : 'راجعه دورياً لرصد أي تغيّر.'),
        metric: 'حالة التقرير', value: 'ضمن المتوقّع', target: 'مراجعة دورية' })];
    }
    if (!(M.recos || []).length) {
      const use = (inf.use || []).filter(Boolean);
      M.recos = [reco({ id: (M.risks[0] || {}).id ? String(M.risks[0].id).replace(/^ins_/, '') : ('use_' + ds.id),
        area: ds.group || 'الحوكمة', sev: (M.risks[0] || {}).sev || 'low',
        title: `كيف تستفيد من «${ds.name}»`,
        risk: (M.risks[0] || {}).title || ds.name,
        steps: use.length ? use : ['راجع هذا التقرير شهرياً وقارنه بالشهر السابق.'] })];
    }
    if (!(M.plan || []).length) {
      M.plan = [task({ id: (M.risks[0] || {}).id ? String(M.risks[0].id).replace(/^ins_/, '') : ('use_' + ds.id),
        area: ds.group || 'الحوكمة', sev: 'low', pr: 3,
        t: `مراجعة شهرية لتقرير «${ds.name}» ومتابعة مؤشراته`,
        own: 'مدير التشغيل', wk: '٤', kpi: 'مراجعة التقرير', tgt: 'شهرياً',
        risk: (M.risks[0] || {}).title || '',
        why: (inf.why || M.headline || ''),
        steps: (inf.use || []).filter(Boolean) })];
    }

    M.id = ds.id; M.name = ds.name; M.group = ds.group; M.file = ds.file;
    M.info = ds.info; M.rowCount = (ds.rows || []).length;
    out.modules.push(M);
    out.names.push(ds.name);
    (M.kpis || []).forEach(k => out.kpis.push(Object.assign({ src: ds.name }, k)));
    (M.blocks || []).forEach(b => out.blocks.push({ h: b.h + ' — ' + ds.name, p: b.p }));
    (M.risks || []).forEach(r => out.risks.push(Object.assign({ src: ds.name }, r)));
    (M.recos || []).forEach(r => out.recos.push(Object.assign({ src: ds.name }, r)));
    (M.plan  || []).forEach(t => out.plan.push(Object.assign({ src: ds.name }, t)));
  });
  out.has = out.modules.length > 0;
  return out;
}

root.SonoInsights = { build, analyzers: A, emptyModule };
})(window);
