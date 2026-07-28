/* ============================================================
   exporters.js — تصدير Excel متعدد الشيتات و PDF عربي
   ============================================================ */
(function (root) {
'use strict';
const pc = v => +(v * 100).toFixed(1);
const r0 = v => Math.round(v);

function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
}

/* ============================================================
   Excel — كل قسم في شيت مستقل، باتجاه من اليمين لليسار
   ============================================================ */
function toXlsx(A, E, ctx, datasets) {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const k = A.kpi;

  const add = (name, rows, widths) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = (widths || []).map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };

  /* 1) الملخص */
  add('الملخص', [
    [ctx.clinic], [ctx.branch], ['الفترة', A.meta.rangeLabel], ['تاريخ التصدير', new Date().toLocaleString('ar-EG')], [],
    ['المؤشر', 'القيمة', 'الوحدة'],
    ['إجمالي الإيراد', r0(k.revenue), 'جنيه'],
    ['إجمالي المنصرف', r0(k.cost), 'جنيه'],
    ['الصافي', r0(k.net), 'جنيه'],
    ['الهامش الصافي', pc(k.margin), '%'],
    ['عدد المرضى', k.patients, 'مريض'],
    ['عدد الإيصالات', k.receipts, 'إيصال'],
    ['بنود الخدمة', k.lineItems, 'بند'],
    ['متوسط الإيصال', r0(k.avgTicket), 'جنيه'],
    ['متوسط المريض', r0(k.avgPerPatient), 'جنيه'],
    ['نسبة المرضى المتكررين', pc(k.repeatRate), '%'],
    ['متوسط الزيارات لكل مريض', +k.visitsPerPatient.toFixed(2), 'زيارة'],
    ['أتعاب الأطباء', r0(k.doctorFees), 'جنيه'],
    ['أتعاب الأطباء ÷ الإيراد', pc(k.doctorFeeRatio), '%'],
    ['التكاليف الثابتة وشبه الثابتة', r0(k.fixedCost), 'جنيه'],
    ['نقطة التعادل التقديرية', r0(k.breakEvenRev), 'جنيه'],
    ['حصة التحصيل النقدي', pc(k.cashShare), '%'],
    ['تذبذب الإيراد اليومي', pc(k.cv), '%'],
    ['مؤشر الصحة العام', E.score, 'من 100'],
    ['الفرصة المالية القابلة للاسترداد', r0(E.upside), 'جنيه'],
    [],
    ['قراءة تنفيذية'],
    ...E.summary.map(s => [s.h, s.p])
  ], [34, 16, 10]);

  /* 2) الحركة اليومية */
  add('الحركة اليومية', [
    ['التاريخ', 'اليوم', 'الوارد', 'المنصرف', 'الصافي', 'الإيصالات', 'المرضى'],
    ...A.daily.map(d => [d.date, d.dow, r0(d.rev), r0(d.exp), r0(d.net), d.rcpt, d.pat]),
    ['الإجمالي', '', r0(k.revenue), r0(k.cost), r0(k.net), k.receipts, '']
  ], [13, 11, 12, 12, 12, 11, 10]);

  /* 3) الأسبوعي */
  add('الأسبوعي', [
    ['الأسبوع', 'الفترة', 'الوارد', 'المنصرف', 'الصافي', 'أيام', 'الإيصالات'],
    ...A.weekly.map(w => [w.idx, w.label, r0(w.rev), r0(w.exp), r0(w.net), w.days, w.rcpt])
  ], [9, 34, 12, 12, 12, 8, 11]);

  /* 4) الخدمات */
  add('الخدمات', [
    ['الخدمة', 'الفئة', 'عدد المرات', 'الإيراد المخصص', '% من الإيراد'],
    ...A.services.map(s => [s.key, s.cat, s.count, r0(s.total), pc(s.total / (k.revenue || 1))])
  ], [46, 20, 12, 15, 13]);

  add('فئات الخدمات', [
    ['الفئة', 'عدد البنود', 'الإيراد', '% من الإيراد'],
    ...A.serviceCats.map(c => [c.key, c.count, r0(c.total), pc(c.pct)])
  ], [24, 12, 14, 13]);

  /* 5) المصروفات */
  add('بنود المصروف', [
    ['البند', 'الطبيعة', 'عدد الحركات', 'المبلغ', '% من المنصرف', '% من الإيراد'],
    ...A.expCats.map(c => [c.cat, c.group, c.count, r0(c.total), pc(c.pct), pc(c.pctRev)])
  ], [26, 14, 13, 14, 14, 13]);

  /* 6) الأطباء */
  add('الأطباء', [
    ['الطبيب', 'الأتعاب', 'عدد الدفعات', 'أيام النشاط', 'متوسط الدفعة', 'الحصة %'],
    ...A.doctors.map(d => [d.doctor, r0(d.fees), d.payouts, d.days, r0(d.avg), pc(d.share)])
  ], [24, 13, 12, 12, 14, 11]);

  /* 7) طرق الدفع + أيام الأسبوع */
  add('التحصيل', [
    ['طريقة الدفع', 'عدد العمليات', 'الإيراد', '% من الإيراد'],
    ...A.methods.map(m => [m.method, m.count, r0(m.total), pc(m.pct)]),
    [], ['يوم الأسبوع', 'عدد الأيام', 'إجمالي الإيراد', 'المتوسط اليومي'],
    ...A.dowAgg.filter(d => d.days).map(d => [d.dow, d.days, r0(d.rev), r0(d.avg)])
  ], [18, 14, 14, 15]);

  /* 8) المستهلكات */
  add('المستهلكات', [
    ['البند', 'مرات الذكر في الملاحظات', 'الكمية التقديرية'],
    ...A.supplies.map(s => [s.item, s.mentions, s.qty]),
    [], ['المسجّل محاسبياً تحت «مستلزمات طبية»', r0(k.suppliesRecorded), 'جنيه'],
    ['نسبته إلى الإيراد', pc(k.suppliesRatio), '%']
  ], [30, 24, 16]);

  /* 9) المخاطر */
  add('المخاطر', [
    ['#', 'الخطورة', 'المجال', 'المخاطرة', 'التفصيل', 'المؤشر', 'القيمة', 'المستهدف', 'الأثر المالي'],
    ...E.risks.map((r, i) => [i + 1, r.sevAr, r.area, r.title, r.finding, r.metric, r.value, r.target, r0(r.impact || 0)])
  ], [5, 11, 14, 34, 70, 24, 13, 15, 13]);

  /* 10) التوصيات */
  const recoRows = [['#', 'التوصية', 'الخطوة', 'المجال', 'مرتبطة بمخاطرة']];
  E.recos.forEach(r => r.steps.forEach((s, j) => recoRows.push([j ? '' : r.n, j ? '' : r.title, s, j ? '' : r.area, j ? '' : r.linkedRisk])));
  add('التوصيات', recoRows, [5, 40, 74, 14, 34]);

  /* 11) خطة العمل */
  add('خطة العمل', [
    ['#', 'المهمة', 'المجال', 'المسؤول', 'التوقيت', 'مؤشر القياس', 'المستهدف', 'الأولوية'],
    ...E.plan.map(t => [t.n, t.t, t.area, t.own, 'أسبوع ' + t.wk, t.kpi, t.tgt, t.pr])
  ], [5, 54, 14, 26, 15, 30, 22, 9]);

  /* 12) حركات تحتاج تصنيف */
  if (A.unclassifiedRows.length) add('تحتاج تصنيف', [
    ['التاريخ', 'البيان', 'الملاحظات', 'المبلغ'],
    ...A.unclassifiedRows.map(r => [r.date, r.bayan, r.note, r0(r.amount)])
  ], [13, 34, 44, 12]);

  /* شيت لكل تقرير مرفوع */
  addDatasetSheets(wb, datasets, add);

  XLSX.writeFile(wb, `تقرير-سونو-${stamp()}.xlsx`, { compression: true });
}

