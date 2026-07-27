/* ============================================================
   rules.js — محرك القواعد: المخاطر · التوصيات · خطة العمل
   كل قاعدة تُقيَّم على نتائج التحليل وتُنتج نتيجة مُسنَدة بالأرقام.
   ============================================================ */
(function (root) {
'use strict';

const pc  = v => (v * 100).toFixed(1) + '%';
const eg  = v => Math.round(v).toLocaleString('en-US');
const cur = v => eg(v) + ' جنيه';

/* عدّ عربي سليم — cnt(n, مفرد, مثنى, جمع, تمييز مفرد منصوب)
   cnt(1,'مخاطرة واحدة','مخاطرتان','مخاطر','مخاطرة') → «مخاطرة واحدة»
   cnt(3, …) → «3 مخاطر»   ·   cnt(19, …) → «19 مخاطرة»            */
function cnt(n, one, two, many, acc) {
  n = Math.round(n);
  if (n === 0) return 'لا ' + many;
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return n + ' ' + many;
  return n + ' ' + (acc || many);
}

/* السنة المالية: يُستخدم لتقدير الأثر السنوي */
const YEAR_FACTOR = span => (span > 0 ? 365 / span : 12);

/* ============================================================
   تعريف القواعد
   كل قاعدة: id, area, test(ctx) → false أو كائن النتيجة
   ============================================================ */
const RULES = [

/* ---------- الربحية ---------- */
{
  id: 'margin', area: 'الربحية',
  test(c) {
    const m = c.k.margin, B = c.B;
    if (m >= B.netMarginGood) return false;
    const belowMin = m < B.netMarginMin;
    const goal = belowMin ? B.netMarginMin : B.netMarginGood;
    const gap  = (goal - m) * c.k.revenue;
    const sev  = m < 0 ? 'critical' : m < B.netMarginMin * 0.6 ? 'high' : belowMin ? 'high' : 'low';
    return {
      sev,
      title  : m < 0        ? 'الفترة أغلقت بخسارة تشغيلية'
             : belowMin     ? 'هامش الربح الصافي تحت الحد الأدنى المقبول'
             :                'الهامش الصافي مقبول لكنه دون المستوى الجيد',
      finding: belowMin
        ? `الهامش الصافي ${pc(m)} مقابل حد أدنى ${pc(B.netMarginMin)}. الإيراد ${cur(c.k.revenue)} والمنصرف ${cur(c.k.cost)} والصافي ${cur(c.k.net)}.`
        : `الهامش الصافي ${pc(m)} — فوق الحد الأدنى ${pc(B.netMarginMin)} لكنه دون المستوى الجيد ${pc(B.netMarginGood)}. ` +
          `الإيراد ${cur(c.k.revenue)} والمنصرف ${cur(c.k.cost)} والصافي ${cur(c.k.net)}.`,
      impact : Math.max(gap, 0),
      impactNote: gap > 0 ? `بلوغ ${pc(goal)} يضيف ${cur(gap)} في الفترة، أي نحو ${cur(gap * YEAR_FACTOR(c.span))} سنوياً.` : '',
      metric : 'الهامش الصافي', value: pc(m), target: pc(goal)
    };
  }
},
{
  id: 'costRatio', area: 'الربحية',
  test(c) {
    if (c.k.costRatio <= 0.70) return false;
    return {
      sev: c.k.costRatio > 0.85 ? 'high' : 'medium',
      title  : 'نسبة المنصرف إلى الإيراد مرتفعة',
      finding: `كل 100 جنيه إيراد يقابلها ${eg(c.k.costRatio * 100)} جنيه منصرف. أكبر ثلاثة بنود: ` +
               c.A.expCats.slice(0, 3).map(x => `${x.cat} ${pc(x.pct)}`).join('، ') + '.',
      impact : (c.k.costRatio - 0.70) * c.k.revenue,
      metric : 'المنصرف ÷ الإيراد', value: pc(c.k.costRatio), target: '≤ 70%'
    };
  }
},
{
  id: 'breakEven', area: 'الربحية',
  test(c) {
    const be = c.k.breakEvenRev;
    if (!be || !isFinite(be) || be <= 0) return false;
    const cover = c.k.revenue / be;
    if (cover >= 1.6) return false;
    return {
      sev: cover < 1 ? 'critical' : cover < 1.25 ? 'high' : 'medium',
      title  : 'هامش الأمان فوق نقطة التعادل ضيّق',
      finding: `نقطة التعادل تقارب ${cur(be)} في الفترة، والإيراد الفعلي ${cur(c.k.revenue)} أي ${(cover).toFixed(2)}× فقط. ` +
               `التكاليف الثابتة وشبه الثابتة ${cur(c.k.fixedCost)} تمثل ${pc(c.k.fixedRatio)} من الإيراد.`,
      impact : Math.max(be * 1.4 - c.k.revenue, 0),
      metric : 'تغطية نقطة التعادل', value: cover.toFixed(2) + '×', target: '≥ 1.60×'
    };
  }
},

/* ---------- هيكل التكلفة ---------- */
{
  id: 'doctorFees', area: 'هيكل التكلفة',
  test(c) {
    const r = c.k.doctorFeeRatio, B = c.B;
    if (r <= B.doctorFeeRatioMax) return false;
    return {
      sev: r > B.doctorFeeRatioMax * 1.3 ? 'high' : 'medium',
      title  : 'أتعاب الأطباء تستهلك نسبة كبيرة من الإيراد',
      finding: `أتعاب الأطباء ${cur(c.k.doctorFees)} = ${pc(r)} من الإيراد و${pc(c.k.doctorFees / c.k.cost)} من إجمالي المنصرف، ` +
               `موزعة على ${cnt(c.A.doctors.length,'طبيب واحد','طبيبين','أطباء','طبيباً')}.`,
      impact : (r - B.doctorFeeRatioMax) * c.k.revenue,
      metric : 'أتعاب الأطباء ÷ الإيراد', value: pc(r), target: '≤ ' + pc(B.doctorFeeRatioMax)
    };
  }
},
{
  id: 'payroll', area: 'هيكل التكلفة',
  test(c) {
    const p = c.cat('مرتبات وأجور');
    const r = c.k.revenue ? p / c.k.revenue : 0;
    if (r <= c.B.payrollRatioMax) return false;
    return {
      sev: r > c.B.payrollRatioMax * 1.4 ? 'high' : 'medium',
      title  : 'كتلة الأجور مرتفعة مقابل الإيراد',
      finding: `المرتبات والأجور ${cur(p)} = ${pc(r)} من الإيراد. الإيراد لكل جنيه أجور ${(p ? c.k.revenue / p : 0).toFixed(2)} جنيه.`,
      impact : (r - c.B.payrollRatioMax) * c.k.revenue,
      metric : 'المرتبات ÷ الإيراد', value: pc(r), target: '≤ ' + pc(c.B.payrollRatioMax)
    };
  }
},
{
  id: 'rent', area: 'هيكل التكلفة',
  test(c) {
    const p = c.cat('إيجارات');
    const r = c.k.revenue ? p / c.k.revenue : 0;
    if (!p || r <= c.B.rentRatioMax) return false;
    return {
      sev: r > 0.20 ? 'high' : 'medium',
      title  : 'عبء الإيجار مرتفع نسبة إلى الإيراد',
      finding: `الإيجار ${cur(p)} = ${pc(r)} من الإيراد. يحتاج المركز ${cur(p / (c.B.rentRatioMax || .12))} إيراداً في الفترة ليعود العبء لنطاقه الطبيعي.`,
      impact : (r - c.B.rentRatioMax) * c.k.revenue,
      metric : 'الإيجار ÷ الإيراد', value: pc(r), target: '≤ ' + pc(c.B.rentRatioMax)
    };
  }
},
{
  id: 'fixedLoad', area: 'هيكل التكلفة',
  test(c) {
    if (c.k.fixedRatio <= c.B.fixedCostRatioMax) return false;
    return {
      sev: 'medium',
      title  : 'التكاليف الثابتة تقيّد المرونة',
      finding: `التكاليف الثابتة وشبه الثابتة ${cur(c.k.fixedCost)} = ${pc(c.k.fixedRatio)} من الإيراد. ` +
               `أي تراجع في الإيراد بنسبة ${pc(1 - c.B.fixedCostRatioMax)} يمحو الربح بالكامل.`,
      impact : 0,
      metric : 'التكاليف الثابتة ÷ الإيراد', value: pc(c.k.fixedRatio), target: '≤ ' + pc(c.B.fixedCostRatioMax)
    };
  }
},

/* ---------- التركّز ---------- */
{
  id: 'doctorConc', area: 'التركّز',
  test(c) {
    const d = c.A.doctors[0];
    if (!d || d.share <= c.B.topDoctorShareMax) return false;
    return {
      sev: d.share > 0.40 ? 'high' : 'medium',
      title  : 'اعتماد مرتفع على طبيب واحد',
      finding: `د/ ${d.doctor} يستحوذ على ${pc(d.share)} من أتعاب الأطباء (${cur(d.fees)}) خلال ${cnt(d.days,'يوم عمل واحد','يومي عمل','أيام عمل','يوم عمل')}. ` +
               `أعلى ثلاثة أطباء معاً ${pc(c.A.doctors.slice(0, 3).reduce((s, x) => s + x.share, 0))}.`,
      impact : d.fees / (c.k.doctorFeeRatio || 1) * 0.15,
      metric : 'حصة أعلى طبيب', value: pc(d.share), target: '≤ ' + pc(c.B.topDoctorShareMax)
    };
  }
},
{
  id: 'serviceConc', area: 'التركّز',
  test(c) {
    const s = c.A.services[0];
    if (!s || c.k.topServiceShare <= c.B.topServiceShareMax) return false;
    return {
      sev: c.k.topServiceShare > 0.45 ? 'high' : 'medium',
      title  : 'تركّز الإيراد في خدمة واحدة',
      finding: `«${s.key}» تمثل ${pc(c.k.topServiceShare)} من الإيراد (${cur(s.total)} من ${cnt(s.count,'بند واحد','بندين','بنود','بنداً')}).`,
      impact : s.total * 0.2,
      metric : 'حصة أعلى خدمة', value: pc(c.k.topServiceShare), target: '≤ ' + pc(c.B.topServiceShareMax)
    };
  }
},
{
  id: 'catConc', area: 'التركّز',
  test(c) {
    const t = c.A.serviceCats[0];
    if (!t || t.pct <= 0.55) return false;
    return {
      sev: t.pct > 0.70 ? 'high' : 'medium',
      title  : 'تركّز الإيراد في تخصص واحد',
      finding: `فئة «${t.key}» تمثل ${pc(t.pct)} من الإيراد (${cur(t.total)}). ` +
               `أضعف الفئات: ` + c.A.serviceCats.slice(-3).map(x => `${x.key} ${pc(x.pct)}`).join('، ') + '.',
      impact : 0,
      metric : 'حصة أعلى فئة خدمية', value: pc(t.pct), target: '≤ 55%'
    };
  }
},

/* ---------- التحصيل والسيولة ---------- */
{
  id: 'cash', area: 'التحصيل',
  test(c) {
    if (c.k.cashShare <= c.B.cashShareMax) return false;
    const target = c.k.revenue * c.B.cashShareMax;
    return {
      sev: c.k.cashShare > 0.80 ? 'high' : 'medium',
      title  : 'الاعتماد على التحصيل النقدي مرتفع',
      finding: `التحصيل النقدي ${pc(c.k.cashShare)} من الإيراد (${cur(c.k.cashShare * c.k.revenue)}). ` +
               `الوسائل الرقمية: ` + c.A.methods.filter(m => !/نقد/.test(m.method))
                 .map(m => `${m.method} ${pc(m.pct)}`).join('، ') + '.',
      impact : c.k.cashShare * c.k.revenue - target,
      impactNote: 'المبلغ النقدي المعرّض لمخاطر الفروق والسرقة والأخطاء اليدوية.',
      metric : 'حصة النقدي', value: pc(c.k.cashShare), target: '≤ ' + pc(c.B.cashShareMax)
    };
  }
},
{
  id: 'advances', area: 'التحصيل',
  test(c) {
    const a = c.cat('سلف ومسحوبات');
    if (!a || a / c.k.revenue < 0.01) return false;
    const rows = c.A.expCats.find(x => x.cat === 'سلف ومسحوبات');
    return {
      sev: a / c.k.revenue > 0.04 ? 'high' : 'low',
      title  : 'سلف ومسحوبات بدون سقف واضح',
      finding: `${cur(a)} في ${cnt(rows ? rows.count : 0,'حركة واحدة','حركتين','حركات','حركة')} سلف/مسحوبات = ${pc(a / c.k.revenue)} من الإيراد. ` +
               `هذه مبالغ خرجت من الخزينة ولا تمثل مصروفاً تشغيلياً.`,
      impact : a,
      metric : 'السلف ÷ الإيراد', value: pc(a / c.k.revenue), target: '≤ 1%'
    };
  }
},

/* ---------- المرضى والطلب ---------- */
{
  id: 'retention', area: 'المرضى',
  test(c) {
    if (c.k.repeatRate >= c.B.returningRateMin) return false;
    const gain = (c.B.returningRateMin - c.k.repeatRate) * c.k.patients * c.k.avgTicket;
    return {
      sev: c.k.repeatRate < c.B.returningRateMin * 0.6 ? 'high' : 'medium',
      title  : 'ضعف عودة المرضى للزيارة الثانية',
      finding: `${cnt(c.k.oneVisit,'مريض واحد','مريضان','مرضى','مريضاً')} من ${eg(c.k.patients)} (${pc(1 - c.k.repeatRate)}) زاروا مرة واحدة فقط. ` +
               `متوسط الزيارات ${c.k.visitsPerPatient.toFixed(2)} لكل مريض.`,
      impact : gain,
      impactNote: `رفع نسبة العائدين إلى ${pc(c.B.returningRateMin)} يضيف نحو ${cur(gain)} في الفترة.`,
      metric : 'نسبة المرضى المتكررين', value: pc(c.k.repeatRate), target: '≥ ' + pc(c.B.returningRateMin)
    };
  }
},
{
  id: 'weakDays', area: 'المرضى',
  test(c) {
    const act = c.A.dowAgg.filter(d => d.days > 0);
    if (act.length < 5) return false;
    const avg = act.reduce((s, d) => s + d.avg, 0) / act.length;
    const weak = act.filter(d => d.avg < avg * 0.7).sort((a, b) => a.avg - b.avg);
    if (!weak.length) return false;
    const gain = weak.reduce((s, d) => s + (avg * 0.85 - d.avg) * d.days, 0);
    return {
      sev: weak.length > 1 ? 'medium' : 'low',
      title  : 'أيام ضعيفة الاستغلال في الأسبوع',
      finding: weak.map(d => `${d.dow}: متوسط ${cur(d.avg)} مقابل متوسط عام ${cur(avg)} (${pc(d.avg / avg - 1)})`).join(' · ') + '.',
      impact : gain,
      impactNote: `رفع هذه الأيام إلى 85% من المتوسط العام يضيف نحو ${cur(gain)} في الفترة.`,
      metric : 'أضعف يوم', value: weak[0].dow + ' — ' + cur(weak[0].avg), target: '≥ ' + cur(avg * 0.85)
    };
  }
},
{
  id: 'volatility', area: 'المرضى',
  test(c) {
    if (c.k.cv <= c.B.revenueCvMax) return false;
    const d = c.A.daily.slice().sort((a, b) => a.rev - b.rev);
    return {
      sev: c.k.cv > 0.7 ? 'high' : 'medium',
      title  : 'تذبذب يومي مرتفع في الإيراد',
      finding: `معامل الاختلاف ${pc(c.k.cv)}. أدنى يوم ${cur(d[0].rev)} وأعلى يوم ${cur(d[d.length - 1].rev)} ` +
               `— فارق ${(d[d.length - 1].rev / (d[0].rev || 1)).toFixed(1)}×. ` +
               `${cnt(c.A.daily.filter(x => x.rev < c.k.revPerDay * 0.5).length,'يوم واحد','يومان','أيام','يوماً')} تحت نصف المتوسط.`,
      impact : 0,
      metric : 'معامل اختلاف الإيراد اليومي', value: pc(c.k.cv), target: '≤ ' + pc(c.B.revenueCvMax)
    };
  }
},
{
  id: 'ticket', area: 'المرضى',
  test(c) {
    if (!c.cmp || c.cmp.avgTicket.pct === null || c.cmp.avgTicket.pct >= -0.05) return false;
    return {
      sev: c.cmp.avgTicket.pct < -0.15 ? 'high' : 'medium',
      title  : 'تراجع متوسط قيمة الإيصال',
      finding: `متوسط الإيصال ${cur(c.k.avgTicket)} مقابل ${cur(c.cmp.avgTicket.prev)} في الفترة السابقة ` +
               `(${pc(c.cmp.avgTicket.pct)}).`,
      impact : Math.abs(c.cmp.avgTicket.diff) * c.k.receipts,
      metric : 'متوسط الإيصال', value: cur(c.k.avgTicket), target: '≥ ' + cur(c.cmp.avgTicket.prev)
    };
  }
},

/* ---------- المخزون والمستهلكات ---------- */
{
  id: 'supplies', area: 'المخزون',
  test(c) {
    if (c.k.suppliesRatio >= c.B.suppliesRatioMin) return false;
    const expected = c.k.revenue * c.B.suppliesRatioMin;
    return {
      sev: 'high',
      title  : 'المستهلكات الطبية غير مُثبتة في الدفاتر',
      finding: `المسجّل تحت «مستلزمات طبية» ${cur(c.k.suppliesRecorded)} فقط = ${pc(c.k.suppliesRatio)} من الإيراد، ` +
               `بينما ملاحظات ${cnt(c.A.suppliesNoteCount,'إيصال واحد','إيصالين','إيصالات','إيصالاً')} تذكر استهلاكاً فعلياً` +
               (c.A.supplies.length ? ` (أعلاها: ${c.A.supplies.slice(0, 4).map(s => s.item + ' ' + s.mentions + ' مرة').join('، ')})` : '') +
               `. الفجوة تقارب ${cur(expected - c.k.suppliesRecorded)}.`,
      impact : Math.max(expected - c.k.suppliesRecorded, 0),
      impactNote: 'تكلفة حقيقية غير ظاهرة — الربح المعلن أعلى من الربح الفعلي بهذا المقدار تقريباً.',
      metric : 'المستلزمات ÷ الإيراد', value: pc(c.k.suppliesRatio), target: '≥ ' + pc(c.B.suppliesRatioMin)
    };
  }
},

/* ---------- الحوكمة وجودة البيانات ---------- */
{
  id: 'unclassified', area: 'الحوكمة',
  test(c) {
    const u = c.A.expCats.find(x => x.cat === 'غير مصنّف');
    if (!u || u.pctRev <= c.B.unclassifiedMax) return false;
    const top = c.A.unclassifiedRows.slice(0, 4).map(r => `${r.bayan} (${cur(r.amount)})`).join('، ');
    return {
      sev: u.pctRev > 0.06 ? 'high' : 'medium',
      title  : 'مصروفات بلا بند محاسبي واضح',
      finding: `${cur(u.total)} في ${cnt(u.count,'حركة واحدة','حركتين','حركات','حركة')} بلا تصنيف = ${pc(u.pctRev)} من الإيراد. أبرزها: ${top}.`,
      impact : u.total,
      metric : 'المصروفات غير المصنّفة', value: cur(u.total), target: '≤ ' + pc(c.B.unclassifiedMax) + ' من الإيراد'
    };
  }
},
{
  id: 'noDoctorLink', area: 'الحوكمة',
  test(c) {
    if (!c.A.doctors.length) return false;
    return {
      sev: 'medium',
      title  : 'لا يوجد ربط بين الطبيب والإيصال',
      finding: `جانب الوارد لا يحتوي عمود طبيب، لذلك يستحيل حساب إيراد كل طبيب أو ربحيته الصافية. ` +
               `المتاح فقط أتعابه المدفوعة (${cur(c.k.doctorFees)} لـ ${cnt(c.A.doctors.length,'طبيب واحد','طبيبين','أطباء','طبيباً')}).`,
      impact : 0,
      metric : 'تغطية ربط الطبيب بالإيصال', value: '0%', target: '100%'
    };
  }
},
{
  id: 'noTime', area: 'الحوكمة',
  test(c) {
    return {
      sev: 'low',
      title  : 'التواريخ بدون توقيت — لا يمكن تحليل ساعات الذروة',
      finding: `كل الحركات مسجّلة باليوم فقط. إضافة وقت الإيصال تتيح جدولة الأطباء والتمريض على ساعات الذروة الفعلية.`,
      impact : 0,
      metric : 'تغطية الوقت', value: '0%', target: '100%'
    };
  }
},
{
  id: 'noAR', area: 'الحوكمة',
  test(c) {
    return {
      sev: 'low',
      title  : 'الملف دفتر خزينة نقدي — لا يُظهر المستحقات',
      finding: `لا توجد حسابات مدينة أو دائنة، لذلك لا يمكن قياس أعمار الديون ولا التزامات الموردين. ` +
               `أي مبلغ آجل (تأمين، شركات، موردون) غير ظاهر في هذه اللوحة.`,
      impact : 0,
      metric : 'تغطية المستحقات', value: 'غير متاح', target: 'كشف مدينين ودائنين شهري'
    };
  }
},
{
  id: 'patientConc', area: 'التركّز',
  test(c) {
    const t = c.A.topPatients.slice(0, 10).reduce((s, p) => s + p.total, 0);
    const r = c.k.revenue ? t / c.k.revenue : 0;
    if (r <= 0.15) return false;
    return {
      sev: r > 0.25 ? 'medium' : 'low',
      title  : 'أعلى عشرة مرضى يمثلون شريحة كبيرة من الإيراد',
      finding: `أعلى 10 مرضى ${cur(t)} = ${pc(r)} من الإيراد من إجمالي ${cnt(c.k.patients,'مريض واحد','مريضين','مرضى','مريضاً')}.`,
      impact : 0,
      metric : 'حصة أعلى 10 مرضى', value: pc(r), target: '≤ 15%'
    };
  }
},
{
  id: 'trendDown', area: 'الربحية',
  test(c) {
    if (!c.cmp || c.cmp.revenue.pct === null || c.cmp.revenue.pct >= -0.05) return false;
    return {
      sev: c.cmp.revenue.pct < -0.15 ? 'high' : 'medium',
      title  : 'تراجع الإيراد مقارنة بالفترة السابقة',
      finding: `الإيراد ${cur(c.k.revenue)} مقابل ${cur(c.cmp.revenue.prev)} (${pc(c.cmp.revenue.pct)}). ` +
               `أكبر تراجع في: ` + (c.cmp.serviceMoves.filter(s => s.diff < 0).slice(0, 3)
                 .map(s => `${s.svc} (${cur(s.diff)})`).join('، ') || '—') + '.',
      impact : Math.abs(c.cmp.revenue.diff),
      metric : 'نمو الإيراد', value: pc(c.cmp.revenue.pct), target: '≥ 0%'
    };
  }
},
/* ---------- قواعد تعمل فقط عند رفع تقرير بيان الحالة ---------- */
{
  id: 'discountLoad', area: 'التسعير والخصومات',
  test(c) {
    const S = c.S; if (!S) return false;
    if (S.discRate < 0.05) return false;
    return {
      sev: S.discRate > 0.15 ? 'high' : S.discRate > 0.10 ? 'medium' : 'low',
      title  : 'الخصومات تلتهم شريحة من الإيراد',
      finding: `إجمالي الخصومات ${cur(S.disc)} من سعر قائمة ${cur(S.gross)} — أي ${pc(S.discRate)}. ` +
               `الصافي المحصّل ${cur(S.net)} على ${eg(S.qty)} وحدة خدمة.`,
      impact : S.disc * 0.4,
      impactNote: `استرداد 40% فقط من هذه الخصومات يضيف ${cur(S.disc * 0.4)}.`,
      metric : 'الخصم ÷ سعر القائمة', value: pc(S.discRate), target: '≤ 5%'
    };
  }
},
{
  id: 'discountOutliers', area: 'التسعير والخصومات',
  test(c) {
    const S = c.S; if (!S || !S.heavyDiscounts.length) return false;
    const bad = S.heavyDiscounts.filter(x => x.rate >= 0.25);
    if (!bad.length) return false;
    return {
      sev: bad.length > 3 ? 'high' : 'medium',
      title  : 'بنود بخصومات استثنائية تحتاج مراجعة',
      finding: `${cnt(bad.length, 'بند واحد', 'بندان', 'بنود', 'بنداً')} بخصم 25% فأكثر: ` +
               bad.slice(0, 4).map(x => `«${x.service}» ${pc(x.rate)} (${cur(x.discount)})`).join('، ') + '.',
      impact : bad.reduce((s, x) => s + x.discount, 0),
      metric : 'أعلى خصم على بند', value: pc(bad[0].rate), target: '≤ 25%'
    };
  }
},
{
  id: 'doctorDiscount', area: 'التسعير والخصومات',
  test(c) {
    const S = c.S; if (!S) return false;
    const d = S.doctors.filter(x => x.gross > S.gross * 0.03)
      .sort((a, b) => b.discRate - a.discRate)[0];
    if (!d || d.discRate < 0.12) return false;
    return {
      sev: d.discRate > 0.20 ? 'medium' : 'low',
      title  : 'تفاوت كبير في سياسة الخصم بين الأطباء',
      finding: `${d.isDept ? '' : 'د/ '}${d.doctor} يمنح ${pc(d.discRate)} خصماً (${cur(d.disc)}) ` +
               `مقابل متوسط عام ${pc(S.discRate)}. ` +
               `أقل الممنوحين: ` + S.doctors.filter(x => x.gross > S.gross * 0.03)
                 .sort((a, b) => a.discRate - b.discRate).slice(0, 2)
                 .map(x => `${x.doctor} ${pc(x.discRate)}`).join('، ') + '.',
      impact : Math.max(d.disc - d.gross * S.discRate, 0),
      metric : 'أعلى نسبة خصم لطبيب', value: pc(d.discRate), target: '≤ ' + pc(Math.max(S.discRate, 0.1))
    };
  }
},
{
  id: 'doctorMargin', area: 'ربحية الأطباء',
  test(c) {
    const S = c.S; if (!S || !S.matched) return false;
    const losers = S.withMargin.filter(d => d.margin !== null && d.feeRatio !== null && d.feeRatio > 0.55);
    if (!losers.length) return false;
    const w = losers[0];
    return {
      sev: losers.some(d => d.margin < 0) ? 'high' : 'medium',
      title  : 'أطباء أتعابهم تلتهم معظم إيرادهم',
      finding: losers.slice(0, 3).map(d =>
        `${d.isDept ? '' : 'د/ '}${d.doctor}: إيراد ${cur(d.net)} وأتعاب ${cur(d.fees)} ` +
        `(${pc(d.feeRatio)}) فيتبقى ${cur(d.margin)}`).join(' · ') +
        `. تم مطابقة ${cnt(S.matched, 'طبيب واحد', 'طبيبين', 'أطباء', 'طبيباً')} بين التقريرين.`,
      impact : losers.reduce((s, d) => s + Math.max(d.fees - d.net * 0.5, 0), 0),
      impactNote: 'إعادة التفاوض إلى 50% من إيراد الطبيب تحرّر هذا المبلغ.',
      metric : 'أعلى نسبة أتعاب إلى إيراد الطبيب', value: pc(w.feeRatio), target: '≤ 50%'
    };
  }
},
{
  id: 'deptShare', area: 'ربحية الأطباء',
  test(c) {
    const S = c.S; if (!S || !S.depts.length) return false;
    const share = S.depts.reduce((s, d) => s + d.share, 0);
    if (share < 0.15) return false;
    return {
      sev: 'low',
      title  : 'الأقسام المساندة تمثل شريحة مؤثرة من الإيراد',
      finding: S.depts.map(d => `${d.doctor} ${cur(d.net)} (${pc(d.share)})`).join('، ') +
               `. مجتمعة ${pc(share)} من الإيراد — لها تكلفة تشغيل مستقلة يجب قياسها.`,
      impact : 0,
      metric : 'حصة الأقسام المساندة', value: pc(share), target: 'تُقاس ربحيتها منفصلة'
    };
  }
},
{
  id: 'costSpike', area: 'هيكل التكلفة',
  test(c) {
    if (!c.cmp) return false;
    const up = c.cmp.expenseMoves.filter(m => m.diff > 0 && m.prev > 0 && m.diff / m.prev > 0.25)[0];
    if (!up) return false;
    return {
      sev: up.diff / up.prev > 0.6 ? 'high' : 'medium',
      title  : 'قفزة غير مبرَّرة في أحد بنود المصروف',
      finding: `بند «${up.cat}» ارتفع من ${cur(up.prev)} إلى ${cur(up.cur)} (+${pc(up.diff / up.prev)}).`,
      impact : up.diff,
      metric : up.cat, value: cur(up.cur), target: '≤ ' + cur(up.prev * 1.1)
    };
  }
}
];

/* ============================================================
   التوصيات — كل توصية مرتبطة بمخاطرة
   ============================================================ */
const ADVICE = {
  margin: c => ({
    title: 'خطة استعادة الهامش على مسارين: رفع الإيراد وضبط البنود الثلاثة الكبرى',
    steps: [
      `راجع تسعير أعلى 5 خدمات (تمثل ${pc(c.A.top5Services.reduce((s, x) => s + x.total, 0) / c.k.revenue)} من الإيراد) — رفع 7% عليها وحده يضيف نحو ${cur(c.A.top5Services.reduce((s, x) => s + x.total, 0) * 0.07)}.`,
      `ثبّت سقفاً شهرياً لكل بند مصروف واربط الصرف فوقه بموافقة مكتوبة.`,
      `احسب هامش كل خدمة على حدة (سعر − أتعاب الطبيب − مستهلكات) وأوقف أو أعد تسعير أي خدمة بهامش سالب.`
    ]
  }),
  costRatio: c => ({
    title: 'ضبط أكبر ثلاثة بنود مصروف قبل أي شيء آخر',
    steps: c.A.expCats.slice(0, 3).map(x =>
      `${x.cat}: ${cur(x.total)} (${pc(x.pct)} من المنصرف) — حدّد سقفاً مستهدفاً ${cur(x.total * 0.9)} وراجعه أسبوعياً.`)
  }),
  breakEven: c => ({
    title: 'توسيع هامش الأمان فوق نقطة التعادل',
    steps: [
      `نقطة التعادل الحالية ${cur(c.k.breakEvenRev)}. استهدف إيراداً لا يقل عن ${cur(c.k.breakEvenRev * 1.6)}.`,
      `حوّل ما أمكن من التكاليف الثابتة إلى متغيّرة: تعاقدات أطباء بالنسبة بدل الثابت، خدمات مساندة بالطلب.`,
      `أنشئ احتياطي سيولة يعادل شهرين من التكاليف الثابتة (${cur(c.k.fixedCost * 2)}).`
    ]
  }),
  doctorFees: c => ({
    title: 'إعادة هيكلة نموذج أتعاب الأطباء',
    steps: [
      `حوّل التعاقدات إلى نسبة من إيراد الطبيب الفعلي بدل المبالغ المقطوعة — يتطلب أولاً ربط الطبيب بالإيصال.`,
      `ضع سقفاً: ألا تتجاوز أتعاب أي طبيب ${pc(c.B.doctorFeeRatioMax)} من الإيراد المنسوب له.`,
      `راجع الأطباء ذوي متوسط الدفعة الأعلى: ` + c.A.doctors.slice().sort((a, b) => b.avg - a.avg).slice(0, 3)
        .map(d => `د/ ${d.doctor} (${cur(d.avg)} للدفعة)`).join('، ') + '.'
    ]
  }),
  payroll: c => ({
    title: 'ربط كتلة الأجور بالإنتاجية',
    steps: [
      `الإيراد الحالي لكل جنيه أجور ${(c.k.revenue / (c.cat('مرتبات وأجور') || 1)).toFixed(2)} جنيه — استهدف 4.0 على الأقل.`,
      `أعد توزيع ورديات التمريض والاستقبال حسب كثافة الأيام: ` +
        c.A.dowAgg.filter(d => d.days).sort((a, b) => b.avg - a.avg).slice(0, 2).map(d => d.dow).join(' و') + ' هما الأعلى.',
      `حوّل جزءاً من الأجر الثابت إلى حافز مرتبط بعدد الإيصالات أو رضا المرضى.`
    ]
  }),
  rent: c => ({
    title: 'رفع العائد على المساحة المستأجرة',
    steps: [
      `الإيجار ${cur(c.cat('إيجارات'))} — استغل ساعات الفراغ بتشغيل عيادات مسائية أو تأجير غرف لتخصصات زائرة.`,
      `تفاوض على تجديد العقد بزيادة مربوطة بالتضخم وليس بنسبة مفتوحة.`
    ]
  }),
  fixedLoad: c => ({
    title: 'خفض حساسية الأرباح لتقلّب الإيراد',
    steps: [
      `كل انخفاض 10% في الإيراد يخفض الصافي بنحو ${cur(c.k.revenue * 0.1)} لأن التكاليف لا تنخفض معه.`,
      `راجع أي تعاقد ثابت يمكن تحويله للدفع بالاستخدام.`
    ]
  }),
  doctorConc: c => ({
    title: 'تقليل الاعتماد على الطبيب الأعلى حصة',
    steps: [
      `د/ ${c.A.doctors[0].doctor} يمثل ${pc(c.A.doctors[0].share)} — ضع خطة إحلال وطبيباً بديلاً في نفس التخصص خلال 60 يوماً.`,
      `وثّق قاعدة مرضاه داخل نظام المركز لا لدى الطبيب.`,
      `ثبّت عقداً مكتوباً بمدة إشعار لا تقل عن 60 يوماً.`
    ]
  }),
  serviceConc: c => ({
    title: 'توسيع مزيج الخدمات',
    steps: [
      `«${c.A.services[0].key}» تمثل ${pc(c.k.topServiceShare)} — استهدف خفضها إلى ${pc(c.B.topServiceShareMax)} عبر النمو في غيرها لا بتقليصها.`,
      `أضعف الفئات حالياً: ` + c.A.serviceCats.slice(-3).map(x => `${x.key} (${pc(x.pct)})`).join('، ') +
        ' — اختر واحدة وابنِ لها باقة وحملة تسويقية.'
    ]
  }),
  catConc: c => ({
    title: 'بناء مصدر إيراد ثانٍ',
    steps: [
      `فئة «${c.A.serviceCats[0].key}» تمثل ${pc(c.A.serviceCats[0].pct)}. اختر تخصصاً واحداً من الأضعف واستثمر فيه هذا الربع.`,
      `احسب العائد المتوقع قبل شراء أي جهاز: (عدد الحالات المتوقع × السعر) − (الأتعاب + المستهلكات + الإهلاك).`
    ]
  }),
  cash: c => ({
    title: 'تحويل التحصيل نحو الوسائل الرقمية',
    steps: [
      `النقدي ${pc(c.k.cashShare)} — استهدف ${pc(c.B.cashShareMax)} خلال 90 يوماً.`,
      `فعّل نقاط بيع إضافية ومحفظة إلكترونية في الاستقبال، واعرض خصم 2% على الدفع الرقمي للخدمات فوق 500 جنيه.`,
      `اعتمد جرد خزينة يومي موقّع بمطابقة إيصال-بإيصال.`
    ]
  }),
  advances: c => ({
    title: 'ضبط السلف والمسحوبات',
    steps: [
      `${cur(c.cat('سلف ومسحوبات'))} خرجت كسلف — ضع سقفاً لا يتجاوز 10% من صافي أجر الموظف وبموافقة مكتوبة.`,
      `افتح حساب «سلف مستحقة» ليظهر الرصيد القائم بدل تحميله كمصروف.`
    ]
  }),
  retention: c => ({
    title: 'برنامج استرجاع المرضى ذوي الزيارة الواحدة',
    steps: [
      `${cnt(c.k.oneVisit,'مريض واحد','مريضان','مرضى','مريضاً')} لم يعودوا — اتصال متابعة خلال 7 أيام من الزيارة الأولى.`,
      `احجز موعد المتابعة قبل مغادرة المريض الاستقبال، لا بعدها.`,
      `أطلق باقات (3 أو 5 جلسات) للخدمات التي تحتمل التكرار مثل ${c.A.serviceCats.find(x => /علاج طبيعي|تمريض/.test(x.key)) ? c.A.serviceCats.find(x => /علاج طبيعي|تمريض/.test(x.key)).key : 'الخدمات المتكررة'}.`
    ]
  }),
  weakDays: c => {
    const act = c.A.dowAgg.filter(d => d.days > 0);
    const avg = act.reduce((s, d) => s + d.avg, 0) / act.length;
    const weak = act.filter(d => d.avg < avg * 0.7).map(d => d.dow);
    return {
      title: 'تشغيل الأيام الضعيفة',
      steps: [
        `${weak.join(' و')} أضعف الأيام — خصّصها لعيادات بموعد مسبق وباقات مخفّضة.`,
        `أعد توزيع جدول الأطباء بحيث لا تُهدر تكلفة ثابتة في يوم منخفض الطلب.`,
        `قِس الأثر بعد 4 أسابيع: المستهدف ${cur(avg * 0.85)} كمتوسط لهذه الأيام.`
      ]
    };
  },
  volatility: c => ({
    title: 'تسوية تدفق الطلب',
    steps: [
      `فعّل الحجز المسبق وذكّر بالمواعيد قبل 24 ساعة لتقليل الغياب.`,
      `ثبّت جدول أطباء معلَناً شهرياً — التذبذب غالباً انعكاس لعدم انتظام حضور الأطباء.`,
      `راقب المستهدف اليومي ${cur(c.k.revPerDay)} على لوحة الاستقبال.`
    ]
  }),
  ticket: c => ({
    title: 'استعادة متوسط قيمة الإيصال',
    steps: [
      `درّب الاستقبال على عرض الخدمات المكمّلة (تحاليل، أشعة، متابعة) عند الحجز.`,
      `راجع أي خصومات غير موثّقة على مستوى الإيصال.`
    ]
  }),
  supplies: c => ({
    title: 'إنشاء دورة مخزون حقيقية للمستهلكات',
    steps: [
      `افتح كارت صنف لكل مستهلك: ` + c.A.supplies.slice(0, 5).map(s => s.item).join('، ') + `.`,
      `اربط صرف المستهلك برقم الإيصال — الملاحظات الحالية تثبت الاستهلاك لكنها لا تُحمَّل على التكلفة.`,
      `جرد شهري بالكميات، واحتساب تكلفة المستهلكات ضمن هامش كل خدمة.`,
      `الفجوة التقديرية ${cur(Math.max(c.k.revenue * c.B.suppliesRatioMin - c.k.suppliesRecorded, 0))} — الربح المعلن أعلى من الحقيقي بهذا القدر تقريباً.`
    ]
  }),
  unclassified: c => ({
    title: 'إغلاق باب المصروفات بلا بند',
    steps: [
      `${cnt(c.A.unclassifiedRows.length,'حركة واحدة','حركتان','حركات','حركة')} بقيمة ${cur(c.A.unclassifiedRows.reduce((s, r) => s + r.amount, 0))} بلا تصنيف — اعتمد قائمة بنود مغلقة في نظام الخزينة.`,
      `امنع حفظ أي سند صرف بدون اختيار بند من القائمة.`,
      `أعِد تصنيف الحركات القائمة أثرياً قبل إقفال الشهر.`
    ]
  }),
  noDoctorLink: c => ({
    title: 'ربط كل إيصال بالطبيب المعالج',
    steps: [
      `أضف عمود «الطبيب» إلزامياً في شاشة الإيصال.`,
      `بعد شهر واحد ستتمكن من حساب: إيراد كل طبيب، هامشه الصافي، وعائد كل ساعة عيادة.`,
      `هذا شرط مسبق لأي إعادة تفاوض على نسب الأتعاب.`
    ]
  }),
  noTime: c => ({
    title: 'تسجيل توقيت الإيصال',
    steps: [
      `فعّل ختم الوقت التلقائي على الإيصال.`,
      `بعد 4 أسابيع حلّل ساعات الذروة وأعد جدولة التمريض والاستقبال عليها.`
    ]
  }),
  noAR: c => ({
    title: 'فصل الحسابات المستحقة عن دفتر الخزينة',
    steps: [
      `أنشئ كشف مدينين (مرضى وشركات تأمين) وكشف دائنين (موردون) شهرياً.`,
      `تابع أعمار الديون: 30/60/90 يوماً.`
    ]
  }),
  patientConc: c => ({
    title: 'توسيع قاعدة المرضى',
    steps: [
      `أعلى 10 مرضى يمثلون ${pc(c.A.topPatients.slice(0, 10).reduce((s, p) => s + p.total, 0) / c.k.revenue)} — وسّع قنوات جذب المرضى الجدد.`,
      `تتبّع مصدر كل مريض جديد (إحالة، إعلان، مرور) لقياس تكلفة الاكتساب.`
    ]
  }),
  trendDown: c => ({
    title: 'وقف تراجع الإيراد',
    steps: [
      `الفجوة ${cur(Math.abs(c.cmp.revenue.diff))} — حدّد سببها: عدد المرضى أم متوسط الإيصال؟ ` +
        `المرضى ${c.cmp.patients.pct !== null ? pc(c.cmp.patients.pct) : '—'}، متوسط الإيصال ${c.cmp.avgTicket.pct !== null ? pc(c.cmp.avgTicket.pct) : '—'}.`,
      `راجع غياب أي طبيب أو توقف خدمة خلال الفترة.`
    ]
  }),
  discountLoad: c => ({
    title: 'وضع سياسة خصم مكتوبة بسقوف واضحة',
    steps: [
      `الخصومات ${cur(c.S.disc)} = ${pc(c.S.discRate)} من سعر القائمة. استهدف 5% خلال ربع سنة.`,
      `حدّد سقفاً لكل مستوى: استقبال 5%، مدير 10%، ما فوق ذلك بموافقة مكتوبة منك.`,
      `أي خصم يُسجَّل بسببه في النظام — بدون سبب لا يُقبل الخصم.`,
      `راجع أعلى الفئات خصماً: ` + c.S.cats.slice().sort((a, b) => b.discRate - a.discRate).slice(0, 3)
        .map(x => `${x.cat} ${pc(x.discRate)}`).join('، ') + '.'
    ]
  }),
  discountOutliers: c => ({
    title: 'مراجعة البنود ذات الخصم الاستثنائي بنداً بنداً',
    steps: [
      `أعلى البنود: ` + c.S.heavyDiscounts.slice(0, 5)
        .map(x => `«${x.service}» ${pc(x.rate)}`).join('، ') + '.',
      `قرّر لكل بند: إما أن السعر المعلن مبالغ فيه فيُخفَّض رسمياً، أو أن الخصم غير مبرَّر فيُوقَف.`,
      `الخصم الدائم على بند معناه أن قائمة الأسعار غير واقعية — عالج السبب لا العرض.`
    ]
  }),
  doctorDiscount: c => ({
    title: 'توحيد سياسة الخصم بين الأطباء',
    steps: [
      `الفارق بين أعلى وأدنى طبيب في منح الخصم كبير — وحّد السقف للجميع.`,
      `اربط صلاحية الخصم بالنظام لا بالاجتهاد الشخصي.`
    ]
  }),
  doctorMargin: c => ({
    title: 'إعادة التفاوض على أتعاب الأطباء بناءً على إيرادهم الفعلي',
    steps: [
      `الآن أصبح إيراد كل طبيب معلوماً بعد رفع تقرير بيان الحالة — استخدمه في التفاوض.`,
      `المستهدف ألا تتجاوز أتعاب الطبيب 50% من إيراده المحصّل.`,
      `أعلى النسب: ` + c.S.withMargin.filter(d => d.feeRatio !== null)
        .sort((a, b) => b.feeRatio - a.feeRatio).slice(0, 3)
        .map(d => `${d.doctor} ${pc(d.feeRatio)}`).join('، ') + '.',
      `احسب أيضاً تكلفة المستهلكات والوقت العيادي قبل اعتماد أي نسبة جديدة.`
    ]
  }),
  deptShare: c => ({
    title: 'قياس ربحية الأقسام المساندة منفصلة',
    steps: [
      `المعمل والأشعة والتمريض لها تكلفة كواشف وأجهزة وإهلاك — افصل حساباتها.`,
      `قارن سعر التحليل الداخلي بتكلفة إرساله لمعمل خارجي قبل أي استثمار جديد.`
    ]
  }),
  costSpike: c => ({
    title: 'تفسير قفزة المصروف واعتمادها أو ردّها',
    steps: [
      `اطلب مستندات البند المرتفع وقارنها بالفترة السابقة سنداً بسند.`,
      `إن كانت الزيادة هيكلية، أدرجها في الموازنة؛ وإن كانت استثنائية، وثّقها كبند غير متكرر.`
    ]
  })
};

/* ============================================================
   خطة العمل — مهام تنفيذية بمدد ومؤشرات قياس
   ============================================================ */
const PLAN = {
  supplies: c => ([
    { t: 'فتح كروت أصناف للمستهلكات الطبية وربطها برقم الإيصال', own: 'مدير المشتريات + التمريض', wk: '١–٢', kpi: 'نسبة المستلزمات إلى الإيراد', tgt: '≥ ' + pc(c.B.suppliesRatioMin), pr: 1 },
    { t: 'جرد افتتاحي بالكميات لكل صنف وتحديد حد إعادة الطلب', own: 'أمين المخزن', wk: '٢', kpi: 'أصناف مجرودة', tgt: '100%', pr: 1 },
    { t: 'إعادة احتساب هامش كل خدمة بعد تحميل تكلفة المستهلكات', own: 'المحاسب', wk: '٣–٤', kpi: 'خدمات ذات هامش سالب', tgt: '0', pr: 2 }
  ]),
  unclassified: c => ([
    { t: 'اعتماد شجرة بنود مصروف مغلقة ومنع الحفظ بدون بند', own: 'المحاسب + مطوّر النظام', wk: '١', kpi: 'المصروفات غير المصنّفة', tgt: '≤ ' + pc(c.B.unclassifiedMax), pr: 1 },
    { t: 'إعادة تصنيف الحركات القائمة قبل إقفال الشهر', own: 'أمين الخزينة', wk: '١–٢', kpi: 'حركات بلا بند', tgt: '0', pr: 1 }
  ]),
  noDoctorLink: c => ([
    { t: 'إضافة حقل «الطبيب المعالج» إلزامياً على شاشة الإيصال', own: 'مطوّر النظام', wk: '١–٢', kpi: 'إيصالات مرتبطة بطبيب', tgt: '100%', pr: 1 },
    { t: 'إصدار أول تقرير ربحية لكل طبيب', own: 'المحاسب', wk: '٥–٦', kpi: 'تقرير ربحية الطبيب', tgt: 'صادر', pr: 2 }
  ]),
  cash: c => ([
    { t: 'تفعيل نقطة بيع إضافية ومحفظة إلكترونية في الاستقبال', own: 'مدير المركز', wk: '١–٢', kpi: 'حصة التحصيل الرقمي', tgt: '≥ ' + pc(1 - c.B.cashShareMax), pr: 1 },
    { t: 'جرد خزينة يومي موقّع ومطابقة إيصال-بإيصال', own: 'أمين الخزينة', wk: '١ ومستمر', kpi: 'فروق الجرد', tgt: '0 جنيه', pr: 1 },
    { t: 'خصم 2% على الدفع الرقمي للخدمات فوق 500 جنيه', own: 'مدير المركز', wk: '٣', kpi: 'حصة النقدي', tgt: '≤ ' + pc(c.B.cashShareMax), pr: 3 }
  ]),
  retention: c => ([
    { t: 'حجز موعد المتابعة قبل مغادرة المريض الاستقبال', own: 'مشرف الاستقبال', wk: '١', kpi: 'نسبة الحجز المسبق للمتابعة', tgt: '≥ 40%', pr: 1 },
    { t: 'مكالمة متابعة خلال 7 أيام لكل مريض زيارة أولى', own: 'خدمة العملاء', wk: '١–٤', kpi: 'نسبة المرضى المتكررين', tgt: '≥ ' + pc(c.B.returningRateMin), pr: 1 },
    { t: 'إطلاق باقات 3 و5 جلسات للخدمات المتكررة', own: 'مدير المركز', wk: '٢–٣', kpi: 'عدد الباقات المُباعة', tgt: '≥ 20 باقة', pr: 2 }
  ]),
  weakDays: c => ([
    { t: 'إعادة جدولة الأطباء على الأيام الضعيفة وإلغاء الورديات غير المجدية', own: 'مدير المركز', wk: '١–٢', kpi: 'متوسط إيراد اليوم الضعيف', tgt: '+20%', pr: 2 },
    { t: 'عرض ترويجي مخصص لهذه الأيام', own: 'التسويق', wk: '٢–٤', kpi: 'عدد الإيصالات في اليوم الضعيف', tgt: '+15%', pr: 3 }
  ]),
  doctorConc: c => ([
    { t: 'التعاقد مع طبيب بديل في تخصص الطبيب الأعلى حصة', own: 'المدير الطبي', wk: '٢–٦', kpi: 'حصة أعلى طبيب', tgt: '≤ ' + pc(c.B.topDoctorShareMax), pr: 2 },
    { t: 'توثيق عقود الأطباء بمدة إشعار 60 يوماً', own: 'الشؤون القانونية', wk: '١–٣', kpi: 'عقود موثّقة', tgt: '100%', pr: 2 }
  ]),
  doctorFees: c => ([
    { t: 'إعداد نموذج أتعاب بالنسبة بدل المقطوع وعرضه على الأطباء', own: 'المدير المالي', wk: '٣–٦', kpi: 'أتعاب الأطباء ÷ الإيراد', tgt: '≤ ' + pc(c.B.doctorFeeRatioMax), pr: 2 }
  ]),
  margin: c => ([
    { t: 'مراجعة تسعير أعلى 5 خدمات واعتماد قائمة أسعار جديدة', own: 'المدير المالي', wk: '١–٣', kpi: 'الهامش الصافي', tgt: '≥ ' + pc(c.B.netMarginMin), pr: 1 },
    { t: 'وضع سقف شهري لكل بند مصروف وربط التجاوز بموافقة مكتوبة', own: 'المحاسب', wk: '١–٢', kpi: 'بنود تجاوزت السقف', tgt: '0', pr: 1 }
  ]),
  costRatio: c => ([
    { t: 'مراجعة أكبر ثلاثة بنود مصروف بنداً بنداً', own: 'المدير المالي', wk: '١–٢', kpi: 'المنصرف ÷ الإيراد', tgt: '≤ 70%', pr: 1 }
  ]),
  payroll: c => ([
    { t: 'إعادة توزيع الورديات حسب كثافة الأيام', own: 'مدير المركز', wk: '٢–٣', kpi: 'الإيراد لكل جنيه أجور', tgt: '≥ 4.0', pr: 2 }
  ]),
  rent: c => ([
    { t: 'تشغيل عيادات مسائية أو تأجير غرف لتخصصات زائرة', own: 'مدير المركز', wk: '٣–٨', kpi: 'الإيجار ÷ الإيراد', tgt: '≤ ' + pc(c.B.rentRatioMax), pr: 3 }
  ]),
  advances: c => ([
    { t: 'اعتماد لائحة سلف بسقف 10% من صافي الأجر وفتح حساب سلف مستحقة', own: 'الموارد البشرية + المحاسب', wk: '١–٢', kpi: 'رصيد السلف القائمة', tgt: 'مُرحَّل ومعروف', pr: 2 }
  ]),
  volatility: c => ([
    { t: 'تفعيل الحجز المسبق والتذكير قبل 24 ساعة', own: 'الاستقبال', wk: '١–٣', kpi: 'معامل اختلاف الإيراد اليومي', tgt: '≤ ' + pc(c.B.revenueCvMax), pr: 2 },
    { t: 'نشر جدول الأطباء شهرياً قبل بداية الشهر', own: 'المدير الطبي', wk: '٤', kpi: 'التزام الجدول', tgt: '≥ 90%', pr: 2 }
  ]),
  serviceConc: c => ([
    { t: 'اختيار فئة خدمية ضعيفة وبناء باقة وحملة لها', own: 'التسويق', wk: '٢–٦', kpi: 'حصة أعلى خدمة', tgt: '≤ ' + pc(c.B.topServiceShareMax), pr: 3 }
  ]),
  catConc: c => ([
    { t: 'دراسة جدوى مبسّطة لتخصص ثانٍ قبل أي إنفاق رأسمالي', own: 'المدير المالي', wk: '٤–٨', kpi: 'حصة أعلى فئة', tgt: '≤ 55%', pr: 3 }
  ]),
  breakEven: c => ([
    { t: 'بناء احتياطي سيولة يعادل شهرين من التكاليف الثابتة', own: 'المدير المالي', wk: '٤–١٢', kpi: 'الاحتياطي النقدي', tgt: cur(c.k.fixedCost * 2), pr: 2 }
  ]),
  noTime: c => ([
    { t: 'تفعيل ختم الوقت التلقائي على الإيصالات', own: 'مطوّر النظام', wk: '١–٢', kpi: 'إيصالات بوقت', tgt: '100%', pr: 3 }
  ]),
  noAR: c => ([
    { t: 'إصدار كشف مدينين ودائنين شهري بأعمار الديون', own: 'المحاسب', wk: '٣–٤', kpi: 'كشف صادر', tgt: 'شهرياً', pr: 3 }
  ]),
  trendDown: c => ([
    { t: 'تحليل سبب التراجع (عدد مرضى أم متوسط إيصال) وخطة تصحيح', own: 'مدير المركز', wk: '١', kpi: 'نمو الإيراد', tgt: '≥ 0%', pr: 1 }
  ]),
  costSpike: c => ([
    { t: 'مراجعة مستندات البند المرتفع واعتماده أو ردّه', own: 'المحاسب', wk: '١', kpi: 'البند المرتفع', tgt: 'مُبرَّر مستندياً', pr: 1 }
  ]),
  discountLoad: c => ([
    { t: 'إصدار سياسة خصم مكتوبة بسقوف لكل مستوى وظيفي', own: 'مدير المركز', wk: '١–٢', kpi: 'الخصم ÷ سعر القائمة', tgt: '≤ 5%', pr: 1 },
    { t: 'إلزام تسجيل سبب الخصم في النظام ومنع الحفظ بدونه', own: 'مطوّر النظام', wk: '٢–٣', kpi: 'خصومات بلا سبب', tgt: '0', pr: 1 }
  ]),
  discountOutliers: c => ([
    { t: 'مراجعة البنود ذات الخصم فوق 25% وتصحيح سعرها أو إيقاف خصمها', own: 'المدير المالي', wk: '١–٢', kpi: 'بنود بخصم > 25%', tgt: '0', pr: 1 }
  ]),
  doctorDiscount: c => ([
    { t: 'توحيد سقف الخصم بين كل الأطباء وربطه بالنظام', own: 'مدير المركز', wk: '٢–٣', kpi: 'تفاوت نسب الخصم', tgt: '≤ 5 نقاط', pr: 2 }
  ]),
  doctorMargin: c => ([
    { t: 'إعادة التفاوض على أتعاب الأطباء الأعلى نسبة إلى إيرادهم', own: 'المدير المالي', wk: '٢–٦', kpi: 'أتعاب الطبيب ÷ إيراده', tgt: '≤ 50%', pr: 1 },
    { t: 'إصدار تقرير ربحية شهري لكل طبيب من التقريرين معاً', own: 'المحاسب', wk: '٤', kpi: 'تقرير صادر', tgt: 'شهرياً', pr: 2 }
  ]),
  deptShare: c => ([
    { t: 'فصل حسابات المعمل والأشعة والتمريض كمراكز تكلفة مستقلة', own: 'المحاسب', wk: '٤–٨', kpi: 'ربحية كل قسم', tgt: 'معلومة', pr: 3 }
  ]),
  ticket: c => ([
    { t: 'تدريب الاستقبال على عرض الخدمات المكمّلة', own: 'مشرف الاستقبال', wk: '٢–٣', kpi: 'متوسط الإيصال', tgt: 'استعادة المستوى السابق', pr: 2 }
  ]),
  patientConc: c => ([
    { t: 'تتبّع مصدر كل مريض جديد وقياس تكلفة الاكتساب', own: 'التسويق', wk: '٢–٤', kpi: 'مرضى جدد شهرياً', tgt: '+10%', pr: 3 }
  ])
};

/* مهام حوكمة دائمة تُضاف دائماً */
const BASELINE = c => ([
  { t: 'إقفال شهري خلال أول 5 أيام عمل ورفع الملف على اللوحة', own: 'المحاسب', wk: '١', kpi: 'موعد الإقفال', tgt: '≤ 5 أيام', pr: 1 },
  { t: 'مراجعة هذه اللوحة في اجتماع إدارة أسبوعي ثابت', own: 'مدير المركز', wk: 'أسبوعياً', kpi: 'اجتماعات منعقدة', tgt: '4 من 4', pr: 2 },
  { t: 'تحديث المستهدفات في ملف الإعدادات بعد كل ربع سنة', own: 'المدير المالي', wk: '١٢', kpi: 'مراجعة المعايير', tgt: 'ربع سنوية', pr: 3 }
]);

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV_AR    = { critical: 'حرجة', high: 'مرتفعة', medium: 'متوسطة', low: 'منخفضة' };

/* ============================================================
   التشغيل
   ============================================================ */
function evaluate(A, cmp) {
  const B = Object.assign({
    netMarginMin: .25, netMarginGood: .35, doctorFeeRatioMax: .35, payrollRatioMax: .25,
    rentRatioMax: .12, fixedCostRatioMax: .45, cashShareMax: .60, topServiceShareMax: .30,
    topDoctorShareMax: .25, returningRateMin: .30, revenueCvMax: .45,
    suppliesRatioMin: .02, unclassifiedMax: .03
  }, (root.SONO_CONFIG || {}).benchmarks || {});

  const ctx = {
    A, k: A.kpi, B, cmp, span: A.meta.spanDays,
    S: A.status || null,              /* تحليل بيان الحالة إن وُجد */
    cat: name => (A.expCats.find(x => x.cat === name) || { total: 0 }).total
  };

  const risks = [];
  RULES.forEach(r => {
    let res;
    try { res = r.test(ctx); } catch (e) { res = false; }
    if (res) risks.push(Object.assign({ id: r.id, area: r.area, sevAr: SEV_AR[res.sev] }, res));
  });
  risks.sort((a, b) => (SEV_ORDER[a.sev] - SEV_ORDER[b.sev]) || (b.impact - a.impact));

  const recos = risks.map((r, i) => {
    const f = ADVICE[r.id];
    const a = f ? f(ctx) : { title: r.title, steps: [] };
    return { n: i + 1, riskId: r.id, area: r.area, sev: r.sev, sevAr: r.sevAr,
             title: a.title, steps: a.steps, impact: r.impact, linkedRisk: r.title };
  });

  /* خطة العمل: مهام المخاطر المفعّلة + المهام الأساسية، مرتبة بالأولوية */
  const seen = new Set();
  let plan = [];
  risks.forEach(r => {
    const f = PLAN[r.id];
    if (!f) return;
    f(ctx).forEach(t => {
      const key = t.t;
      if (seen.has(key)) return;
      seen.add(key);
      plan.push(Object.assign({}, t, { area: r.area, riskId: r.id, sev: r.sev }));
    });
  });
  BASELINE(ctx).forEach(t => { if (!seen.has(t.t)) { seen.add(t.t); plan.push(Object.assign({}, t, { area: 'الحوكمة', riskId: 'baseline', sev: 'low' })); } });
  plan.sort((a, b) => a.pr - b.pr);
  plan = plan.map((t, i) => Object.assign({ n: i + 1 }, t));

  /* ملخص تنفيذي */
  const crit = risks.filter(r => r.sev === 'critical' || r.sev === 'high');
  const upside = risks.reduce((s, r) => s + (r.impact || 0), 0);
  const summary = buildSummary(ctx, risks, crit, upside);

  return { risks, recos, plan, summary,
           score: healthScore(ctx, risks),
           upside, criticalCount: crit.length };
}

function healthScore(c, risks) {
  let s = 100;
  risks.forEach(r => { s -= ({ critical: 22, high: 12, medium: 6, low: 2 })[r.sev] || 0; });
  return Math.max(0, Math.min(100, Math.round(s)));
}

function buildSummary(c, risks, crit, upside) {
  const k = c.k, A = c.A;
  const lines = [];
  lines.push({
    h: 'أين يقف المركز',
    p: `خلال ${cnt(A.meta.spanDays,'يوم واحد','يومين','أيام','يوماً')} (${A.meta.rangeLabel}) حقّق المركز إيراداً قدره ${cur(k.revenue)} ` +
       `مقابل منصرف ${cur(k.cost)}، بصافي ${cur(k.net)} وهامش ${pc(k.margin)}. ` +
       `خدم ${cnt(k.patients,'مريضاً واحداً','مريضين','مرضى','مريضاً')} عبر ${cnt(k.receipts,'إيصال واحد','إيصالين','إيصالات','إيصالاً')} و${cnt(k.lineItems,'بند خدمة واحد','بندي خدمة','بنود خدمة','بند خدمة')}، ` +
       `بمتوسط ${cur(k.avgTicket)} للإيصال و${cur(k.avgPerPatient)} للمريض.`
  });
  lines.push({
    h: 'من أين يأتي الإيراد',
    p: `أعلى فئة «${A.serviceCats[0] ? A.serviceCats[0].key : '—'}» بنسبة ${A.serviceCats[0] ? pc(A.serviceCats[0].pct) : '—'}، ` +
       `وأعلى خدمة مفردة «${A.services[0] ? A.services[0].key : '—'}» بنسبة ${pc(k.topServiceShare)}. ` +
       `التحصيل: ${A.methods.map(m => `${m.method} ${pc(m.pct)}`).join('، ')}. ` +
       `أقوى يوم ${bestDow(A)} وأضعفه ${worstDow(A)}.`
  });
  lines.push({
    h: 'إلى أين يذهب المنصرف',
    p: `${A.expCats.slice(0, 4).map(x => `${x.cat} ${cur(x.total)} (${pc(x.pct)})`).join('، ')}. ` +
       `التكاليف الثابتة وشبه الثابتة ${cur(k.fixedCost)} أي ${pc(k.fixedRatio)} من الإيراد، ` +
       `ونقطة التعادل التقديرية ${cur(k.breakEvenRev)}.`
  });
  lines.push({
    h: 'الخلاصة',
    p: crit.length
       ? `${cnt(crit.length, 'مخاطرة واحدة', 'مخاطرتان', 'مخاطر', 'مخاطرة')} ذات أولوية عالية تتصدرها «${crit[0].title}». ` +
         `مجموع الفرصة المالية القابلة للاسترداد من معالجة كل المخاطر يقارب ${cur(upside)} في الفترة` +
         (c.span ? `، أي نحو ${cur(upside * YEAR_FACTOR(c.span))} سنوياً.` : '.')
       : `لا توجد مخاطر عالية. المؤشرات ضمن النطاقات المستهدفة — ركّز على تثبيت الأداء وتوسيع القاعدة.`
  });
  if (c.cmp) {
    lines.push({
      h: 'مقارنة بالفترة السابقة',
      p: ['revenue', 'net', 'patients', 'avgTicket'].map(f => {
        const x = c.cmp[f];
        const nm = { revenue: 'الإيراد', net: 'الصافي', patients: 'المرضى', avgTicket: 'متوسط الإيصال' }[f];
        return `${nm} ${x.pct === null ? '—' : (x.pct >= 0 ? '+' : '') + pc(x.pct)}`;
      }).join(' · ') + '.'
    });
  }
  return lines;
}
function bestDow(A) { const a = A.dowAgg.filter(d => d.days).sort((x, y) => y.avg - x.avg)[0]; return a ? `${a.dow} (${cur(a.avg)})` : '—'; }
function worstDow(A) { const a = A.dowAgg.filter(d => d.days).sort((x, y) => x.avg - y.avg)[0]; return a ? `${a.dow} (${cur(a.avg)})` : '—'; }

root.SonoRules = { evaluate, SEV_AR, SEV_ORDER };
})(window);
