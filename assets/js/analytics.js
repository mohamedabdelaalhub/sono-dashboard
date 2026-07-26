/* ============================================================
   analytics.js — تحويل السجلات الخام إلى مؤشرات وتجميعات
   ============================================================ */
(function (root) {
'use strict';
const P = root.SonoParser;

/* ---------- أدوات ---------- */
const sum  = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
const uniq = a => [...new Set(a)];
function groupSum(arr, keyFn, valFn) {
  const m = new Map();
  arr.forEach(x => {
    const k = keyFn(x);
    if (k === null || k === undefined || k === '') return;
    const o = m.get(k) || { key: k, total: 0, count: 0, items: [] };
    o.total += valFn ? valFn(x) : 0; o.count++; o.items.push(x);
    m.set(k, o);
  });
  return [...m.values()].sort((a, b) => b.total - a.total || b.count - a.count);
}
function stdev(a) {
  if (a.length < 2) return 0;
  const m = sum(a) / a.length;
  return Math.sqrt(sum(a.map(x => (x - m) ** 2)) / (a.length - 1));
}
function dparse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function dayDiff(a, b) { return Math.round((b - a) / 86400000); }
const DOW_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MON_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
function fmtDateAr(d) { return d.getDate() + ' ' + MON_AR[d.getMonth()] + ' ' + d.getFullYear(); }

/* ---------- تحديد الفترات ---------- */
function periodKey(dateStr, gran) {
  const d = dparse(dateStr);
  switch (gran) {
    case 'week': {
      const s = addDays(d, -((d.getDay() + 1) % 7));       // الأسبوع يبدأ السبت
      return 'W|' + P.iso(s);
    }
    case 'month'  : return 'M|' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    case 'quarter': return 'Q|' + d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1);
    case 'year'   : return 'Y|' + d.getFullYear();
    default       : return 'A|all';
  }
}
function periodLabel(key) {
  const [t, v] = key.split('|');
  if (t === 'W') { const s = dparse(v); return 'أسبوع ' + fmtDateAr(s) + ' → ' + fmtDateAr(addDays(s, 6)); }
  if (t === 'M') { const [y, m] = v.split('-'); return MON_AR[+m - 1] + ' ' + y; }
  if (t === 'Q') { const [y, q] = v.split('-'); return 'الربع ' + q.replace('Q', '') + ' — ' + y; }
  if (t === 'Y') return 'سنة ' + v;
  return 'كل البيانات';
}
function listPeriods(records, gran) {
  const keys = uniq(records.map(r => periodKey(r.date, gran)));
  return keys.sort().map(k => ({ key: k, label: periodLabel(k) }));
}

/* ---------- التحليل الأساسي لمجموعة سجلات ---------- */
function analyze(income, expense, meta) {
  meta = meta || {};
  const B = (root.SONO_CONFIG || {}).benchmarks || {};
  const revenue = sum(income, x => x.amount);
  const cost    = sum(expense, x => x.amount);
  const net     = revenue - cost;

  /* --- الفترة الزمنية --- */
  const dates = uniq(income.concat(expense).map(r => r.date)).sort();
  const from  = dates[0] ? dparse(dates[0]) : null;
  const to    = dates[dates.length - 1] ? dparse(dates[dates.length - 1]) : null;
  const spanDays  = from && to ? dayDiff(from, to) + 1 : 0;
  const activeDays = uniq(income.map(r => r.date)).length;

  /* --- المرضى والإيصالات --- */
  const patKey = r => (r.fileNo && r.fileNo !== '0' ? 'F' + r.fileNo : 'N' + P.normAr(r.patient));
  const rcptKey = r => r.receipt ? 'R' + r.receipt + '|' + r.date : 'X' + r.date + '|' + Math.random();
  const receipts = uniq(income.filter(r => r.receipt).map(r => 'R' + r.receipt)).length || income.length;
  const patients = groupSum(income.filter(r => r.patient || r.fileNo), patKey, x => x.amount);
  const patientCount = patients.length;
  const visitsPerPatient = patientCount ? receipts / patientCount : 0;
  const repeatPatients = patients.filter(p => uniq(p.items.map(i => i.receipt || i.date)).length > 1);
  const oneVisit = patientCount - repeatPatients.length;

  /* --- السلاسل اليومية --- */
  const dayMap = new Map();
  dates.forEach(d => dayMap.set(d, { date: d, rev: 0, exp: 0, rcpt: new Set(), pat: new Set() }));
  income.forEach(r => { const o = dayMap.get(r.date); if (!o) return;
    o.rev += r.amount; if (r.receipt) o.rcpt.add(r.receipt); o.pat.add(patKey(r)); });
  expense.forEach(r => { const o = dayMap.get(r.date); if (o) o.exp += r.amount; });
  const daily = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date))
    .map(o => ({ date: o.date, rev: o.rev, exp: o.exp, net: o.rev - o.exp,
                 rcpt: o.rcpt.size, pat: o.pat.size,
                 dow: DOW_AR[dparse(o.date).getDay()] }));

  /* --- الأسبوعي --- */
  const wkMap = new Map();
  daily.forEach(d => {
    const k = periodKey(d.date, 'week');
    const o = wkMap.get(k) || { key: k, label: periodLabel(k), rev: 0, exp: 0, rcpt: 0, days: 0 };
    o.rev += d.rev; o.exp += d.exp; o.rcpt += d.rcpt; o.days++;
    wkMap.set(k, o);
  });
  const weekly = [...wkMap.values()].sort((a, b) => a.key.localeCompare(b.key))
    .map((w, i) => ({ ...w, idx: i + 1, net: w.rev - w.exp }));

  /* --- حسب يوم الأسبوع --- */
  const dowAgg = DOW_AR.map(n => ({ dow: n, rev: 0, rcpt: 0, days: 0 }));
  daily.forEach(d => { const o = dowAgg[DOW_AR.indexOf(d.dow)]; o.rev += d.rev; o.rcpt += d.rcpt; o.days++; });
  dowAgg.forEach(o => { o.avg = o.days ? o.rev / o.days : 0; });

  /* --- طرق الدفع --- */
  const methods = groupSum(income, r => r.method || 'غير محدد', r => r.amount)
    .map(m => ({ method: m.key, total: m.total, count: m.count, pct: revenue ? m.total / revenue : 0 }));
  const cashShare = revenue ? (methods.find(m => /نقد|كاش نقدي/.test(P.normAr(m.method))) || { total: 0 }).total / revenue : 0;

  /* --- الخدمات (توزيع متساوٍ على بنود الإيصال متعدد الخدمات) --- */
  const svcMap = new Map(), catMap = new Map();
  income.forEach(r => {
    const share = r.amount / r.services.length;
    r.services.forEach(s => {
      const nm = s || 'غير محدد';
      const o = svcMap.get(nm) || { key: nm, total: 0, count: 0, cat: P.classifyService(nm) };
      o.total += share; o.count++; svcMap.set(nm, o);
      const c = catMap.get(o.cat) || { key: o.cat, total: 0, count: 0 };
      c.total += share; c.count++; catMap.set(o.cat, c);
    });
  });
  const services   = [...svcMap.values()].sort((a, b) => b.total - a.total);
  const serviceCats = [...catMap.values()].sort((a, b) => b.total - a.total)
    .map(c => ({ ...c, pct: revenue ? c.total / revenue : 0 }));
  const lineItems = sum(income, r => r.services.length);

  /* --- المصروفات --- */
  const expCats = groupSum(expense, r => r.cat, r => r.amount)
    .map(c => ({ cat: c.key, total: c.total, count: c.count, pct: cost ? c.total / cost : 0,
                 pctRev: revenue ? c.total / revenue : 0, group: c.items[0].group }));
  const expGroups = groupSum(expense, r => r.group, r => r.amount)
    .map(g => ({ group: g.key, total: g.total, pct: cost ? g.total / cost : 0 }));
  const fixedCost = sum(expense.filter(e => e.group === 'ثابت' || e.group === 'شبه ثابت'), e => e.amount);
  const varCost   = sum(expense.filter(e => e.group === 'متغيّر'), e => e.amount);
  const unclassified = expCats.find(c => c.cat === 'غير مصنّف') || { total: 0, count: 0, pctRev: 0 };

  /* --- الأطباء --- */
  const docRows = expense.filter(e => e.doctor);
  const doctors = groupSum(docRows, e => e.doctor, e => e.amount).map(d => ({
    doctor : d.key,
    fees   : d.total,
    payouts: d.count,
    days   : uniq(d.items.map(i => i.date)).length,
    avg    : d.total / d.count,
    share  : sum(docRows, x => x.amount) ? d.total / sum(docRows, x => x.amount) : 0
  }));
  const doctorFees = sum(docRows, e => e.amount);

  /* --- المستهلكات (مستخرجة من الملاحظات) --- */
  const supMap = new Map();
  income.forEach(r => (r.supplies || []).forEach(s => {
    const o = supMap.get(s.item) || { item: s.item, mentions: 0, qty: 0 };
    o.mentions++; o.qty += s.qty || 1; supMap.set(s.item, o);
  }));
  const supplies = [...supMap.values()].sort((a, b) => b.mentions - a.mentions);
  const suppliesRecorded = (expCats.find(c => c.cat === 'مستلزمات طبية') || { total: 0 }).total;
  const suppliesNoteCount = income.filter(r => (r.supplies || []).length).length;

  /* --- إحصاءات التذبذب --- */
  const revs = daily.map(d => d.rev);
  const meanRev = revs.length ? sum(revs) / revs.length : 0;
  const cv = meanRev ? stdev(revs) / meanRev : 0;
  const zeroDays = daily.filter(d => d.rev === 0).length;

  /* --- تركيز الإيراد --- */
  const topService = services[0] || { key: '—', total: 0 };
  const top5Services = services.slice(0, 5);
  const hhiSvc = revenue ? sum(services.map(s => (s.total / revenue) ** 2)) : 0;

  return {
    meta: { ...meta, from, to, spanDays, activeDays,
            rangeLabel: from && to ? fmtDateAr(from) + ' → ' + fmtDateAr(to) : '—' },
    kpi: {
      revenue, cost, net,
      margin       : revenue ? net / revenue : 0,
      receipts, lineItems,
      patients     : patientCount,
      repeat       : repeatPatients.length,
      oneVisit,
      repeatRate   : patientCount ? repeatPatients.length / patientCount : 0,
      visitsPerPatient,
      avgTicket    : receipts ? revenue / receipts : 0,
      avgPerPatient: patientCount ? revenue / patientCount : 0,
      avgLine      : lineItems ? revenue / lineItems : 0,
      revPerDay    : activeDays ? revenue / activeDays : 0,
      patPerDay    : activeDays ? patientCount / activeDays : 0,
      doctorFees,
      doctorFeeRatio: revenue ? doctorFees / revenue : 0,
      fixedCost, varCost,
      fixedRatio   : revenue ? fixedCost / revenue : 0,
      costRatio    : revenue ? cost / revenue : 0,
      cashShare,
      digitalShare : 1 - cashShare,
      cv, zeroDays,
      hhiSvc,
      topServiceShare: revenue ? topService.total / revenue : 0,
      topDoctorShare : doctors.length ? doctors[0].share : 0,
      breakEvenRev : (1 - (revenue ? varCost / revenue : 0)) > 0
                     ? fixedCost / (1 - (varCost / (revenue || 1))) : 0,
      suppliesRecorded,
      suppliesRatio: revenue ? suppliesRecorded / revenue : 0,
      unclassifiedRatio: revenue ? unclassified.total / revenue : 0
    },
    daily, weekly, dowAgg, methods, services, serviceCats, top5Services,
    expCats, expGroups, doctors, supplies, suppliesNoteCount,
    unclassifiedRows: expense.filter(e => e.cat === 'غير مصنّف')
                             .sort((a, b) => b.amount - a.amount),
    topPatients: patients.slice(0, 15).map(p => ({
      name: p.items[0].patient || '—', file: p.items[0].fileNo || '—',
      total: p.total, visits: uniq(p.items.map(i => i.receipt || i.date)).length
    }))
  };
}