/* ============================================================
   تصدير التقارير المرفوعة وحدها (حين لا يوجد تحليل خزينة)
   ============================================================ */
const RLBL = () => (root.SonoRenderReports && root.SonoRenderReports.LABEL) || {};
function addDatasetSheets(wb, datasets, add) {
  const L = RLBL();
  const used = new Set(wb.SheetNames.map(n => n));
  (datasets || []).forEach((ds, i) => {
    if (!ds.rows || !ds.rows.length) return;
    const cols = ds.columns.filter(c => c !== '_row');
    let nm = ds.name.slice(0, 28);
    let k = 1; while (used.has(nm)) nm = ds.name.slice(0, 25) + ' ' + (++k);
    used.add(nm);
    add(nm, [
      cols.map(c => L[c] || c),
      ...ds.rows.map(r => cols.map(c => r[c] === null || r[c] === undefined ? '' : r[c]))
    ], cols.map(c => ['service', 'name', 'item', 'desc', 'patient', 'account'].includes(c) ? 40 : 15));
  });
}

function datasetsXlsx(datasets, ctx) {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const add = (name, rows, widths) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = (widths || []).map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };
  add('الفهرس', [
    [ctx.clinic], [ctx.branch],
    ['تاريخ التصدير', new Date().toLocaleString('ar-EG')], [],
    ['التقرير', 'المجال', 'الملف', 'عدد السطور'],
    ...(datasets || []).map(d => [d.name, d.group || '', d.file, (d.rows || []).length])
  ], [34, 16, 34, 12]);
  addDatasetSheets(wb, datasets, add);
  XLSX.writeFile(wb, `تقارير-سونو-${stamp()}.xlsx`, { compression: true });
}

