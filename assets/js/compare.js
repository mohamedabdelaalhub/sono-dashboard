/* ============================================================
   compare.js — تقرير مقارنة بين فترتين أو أكثر
   يأخذ عدة تحليلات (من الأرشيف أو من ملفات مرفوعة)
   ويولّد تحليلاً ثالثاً: الاتجاه، النمو، الرابح والخاسر، والملاحظات.
   ============================================================ */
(function (root) {
'use strict';
const fmt = n => Math.round(n).toLocaleString('en-US');
const cur = n => fmt(n) + ' جنيه';
const pc  = v => (v * 100).toFixed(1) + '%';
const sgn = v => (v >= 0 ? '+' : '') + pc(v);
/* عدّ عربي سليم */
function cnt(n, one, two, many, acc) {
  n = Math.round(n);
  if (n === 0) return 'لا ' + many;
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return n + ' ' + many;
  return n + ' ' + (acc || many);
}
const R = n => cnt(n, 'مخاطرة واحدة', 'مخاطرتان', 'مخاطر', 'مخاطرة');

/* معدّل النمو المركّب بين أول وآخر فترة */
function cagr(first, last, n) {
  if (!first || first <= 0 || n < 2) return null;
  return Math.pow(last / first, 1 / (n - 1)) - 1;
}
function trend(vals) {
  if (vals.length < 2) return 0;
  const n = vals.length;
  const mx = (n - 1) / 2;
  const my = vals.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  vals.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) ** 2; });
  return den ? num / den : 0;     /* ميل الانحدار */
}

/* ============================================================
   البناء
   periods = [{ label, A, E }]  مرتبة زمنياً
   ============================================================ */