/* ---------- المقارنة بين فترتين ---------- */
function compare(cur, prev) {
  if (!prev) return null;
  const pick = ['revenue', 'cost', 'net', 'margin', 'receipts', 'patients', 'avgTicket',
                'repeatRate', 'doctorFeeRatio', 'costRatio', 'revPerDay', 'cashShare'];
  const out = {};
  pick.forEach(k => {
    const a = cur.kpi[k], b = prev.kpi[k];
    out[k] = { cur: a, prev: b, diff: a - b, pct: b ? (a - b) / Math.abs(b) : null };
  });
  /* أكبر التغيّرات في فئات المصروفات */
  const pm = new Map(prev.expCats.map(c => [c.cat, c.total]));
  out.expenseMoves = cur.expCats.map(c => ({
    cat: c.cat, cur: c.total, prev: pm.get(c.cat) || 0, diff: c.total - (pm.get(c.cat) || 0)
  })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 8);
  /* أكبر التغيّرات في الخدمات */
  const sm = new Map(prev.services.map(s => [s.key, s.total]));
  out.serviceMoves = cur.services.map(s => ({
    svc: s.key, cur: s.total, prev: sm.get(s.key) || 0, diff: s.total - (sm.get(s.key) || 0)
  })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 8);
  return out;
}

root.SonoAnalytics = { analyze, compare, periodKey, periodLabel, listPeriods,
                       DOW_AR, MON_AR, fmtDateAr, dparse, addDays, groupSum, sum, uniq };
})(window);