/* ============================================================
   PDF من عناصر الصفحة الفعلية — يصدّر ما تراه بالظبط
   يُستخدم لتصدير تاب واحد أو كل التابات معاً.
   ============================================================ */
async function toPdfFromNodes(nodes, opts) {
  opts = opts || {};
  if (!window.jspdf || !window.html2canvas)
    throw new Error('لم تُحمّل مكتبات إنشاء PDF. تأكد من الإنترنت ثم أعد المحاولة، أو استخدم زر «طباعة / حفظ PDF».');
  const { jsPDF } = window.jspdf;
  const list = (Array.isArray(nodes) ? nodes : [nodes]).filter(Boolean);
  if (!list.length) throw new Error('لا يوجد محتوى للتصدير.');

  /* غلاف مؤقت يحمل نسخة من العناصر بعرض ثابت */
  const host = document.createElement('div');
  host.setAttribute('dir', 'rtl');
  host.className = 'pdf-capture';
  host.style.cssText = 'position:absolute;left:-10000px;top:0;width:1120px;background:#fff;padding:26px';
  host.innerHTML = header(opts) +
    list.map(n => `<div style="margin-bottom:18px">${n.innerHTML}</div>`).join('') +
    footer(opts);
  document.body.appendChild(host);

  try {
    if (opts.onProgress) opts.onProgress('جارٍ تجهيز الصفحات…');
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
    await new Promise(r => setTimeout(r, 400));

    const canvas = await html2canvas(host, {
      scale: 2, backgroundColor: '#FFFFFF', useCORS: true, logging: false,
      windowWidth: 1120, width: 1120, scrollX: 0, scrollY: 0
    });
    if (!canvas || !canvas.width || !canvas.height)
      throw new Error('تعذّر تصوير المحتوى. استخدم زر «طباعة / حفظ PDF» كبديل مضمون.');

    if (opts.onProgress) opts.onProgress('جارٍ إنشاء ملف PDF…');
    return slice(canvas, jsPDF, opts.fileName || ('تقرير-سونو-' + stamp() + '.pdf'));
  } finally { host.remove(); }

  function header(o) {
    return `<div style="font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;direction:rtl;text-align:right;
      display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #16212E;
      padding-bottom:11px;margin-bottom:18px">
      <div><div style="font-family:Cairo;font-size:22px;font-weight:800">${esc2(o.clinic || '')}</div>
        <div style="font-size:12px;color:#5E7180">${esc2(o.branch || '')}${o.section ? ' · ' + esc2(o.section) : ''}</div></div>
      <div style="text-align:left;font-size:11px;color:#5E7180">فترة التقرير
        <div style="font-family:monospace;font-size:13px;color:#16212E;font-weight:600">${esc2(o.range || '')}</div></div>
    </div>`;
  }
  function footer(o) {
    return `<div style="font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;direction:rtl;
      font-size:10.5px;color:#5E7180;text-align:center;margin-top:20px;border-top:1px solid #D4DBE0;padding-top:9px;line-height:1.8">
      جميع المبالغ بالجنيه المصري · صدر في ${new Date().toLocaleString('ar-EG')}<br>${esc2(o.clinic || '')}</div>`;
  }
}
function esc2(s) { return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

/* تقسيم لوحة الرسم على صفحات A4 */
function slice(canvas, jsPDF, fileName) {
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const M = 8, iw = pw - M * 2;
  const ih = canvas.height * iw / canvas.width;
  const pageH = ph - M * 2;
  const pages = Math.max(1, Math.ceil(ih / pageH));
  const sliceH = Math.ceil(canvas.height / pages);

  for (let p = 0; p < pages; p++) {
    const c2 = document.createElement('canvas');
    c2.width = canvas.width;
    c2.height = Math.min(sliceH, canvas.height - p * sliceH);
    const g = c2.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c2.width, c2.height);
    g.drawImage(canvas, 0, -p * sliceH);
    if (p) pdf.addPage();
    pdf.addImage(c2.toDataURL('image/jpeg', 0.92), 'JPEG', M, M, iw, c2.height * iw / canvas.width);
    pdf.setFontSize(8); pdf.setTextColor(120);
    pdf.text(`${p + 1} / ${pages}`, pw / 2, ph - 3, { align: 'center' });
  }
  pdf.save(fileName);
  return pages;
}

