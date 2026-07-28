/* ============================================================
   adapters.js — تحويل التقارير المتعرَّف عليها إلى الشكل القياسي
   الهدف: أي تقرير فيه إيراد أو مصروف يشغّل اللوحة كاملة
   (الملخص · المؤشرات · المخاطر · التوصيات · خطة العمل)
   وليس بطاقة وصف فقط.
   ============================================================ */
(function (root) {
'use strict';
const P = () => root.SonoParser;

const clean = v => P().cleanAr(v);
const num = v => { const n = P().toNum(v); return n === null ? 0 : n; };
const iso = d => d ? P().iso(d) : null;

/* تاريخ احتياطي حين لا يحمل السطر تاريخاً */
function fallbackDate(ds) {
  const p = ds.period || {};
  return iso(p.to) || iso(p.from) || null;
}

/* طريقة الدفع قد تأتي بصيغة «نقدي:600.00,» */
function payMethod(v) {
  const t = clean(v);
  if (!t) return 'غير محدد';
  const m = t.split(':')[0].replace(/[,،]+$/, '').trim();
  return m || 'غير محدد';
}

/* سطر إيراد قياسي */
function inc(o) {
  return {
    date: o.date, amount: o.amount, method: o.method || 'غير محدد',
    services: (o.services && o.services.length) ? o.services : ['غير محدد'],
    patient: o.patient || '', fileNo: o.fileNo != null ? String(o.fileNo) : '',
    receipt: o.receipt != null ? String(o.receipt) : '',
    branch: o.branch || '', note: o.note || '', supplies: [], src: o.src
  };
}
/* سطر مصروف قياسي */
function exp(o) {
  const cl = P().classifyExpense(o.bayan, o.note);
  return {
    date: o.date, amount: o.amount, bayan: o.bayan || '(بدون بيان)',
    note: o.note || '', cat: o.cat || cl.cat, group: o.group || cl.group,
    doctor: o.doctor !== undefined ? o.doctor : cl.doctor,
    voucher: o.voucher != null ? String(o.voucher) : '', branch: o.branch || '', src: o.src
  };
}

/* الخدمات قد تأتي مفصولة بفواصل */
function svcList(v) {
  const t = clean(v);
  if (!t) return [];
  return t.split(/[,،;؛]+/).map(s => s.trim()).filter(Boolean);
}

/* ============================================================
   المحوّلات — لكل نوع تقرير
   ============================================================ */
const AD = {

  /* ---------- بيان الحالة التفصيلي: أغنى مصدر إيراد ---------- */
  statusDetail(ds) {
    const fb = fallbackDate(ds), income = [];
    ds.rows.forEach(r => {
      const amt = r.total !== null && r.total !== undefined ? num(r.total)
                : num(r.price) * (num(r.qty) || 1) - num(r.discount);
      if (!amt) return;
      income.push(inc({
        date: r.date || fb, amount: amt,
        method: r.insurer ? 'تأمين — ' + clean(r.insurer) : 'غير محدد',
        services: svcList(r.service), patient: clean(r.patient), fileNo: r.fileNo,
        /* لا يوجد رقم إيصال: نبني مفتاح زيارة من الملف والتاريخ */
        receipt: (r.fileNo || '?') + '|' + (r.date || fb || ''),
        note: r.channel ? 'قناة: ' + clean(r.channel) : '', src: ds.file
      }));
    });
    return { income, expense: [] };
  },

  /* ---------- تحليل الإيرادات اليومي ---------- */
  doctorLaser(ds) {
    const fb = fallbackDate(ds), income = [];
    ds.rows.forEach(r => {
      const amt = num(r.collected) || num(r.price) || num(r.due);
      if (!amt) return;
      income.push(inc({
        date: r.date || fb, amount: amt, method: payMethod(r.method),
        services: svcList(r.service), patient: clean(r.patient), fileNo: r.fileNo,
        receipt: (r.fileNo || '?') + '|' + (r.date || fb || ''),
        note: clean(r.note), src: ds.file
      }));
    });
    return { income, expense: [] };
  },

  /* ---------- إيصالات الاستلام: إيراد + أتعاب أطباء ---------- */
  receipts(ds) {
    const fb = fallbackDate(ds), income = [], expense = [];
    ds.rows.forEach(r => {
      const amt = num(r.amount);
      if (amt) income.push(inc({
        date: r.date || fb, amount: amt,
        services: svcList(r.service), patient: clean(r.patient), fileNo: r.fileNo,
        receipt: r.receipt, note: r.user ? 'حصّلها: ' + clean(r.user) : '', src: ds.file
      }));
      const fee = num(r.docAmount);
      if (fee > 0 && r.doctor) expense.push(exp({
        date: r.date || fb, amount: fee,
        bayan: 'اتعاب د / ' + clean(r.doctor),
        cat: 'أتعاب أطباء', group: 'متغيّر', doctor: clean(r.doctor),
        voucher: r.receipt, src: ds.file
      }));
    });
    return { income, expense };
  },

  /* ---------- مستحقات الأطباء: مصروف أتعاب ---------- */
  doctorClaim(ds) {
    const fb = fallbackDate(ds), expense = [];
    ds.rows.forEach(r => {
      const v = num(r.value);
      if (!v || !r.doctor) return;
      expense.push(exp({
        date: r.date || fb, amount: v,
        bayan: 'اتعاب د / ' + clean(r.doctor),
        cat: 'أتعاب أطباء', group: 'متغيّر', doctor: clean(r.doctor),
        note: clean(r.service), src: ds.file
      }));
    });
    return { income: [], expense };
  },

  /* ---------- فاتورة مريض ---------- */
  invoice(ds) {
    const fb = fallbackDate(ds), income = [];
    ds.rows.forEach(r => {
      const amt = num(r.total);
      if (!amt) return;
      income.push(inc({
        date: r.date || fb, amount: amt, services: svcList(r.item),
        receipt: ds.file, src: ds.file
      }));
    });
    return { income, expense: [] };
  },

  /* ---------- الإيراد اليومي: إيراد ومصروف حسب طريقة الدفع ---------- */
  dailyRevenue(ds) {
    const fb = fallbackDate(ds), income = [], expense = [];
    ds.rows.forEach(r => {
      const rev = num(r.revenue);
      if (rev) income.push(inc({
        date: r.date || fb, amount: rev, method: clean(r.method) || 'غير محدد',
        services: ['غير محدد'], receipt: 'DR|' + clean(r.method), src: ds.file
      }));
      const ex = num(r.expense);
      if (ex) expense.push(exp({
        date: r.date || fb, amount: ex, bayan: 'مصروفات — ' + (clean(r.method) || 'عام'),
        cat: 'غير مصنّف', group: 'غير مصنّف', doctor: null, src: ds.file
      }));
      const fee = num(r.fees);
      if (fee) expense.push(exp({
        date: r.date || fb, amount: fee,
        bayan: 'رسوم تحصيل — ' + (clean(r.method) || 'عام'),
        cat: 'رسوم تحصيل', group: 'متغيّر', doctor: null, src: ds.file
      }));
    });
    return { income, expense };
  },

  /* ---------- حساب الأستاذ لمراكز التكلفة ---------- */
  costCenter(ds) {
    const fb = fallbackDate(ds), income = [], expense = [];
    ds.rows.forEach(r => {
      const rev = num(r.revenue), ex = num(r.expense);
      if (rev > 0) income.push(inc({
        date: r.date || fb, amount: rev, services: [clean(r.account) || 'غير محدد'],
        receipt: 'CC|' + (r.entryNo || ''), note: clean(r.desc), src: ds.file
      }));
      if (ex > 0) expense.push(exp({
        date: r.date || fb, amount: ex, bayan: clean(r.account) || clean(r.desc),
        note: clean(r.desc), voucher: r.entryNo, src: ds.file
      }));
    });
    return { income, expense };
  },

  /* ---------- كشف الحساب: مدين مصروف · دائن إيراد ---------- */
  accountDisplay(ds) {
    const fb = fallbackDate(ds), income = [], expense = [];
    ds.rows.forEach(r => {
      const d = num(r.debit), c = num(r.credit);
      if (c > 0) income.push(inc({
        date: r.date || fb, amount: c, services: ['قيود دائنة'],
        receipt: 'AC|' + (r.entryNo || ''), note: clean(r.desc), src: ds.file
      }));
      if (d > 0) expense.push(exp({
        date: r.date || fb, amount: d, bayan: clean(r.desc) || 'قيد مدين',
        voucher: r.entryNo, src: ds.file
      }));
    });
    return { income, expense };
  },

  /* ---------- أرصدة العملاء: المحصّل إيراد ---------- */
  patientBalance(ds) {
    const fb = fallbackDate(ds), income = [];
    ds.rows.forEach(r => {
      const paid = num(r.paid);
      if (!paid) return;
      income.push(inc({
        date: r.date || fb, amount: paid, services: svcList(r.service),
        patient: clean(r.patient), fileNo: r.fileNo,
        receipt: r.visit != null ? String(r.visit) : ((r.fileNo || '?') + '|' + (r.date || fb || '')),
        branch: clean(r.branch), src: ds.file
      }));
    });
    return { income, expense: [] };
  },

  /* ---------- بيان الحالة المجمع ---------- */
  statusSummary(ds) {
    const fb = fallbackDate(ds), income = [];
    ds.rows.forEach(r => {
      const amt = num(r.net) || (num(r.gross) - num(r.discount));
      if (!amt) return;
      income.push(inc({
        date: fb, amount: amt, services: svcList(r.service),
        receipt: 'SS|' + clean(r.service), src: ds.file
      }));
    });
    return { income, expense: [] };
  }
};

/* ============================================================
   التشغيل على كل التقارير المرفوعة
   ============================================================ */
function apply(datasets) {
  const income = [], expense = [], used = [], skipped = [];
  (datasets || []).forEach(ds => {
    const f = AD[ds.id];
    if (!f) { skipped.push(ds.name); return; }
    try {
      const r = f(ds);
      if ((r.income && r.income.length) || (r.expense && r.expense.length)) {
        income.push(...(r.income || []));
        expense.push(...(r.expense || []));
        used.push({ name: ds.name, file: ds.file,
                    income: (r.income || []).length, expense: (r.expense || []).length });
      } else skipped.push(ds.name);
    } catch (e) { skipped.push(ds.name + ' (' + e.message + ')'); }
  });
  return { income, expense, used, skipped };
}

/* هل لهذا التقرير محوّل يغذّي التحليل؟ */
function feeds(id) { return !!AD[id]; }

root.SonoAdapters = { apply, feeds, list: Object.keys(AD) };
})(window);