function build(periods) {
  if (!periods || periods.length < 2)
    throw new Error('المقارنة تحتاج تقريرين على الأقل.');

  const P = periods.slice().sort((a, b) => {
    const da = a.A.meta.from ? +new Date(a.A.meta.from) : 0;
    const db = b.A.meta.from ? +new Date(b.A.meta.from) : 0;
    return da - db;
  });
  const n = P.length;
  const first = P[0], last = P[n - 1];

  /* ---------- سلاسل المؤشرات ---------- */
  const METRICS = [
    { k: 'revenue',   nm: 'الإيراد',              money: 1, good: 1 },
    { k: 'cost',      nm: 'المنصرف',              money: 1, good: -1 },
    { k: 'net',       nm: 'الصافي',               money: 1, good: 1 },
    { k: 'margin',    nm: 'الهامش الصافي',        rate: 1,  good: 1 },
    { k: 'patients',  nm: 'عدد المرضى',           good: 1 },
    { k: 'receipts',  nm: 'عدد الإيصالات',        good: 1 },
    { k: 'avgTicket', nm: 'متوسط الإيصال',        money: 1, good: 1 },
    { k: 'repeatRate',nm: 'نسبة المرضى المتكررين', rate: 1, good: 1 },
    { k: 'doctorFeeRatio', nm: 'أتعاب الأطباء ÷ الإيراد', rate: 1, good: -1 },
    { k: 'costRatio', nm: 'المنصرف ÷ الإيراد',    rate: 1,  good: -1 },
    { k: 'cashShare', nm: 'حصة التحصيل النقدي',   rate: 1,  good: -1 },
    { k: 'fixedRatio',nm: 'التكاليف الثابتة ÷ الإيراد', rate: 1, good: -1 },
    { k: 'cv',        nm: 'تذبذب الإيراد اليومي', rate: 1,  good: -1 },
    { k: 'revPerDay', nm: 'إيراد اليوم الواحد',   money: 1, good: 1 }
  ];

  const metrics = METRICS.map(m => {
    const vals = P.map(p => +(p.A.kpi[m.k] || 0));
    const f = vals[0], l = vals[n - 1];
    const chg = f ? (l - f) / Math.abs(f) : null;
    const sl = trend(vals);
    return {
      key: m.k, name: m.nm, money: !!m.money, rate: !!m.rate, good: m.good,
      values: vals, first: f, last: l, diff: l - f, change: chg,
      slope: sl,
      direction: Math.abs(sl) < Math.abs(l || 1) * 0.005 ? 'ثابت' : (sl > 0 ? 'صاعد' : 'هابط'),
      verdict: chg === null ? 'غير متاح'
             : (chg * m.good > 0.02 ? 'تحسّن' : chg * m.good < -0.02 ? 'تراجع' : 'مستقر'),
      cagr: cagr(f, l, n)
    };
  });

  /* ---------- الخدمات: الرابح والخاسر ---------- */
  const svcMap = new Map();
  P.forEach((p, i) => (p.A.services || []).forEach(s => {
    const o = svcMap.get(s.key) || { name: s.key, vals: new Array(n).fill(0) };
    o.vals[i] += s.total; svcMap.set(s.key, o);
  }));
  const services = [...svcMap.values()].map(s => ({
    ...s, first: s.vals[0], last: s.vals[n - 1], diff: s.vals[n - 1] - s.vals[0],
    change: s.vals[0] ? (s.vals[n - 1] - s.vals[0]) / s.vals[0] : null
  })).filter(s => s.first > 0 || s.last > 0);
  const gainers = services.slice().sort((a, b) => b.diff - a.diff).slice(0, 8);
  const losers  = services.slice().sort((a, b) => a.diff - b.diff).slice(0, 8);

  /* ---------- بنود المصروف ---------- */
  const expMap = new Map();
  P.forEach((p, i) => (p.A.expCats || []).forEach(c => {
    const o = expMap.get(c.cat) || { name: c.cat, vals: new Array(n).fill(0) };
    o.vals[i] += c.total; expMap.set(c.cat, o);
  }));
  const expenses = [...expMap.values()].map(c => ({
    ...c, first: c.vals[0], last: c.vals[n - 1], diff: c.vals[n - 1] - c.vals[0],
    change: c.vals[0] ? (c.vals[n - 1] - c.vals[0]) / c.vals[0] : null
  })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  /* ---------- الأطباء ---------- */
  const docMap = new Map();
  P.forEach((p, i) => (p.A.doctors || []).forEach(d => {
    const o = docMap.get(d.doctor) || { name: d.doctor, vals: new Array(n).fill(0) };
    o.vals[i] += d.fees; docMap.set(d.doctor, o);
  }));
  const doctors = [...docMap.values()].map(d => ({
    ...d, first: d.vals[0], last: d.vals[n - 1], diff: d.vals[n - 1] - d.vals[0],
    periods: d.vals.filter(v => v > 0).length
  })).sort((a, b) => b.last - a.last);

  /* ---------- خلاصة المخاطر عبر الفترات ---------- */
  const riskMap = new Map();
  P.forEach((p, i) => (p.E.risks || []).forEach(r => {
    const o = riskMap.get(r.title) || { title: r.title, area: r.area, in: new Array(n).fill(false), sev: r.sevAr };
    o.in[i] = true; o.sev = r.sevAr; riskMap.set(r.title, o);
  }));
  const risks = [...riskMap.values()].map(r => ({
    ...r, count: r.in.filter(Boolean).length,
    persistent: r.in.every(Boolean),
    resolved  : r.in[0] && !r.in[n - 1],
    emerged   : !r.in[0] && r.in[n - 1]
  })).sort((a, b) => b.count - a.count);

  const scores = P.map(p => p.E.score);

  return {
    isComparison: true,
    periods: P.map((p, i) => ({
      label   : p.label || p.A.meta.rangeLabel,
      range   : p.A.meta.rangeLabel,
      days    : p.A.meta.spanDays,
      revenue : p.A.kpi.revenue, cost: p.A.kpi.cost, net: p.A.kpi.net,
      margin  : p.A.kpi.margin, patients: p.A.kpi.patients,
      score   : p.E.score, riskCount: (p.E.risks || []).length
    })),
    n, metrics, services, gainers, losers, expenses, doctors, risks, scores,
    scoreTrend: trend(scores),
    summary: narrate(P, metrics, gainers, losers, expenses, risks, scores, n)
  };
}

/* ---------- قراءة مكتوبة للمقارنة ---------- */
function narrate(P, metrics, gainers, losers, expenses, risks, scores, n) {
  const get = k => metrics.find(m => m.key === k);
  const rev = get('revenue'), net = get('net'), mar = get('margin'), pat = get('patients');
  const lines = [];
  const names = P.map(p => p.label || p.A.meta.rangeLabel);

  lines.push({
    h: 'ما الذي تقارنه',
    p: `${cnt(n, 'فترة واحدة', 'فترتان', 'فترات', 'فترة')}: ${names.join(' · ')}. ` +
       `الإيراد تحرّك من ${cur(rev.first)} إلى ${cur(rev.last)} (${rev.change === null ? '—' : sgn(rev.change)})، ` +
       `والصافي من ${cur(net.first)} إلى ${cur(net.last)} (${net.change === null ? '—' : sgn(net.change)}).`
  });

  const improved = metrics.filter(m => m.verdict === 'تحسّن');
  const worsened = metrics.filter(m => m.verdict === 'تراجع');
  lines.push({
    h: 'ما الذي تحسّن وما الذي تراجع',
    p: (improved.length ? `تحسّن: ${improved.map(m => m.name).join('، ')}. ` : 'لم يتحسّن أي مؤشر جوهرياً. ') +
       (worsened.length ? `تراجع: ${worsened.map(m => m.name).join('، ')}.` : 'ولم يتراجع أي مؤشر جوهرياً.')
  });

  const up = gainers.filter(s => s.diff > 0).slice(0, 3);
  const dn = losers.filter(s => s.diff < 0).slice(0, 3);
  lines.push({
    h: 'الخدمات المحرّكة للفرق',
    p: (up.length ? `الأكثر نمواً: ${up.map(s => `«${s.name}» ${up.length ? (s.diff >= 0 ? '+' : '') + cur(s.diff) : ''}`).join('، ')}. ` : '') +
       (dn.length ? `الأكثر تراجعاً: ${dn.map(s => `«${s.name}» ${cur(s.diff)}`).join('، ')}.` : '')
  });

  const expUp = expenses.filter(e => e.diff > 0).slice(0, 3);
  lines.push({
    h: 'أين زاد المنصرف',
    p: expUp.length
      ? expUp.map(e => `${e.name} ${e.diff >= 0 ? '+' : ''}${cur(e.diff)}${e.change !== null ? ` (${sgn(e.change)})` : ''}`).join('، ') + '.'
      : 'لم يزد أي بند مصروف بشكل مؤثر بين الفترتين.'
  });

  const persist = risks.filter(r => r.persistent);
  const gone    = risks.filter(r => r.resolved);
  const fresh   = risks.filter(r => r.emerged);
  lines.push({
    h: 'المخاطر عبر الفترات',
    p: (persist.length ? `${R(persist.length)} مستمرة في كل الفترات، أبرزها «${persist[0].title}» — استمرارها يعني أن المعالجة لم تُنفَّذ. ` : '') +
       (gone.length ? `${R(gone.length)} اختفت. ` : '') +
       (fresh.length ? `${R(fresh.length)} ظهرت في الفترة الأخيرة، أهمها «${fresh[0].title}».` : '') ||
       'لا تغيّر يُذكر في خريطة المخاطر.'
  });

  lines.push({
    h: 'الخلاصة',
    p: `مؤشر الصحة تحرّك من ${scores[0]} إلى ${scores[n - 1]}. ` +
       (mar.change === null ? '' :
         mar.change > 0.02 ? 'الهامش يتحسّن — استمر في نفس الاتجاه وثبّت ما نجح. '
       : mar.change < -0.02 ? 'الهامش يتآكل — راجع بنود المصروف التي زادت أعلاه قبل أي قرار توسّع. '
       : 'الهامش مستقر — النمو يأتي من الحجم لا من الكفاءة. ') +
       (pat.change !== null && rev.change !== null
         ? (pat.change > 0.02 && rev.change <= 0.02
            ? 'عدد المرضى يزيد بلا زيادة مقابلة في الإيراد — المشكلة في التسعير أو الخصومات لا في الطلب.'
            : rev.change > 0.02 && pat.change <= 0.02
            ? 'الإيراد يزيد دون زيادة المرضى — النمو من متوسط الفاتورة، وهو أهش من النمو بالعدد.'
            : '')
         : '')
  });
  return lines;
}

/* ---------- تحويل المقارنة إلى شكل يقبله الأرشيف ---------- */
function toArchivePayload(C, titles) {
  return { v: 1, kind: 'comparison', comparison: C, sources: titles || [] };
}

root.SonoCompare = { build, toArchivePayload };
})(window);