/* ============================================================
   PDF — يُبنى من نسخة HTML مخصّصة للطباعة ثم يُصوَّر ويُقسَّم لصفحات A4
   هذه الطريقة تحافظ على تشكيل الحروف العربية واتجاه النص بالكامل.
   ============================================================ */
async function toPdf(A, E, ctx, onProgress) {
  if (!window.jspdf || !window.html2canvas)
    throw new Error('لم تُحمّل مكتبات إنشاء PDF. تأكد من الاتصال بالإنترنت ثم أعد المحاولة، أو استخدم زر «طباعة / حفظ PDF».');
  const { jsPDF } = window.jspdf;
  const host = document.createElement('div');
  /* خارج الشاشة في التدفق العادي — أكثر ثباتاً مع html2canvas من position:fixed */
  host.setAttribute('dir', 'rtl');
  host.style.cssText = 'position:absolute;left:-10000px;top:0;width:960px;background:#fff';
  host.innerHTML = pdfHtml(A, E, ctx);
  document.body.appendChild(host);

  try {
    if (onProgress) onProgress('جارٍ تجهيز الصفحات…');
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
    await new Promise(r => setTimeout(r, 400));           /* مهلة إضافية لرسم الخطوط العربية */

    const canvas = await html2canvas(host, {
      scale: 2, backgroundColor: '#FFFFFF', useCORS: true, logging: false,
      windowWidth: 960, width: 960, scrollX: 0, scrollY: 0
    });
    if (!canvas || !canvas.width || !canvas.height)
      throw new Error('تعذّر تصوير التقرير. استخدم زر «طباعة / حفظ PDF» كبديل مضمون.');

    if (onProgress) onProgress('جارٍ إنشاء ملف PDF…');
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth();          /* 210 */
    const ph = pdf.internal.pageSize.getHeight();         /* 297 */
    const M = 8;                                          /* هامش */
    const iw = pw - M * 2;
    const ih = canvas.height * iw / canvas.width;         /* الارتفاع الكلي بالمليمتر */
    const pageH = ph - M * 2;
    const pages = Math.max(1, Math.ceil(ih / pageH));
    const sliceH = Math.ceil(canvas.height / pages);      /* بالبكسل */

    for (let p = 0; p < pages; p++) {
      const c2 = document.createElement('canvas');
      c2.width = canvas.width;
      c2.height = Math.min(sliceH, canvas.height - p * sliceH);
      const g = c2.getContext('2d');
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c2.width, c2.height);
      g.drawImage(canvas, 0, -p * sliceH);
      if (p) pdf.addPage();
      pdf.addImage(c2.toDataURL('image/jpeg', 0.92), 'JPEG', M, M, iw, c2.height * iw / canvas.width);
      pdf.setFontSize(8); pdf.setTextColor(120);
      pdf.text(`${p + 1} / ${pages}`, pw / 2, ph - 3, { align: 'center' });
    }
    pdf.save(`تقرير-سونو-${stamp()}.pdf`);
  } finally {
    host.remove();
  }
}

/* نسخة HTML مبسّطة ومهيّأة للطباعة */
function pdfHtml(A, E, ctx) {
  const k = A.kpi;
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const p2 = v => (v * 100).toFixed(1) + '%';
  const S = `font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;direction:rtl;text-align:right`;
  const H2 = `font-family:Cairo,sans-serif;font-size:17px;font-weight:700;color:#0D6E75;margin:22px 0 9px;padding-bottom:5px;border-bottom:2px solid #0D6E75`;
  const TD = `border:1px solid #D4DBE0;padding:6px 8px;font-size:11.5px`;
  const TH = TD + `;background:#EEF3F4;font-weight:600;color:#16242E`;

  const table = (heads, rows, aligns) => `
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;${S}">
      <thead><tr>${heads.map(h => `<th style="${TH}">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td style="${TD};${(aligns || [])[i] === 'n' ? 'text-align:left;font-family:monospace' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;

  const kpiBox = (l, v, s) => `
    <div style="border:1px solid #D4DBE0;border-top:3px solid #0D6E75;border-radius:8px;padding:9px 11px;flex:1;min-width:130px">
      <div style="font-size:10.5px;color:#5E7180">${esc(l)}</div>
      <div style="font-size:19px;font-weight:600;font-family:monospace;direction:ltr;text-align:right">${esc(v)}</div>
      <div style="font-size:10px;color:#5E7180;margin-top:3px">${esc(s)}</div></div>`;

  return `<div style="${S};background:#fff;padding:22px 26px;color:#16242E;line-height:1.7">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #16242E;padding-bottom:11px;margin-bottom:6px">
      <div><div style="font-family:Cairo;font-size:22px;font-weight:800">${esc(ctx.clinic)}</div>
        <div style="font-size:12px;color:#5E7180">${esc(ctx.branch)} · تقرير الأداء المالي والتشغيلي</div></div>
      <div style="text-align:left;font-size:11px;color:#5E7180">فترة التقرير
        <div style="font-family:monospace;font-size:13px;color:#16242E;font-weight:600">${esc(A.meta.rangeLabel)}</div></div>
    </div>
    <div style="font-size:10.5px;color:#5E7180;margin-bottom:16px">صدر في ${new Date().toLocaleString('ar-EG')} · مؤشر الصحة العام ${E.score}/100 · ${E.risks.length} مخاطرة مرصودة</div>

    <div style="${H2}">١ · المؤشرات الرئيسية</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">
      ${kpiBox('إجمالي الإيراد', fmt(k.revenue), 'جنيه · ' + fmt(k.revPerDay) + ' يومياً')}
      ${kpiBox('إجمالي المنصرف', fmt(k.cost), p2(k.costRatio) + ' من الإيراد')}
      ${kpiBox('الصافي', fmt(k.net), 'هامش ' + p2(k.margin))}
      ${kpiBox('عدد المرضى', fmt(k.patients), fmt(k.receipts) + ' إيصال')}
      ${kpiBox('متوسط الإيصال', fmt(k.avgTicket), 'المريض ' + fmt(k.avgPerPatient))}
      ${kpiBox('المرضى المتكررون', p2(k.repeatRate), fmt(k.repeat) + ' من ' + fmt(k.patients))}
      ${kpiBox('أتعاب الأطباء', fmt(k.doctorFees), p2(k.doctorFeeRatio) + ' من الإيراد')}
      ${kpiBox('نقطة التعادل', fmt(k.breakEvenRev), 'التغطية ' + (k.revenue / (k.breakEvenRev || 1)).toFixed(2) + '×')}
    </div>

    <div style="${H2}">٢ · ملخص التقرير</div>
    ${E.summary.map(s => `<div style="margin-bottom:11px">
      <div style="font-family:Cairo;font-weight:700;font-size:13.5px;margin-bottom:2px">${esc(s.h)}</div>
      <div style="font-size:12.5px;line-height:1.9">${esc(s.p)}</div></div>`).join('')}

    <div style="${H2}">٣ · المؤشرات مقابل المستهدف</div>
    ${table(['المؤشر', 'القيمة', 'المستهدف', 'الحالة'],
      metricRows(A).map(r => [r[0], r[1], r[2], r[3] ? 'ضمن المستهدف' : 'خارج المستهدف']), [null, 'n', 'n', null])}

    <div style="${H2}">٤ · المخاطر (${E.risks.length})</div>
    ${E.risks.map((r, i) => `
      <div style="border:1px solid #D4DBE0;border-right:4px solid ${sevColor(r.sev)};border-radius:7px;padding:10px 13px;margin-bottom:9px">
        <div style="font-family:Cairo;font-weight:700;font-size:13.5px">${i + 1}. ${esc(r.title)}
          <span style="font-size:10.5px;font-weight:600;color:${sevColor(r.sev)};margin-right:6px">[${esc(r.sevAr)} · ${esc(r.area)}]</span></div>
        <div style="font-size:12px;line-height:1.85;margin-top:4px">${esc(r.finding)}</div>
        ${r.impactNote ? `<div style="font-size:11.5px;color:#7A5408;background:#FDF6E8;padding:5px 8px;border-radius:5px;margin-top:5px">${esc(r.impactNote)}</div>` : ''}
        <div style="font-size:11px;color:#5E7180;margin-top:5px;border-top:1px solid #EEF1F3;padding-top:4px">
          ${esc(r.metric)}: <b>${esc(r.value)}</b> · المستهدف: <b>${esc(r.target)}</b>${r.impact > 0 ? ` · الأثر: <b>${fmt(r.impact)} جنيه</b>` : ''}</div>
      </div>`).join('')}

    <div style="${H2}">٥ · التوصيات (${E.recos.length})</div>
    ${E.recos.map(r => `
      <div style="margin-bottom:11px">
        <div style="font-family:Cairo;font-weight:700;font-size:13px">${r.n}. ${esc(r.title)}</div>
        <ol style="font-size:12px;line-height:1.85;padding-right:20px;margin-top:3px">
          ${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      </div>`).join('')}

    <div style="${H2}">٦ · خطة عمل الشهر القادم (${E.plan.length} مهمة)</div>
    ${table(['#', 'المهمة', 'المسؤول', 'التوقيت', 'مؤشر القياس', 'المستهدف', 'الأولوية'],
      E.plan.map(t => [t.n, t.t, t.own, 'أسبوع ' + t.wk, t.kpi, t.tgt, t.pr]), ['n'])}

    <div style="${H2}">٧ · هيكل المصروفات</div>
    ${table(['البند', 'الطبيعة', 'حركات', 'المبلغ', '% من المنصرف'],
      A.expCats.map(c => [c.cat, c.group, c.count, fmt(c.total), p2(c.pct)]), [null, null, 'n', 'n', 'n'])}

    <div style="${H2}">٨ · الأطباء</div>
    ${table(['الطبيب', 'الأتعاب', 'الدفعات', 'أيام النشاط', 'متوسط الدفعة', 'الحصة'],
      A.doctors.map(d => ['د/ ' + d.doctor, fmt(d.fees), d.payouts, d.days, fmt(d.avg), p2(d.share)]), [null, 'n', 'n', 'n', 'n', 'n'])}

    <div style="${H2}">٩ · فئات الخدمات وطرق التحصيل</div>
    ${table(['فئة الخدمة', 'بنود', 'الإيراد', '% من الإيراد'],
      A.serviceCats.map(c => [c.key, c.count, fmt(c.total), p2(c.pct)]), [null, 'n', 'n', 'n'])}
    ${table(['طريقة الدفع', 'عمليات', 'الإيراد', '% من الإيراد'],
      A.methods.map(m => [m.method, m.count, fmt(m.total), p2(m.pct)]), [null, 'n', 'n', 'n'])}

    <div style="font-size:10.5px;color:#5E7180;text-align:center;margin-top:24px;border-top:1px solid #D4DBE0;padding-top:9px;line-height:1.8">
      جميع المبالغ بالجنيه المصري · هذا التقرير لا يتضمن أي أسماء مرضى — البيانات مُجمّعة بالكامل<br>
      تولّد آلياً من ملف حركة الخزينة · ${esc(ctx.clinic)}
    </div>
  </div>`;
}

function sevColor(s) {
  return { critical: '#9B2C2C', high: '#C25B4E', medium: '#B67A12', low: '#0D6E75' }[s] || '#5E7180';
}
function metricRows(A) {
  const k = A.kpi, B = Object.assign({
    netMarginMin: .25, doctorFeeRatioMax: .35, fixedCostRatioMax: .45, cashShareMax: .60,
    topServiceShareMax: .30, topDoctorShareMax: .25, returningRateMin: .30, revenueCvMax: .45,
    suppliesRatioMin: .02, unclassifiedMax: .03
  }, (root.SONO_CONFIG || {}).benchmarks || {});
  const p = v => (v * 100).toFixed(1) + '%';
  return [
    ['الهامش الصافي', p(k.margin), '≥ ' + p(B.netMarginMin), k.margin >= B.netMarginMin],
    ['المنصرف ÷ الإيراد', p(k.costRatio), '≤ 70%', k.costRatio <= .70],
    ['أتعاب الأطباء ÷ الإيراد', p(k.doctorFeeRatio), '≤ ' + p(B.doctorFeeRatioMax), k.doctorFeeRatio <= B.doctorFeeRatioMax],
    ['التكاليف الثابتة ÷ الإيراد', p(k.fixedRatio), '≤ ' + p(B.fixedCostRatioMax), k.fixedRatio <= B.fixedCostRatioMax],
    ['تغطية نقطة التعادل', (k.revenue / (k.breakEvenRev || 1)).toFixed(2) + '×', '≥ 1.60×', (k.revenue / (k.breakEvenRev || 1)) >= 1.6],
    ['حصة التحصيل النقدي', p(k.cashShare), '≤ ' + p(B.cashShareMax), k.cashShare <= B.cashShareMax],
    ['حصة أعلى خدمة', p(k.topServiceShare), '≤ ' + p(B.topServiceShareMax), k.topServiceShare <= B.topServiceShareMax],
    ['حصة أعلى طبيب', p(k.topDoctorShare), '≤ ' + p(B.topDoctorShareMax), k.topDoctorShare <= B.topDoctorShareMax],
    ['نسبة المرضى المتكررين', p(k.repeatRate), '≥ ' + p(B.returningRateMin), k.repeatRate >= B.returningRateMin],
    ['تذبذب الإيراد اليومي', p(k.cv), '≤ ' + p(B.revenueCvMax), k.cv <= B.revenueCvMax],
    ['المستلزمات ÷ الإيراد', p(k.suppliesRatio), '≥ ' + p(B.suppliesRatioMin), k.suppliesRatio >= B.suppliesRatioMin],
    ['المصروفات غير المصنّفة', p(k.unclassifiedRatio), '≤ ' + p(B.unclassifiedMax), k.unclassifiedRatio <= B.unclassifiedMax]
  ];
}

/* ============================================================
   تصدير خطة العمل لمسؤول واحد
   ============================================================ */
function planXlsx(plan, ctx, owner) {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const rows = [
    [ctx.clinic], [ctx.branch],
    ['خطة العمل' + (owner ? ' — ' + owner : '')],
    ['الفترة', ctx.range || ''],
    ['تاريخ التصدير', new Date().toLocaleString('ar-EG')], [],
    ['#', 'المهمة', 'المجال', 'المسؤول', 'التوقيت', 'مؤشر القياس', 'المستهدف', 'الأولوية'],
    ...plan.map((t, i) => [i + 1, t.t, t.area, t.own, 'أسبوع ' + t.wk, t.kpi, t.tgt, t.pr])
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [5, 54, 16, 26, 15, 30, 22, 9].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'خطة العمل');
  XLSX.writeFile(wb, `خطة-العمل${owner ? '-' + owner.replace(/[\/\\:*?"<>|]/g, '') : ''}-${stamp()}.xlsx`,
                 { compression: true });
}

root.SonoExport = { toXlsx, toPdf, toPdfFromNodes, planXlsx, datasetsXlsx };
})(window);
