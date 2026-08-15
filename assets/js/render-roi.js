/* ============================================================
   render-roi.js — تاب «التسويق والعائد»
   ثلاثة أقسام: أداء حملات Meta، فجوة الإنفاق (رسمي/فعلي)،
   والعائد الحقيقي (مطابقة حجوزات قناة سوشيال ميديا بالإنفاق الفعلي).
   ============================================================ */
(function (root) {
'use strict';
const C = root.SonoCharts;
const fmt = C.fmt, esc = C.esc;
const eg = v => fmt(v) + ' جنيه';
const pc = v => (v === null || v === undefined || !isFinite(v)) ? '—' : (v * 100).toFixed(1) + '%';
const numS = s => `<span class="num">${esc(s)}</span>`;

function emptyState() {
  return `<div class="notice">
    <h3>لسّة مفيش ملفات تسويق مرفوعة</h3>
    <ul>
      <li><span>١</span><div>تقرير حملات Meta Ads (تصدير CSV من مدير الإعلانات)</div></li>
      <li><span>٢</span><div>كشف سحوبات البنك الخاص بدفع الإعلانات (Excel أو CSV)</div></li>
      <li><span>٣</span><div>فاتورة Meta الرسمية (تصدير من صفحة الفوترة)</div></li>
    </ul>
    <div class="note" style="margin-top:8px">ارفعها من نفس زرّ رفع الملفات في الأعلى — اللوحة تكتشف نوعها تلقائياً ولا تتعارض مع تقارير العيادة.</div>
  </div>`;
}

function perfSection(P, trend) {
  if (!P) return `<div class="card"><h2>أداء حملات Meta</h2>
    <div class="note">ارفع ملف تصدير الحملات (CSV) لعرض هذا القسم.</div></div>`;
  const kpis = `<div class="kpis">
    <div class="kpi k5"><div class="lbl">إجمالي الإنفاق</div><div class="val">${numS(fmt(P.totalSpend))}<span class="unit">جنيه</span></div><div class="foot">${P.count} حملة</div></div>
    <div class="kpi"><div class="lbl">محادثات مسنجر بدأت</div><div class="val">${numS(fmt(P.totalMsgConv))}</div><div class="foot">من كل الحملات</div></div>
    <div class="kpi k2"><div class="lbl">عدد الليدز (Leads)</div><div class="val">${numS(fmt(P.totalLeads))}</div><div class="foot">${P.avgCostPerLead ? eg(P.avgCostPerLead) + ' للّيد' : '—'}</div></div>
    <div class="kpi k3"><div class="lbl">متوسط تكلفة النتيجة</div><div class="val">${numS(eg(P.avgCostPerResult))}</div><div class="foot">لكل نتيجة معلَنة</div></div>
  </div>`;
  const trendCard = trend.length ? `<div class="card"><h2>اتجاه الإنفاق اليومي الفعلي</h2>
    <div class="note">من كشف السحوبات البنكية — سحوبات إعلانات فقط بدون التسويات</div>
    <div id="roiTrend"></div></div>` : '';
  const topCampaigns = P.byCampaign.slice(0, 10);
  const campaignsCard = `<div class="card"><h2>أعلى ١٠ حملات إنفاقاً</h2>
    <div class="tscroll"><table>
      <thead><tr><th>الحملة</th><th>الإنفاق</th><th>تكلفة النتيجة</th><th>محادثات مسنجر</th><th>ليدز</th><th>تكلفة الليد</th></tr></thead>
      <tbody>${topCampaigns.map(r => `<tr>
        <td>${esc(r.name)}</td><td class="n">${fmt(r.spend)}</td>
        <td class="n">${r.costPerResult ? fmt(r.costPerResult) : '—'}</td>
        <td class="n">${fmt(r.messagingConv)}</td><td class="n">${fmt(r.leads)}</td>
        <td class="n">${r.costPerLead ? fmt(r.costPerLead) : '—'}</td></tr>`).join('')}</tbody>
    </table></div></div>`;
  return `<div class="card insHead"><h2>١) أداء حملات Meta</h2></div>${kpis}${trendCard}${campaignsCard}`;
}

function gapSection(G) {
  if (!G) return `<div class="card"><h2>فجوة الإنفاق</h2>
    <div class="note">ارفع فاتورة Meta الرسمية وكشف السحوبات البنكية لعرض هذا القسم.</div></div>`;
  const bad = G.gapPct !== null && Math.abs(G.gapPct) > 0.05;
  const tone = G.official === 0 || G.actual === 0 ? '' : (bad ? 'k5' : 'k4');
  const donutRows = [
    { label: 'الرسمي (فاتورة Meta)', value: Math.max(G.official, 0), color: 'var(--petrol)' },
    { label: 'الفعلي (سحوبات البنك)', value: Math.max(G.actual, 0), color: 'var(--clay)' }
  ];
  return `<div class="card insHead"><h2>٢) فجوة الإنفاق المالي</h2>
      <div class="note">مقارنة ما دفعته Meta فعلياً في فاتورتها الرسمية بما خرج من حساب البنك تحت بند «سحب إعلان»</div></div>
    <div class="kpis">
      <div class="kpi"><div class="lbl">الإنفاق الرسمي (فاتورة Meta)</div><div class="val">${numS(fmt(G.official))}<span class="unit">جنيه</span></div></div>
      <div class="kpi k5"><div class="lbl">الإنفاق الفعلي (سحوبات البنك)</div><div class="val">${numS(fmt(G.actual))}<span class="unit">جنيه</span></div></div>
      <div class="kpi ${tone}"><div class="lbl">الفجوة</div><div class="val">${numS((G.gap >= 0 ? '+' : '') + fmt(G.gap))}<span class="unit">جنيه</span></div>
        <div class="foot">${G.gapPct !== null ? pc(G.gapPct) + ' عن الرسمي' : '—'}</div></div>
    </div>
    <div class="card"><h2>الرسمي مقابل الفعلي</h2><div id="roiGapDonut"></div>
      <div class="note" style="margin-top:10px">الفجوة قد تعني: مصاريف بطاقة غير مرتبطة بحساب الإعلانات نفسه، رسوم تحويل/عمولة بنكية، أو فروق توقيت بين تاريخ السحب وتاريخ الفوترة. ${G.settlementsTotal ? `فيه أيضاً ${eg(G.settlementsTotal)} تحويلات/سداد ظاهرة في كشف البنك لم تُحتسب ضمن الإنفاق الفعلي لأنها ليست سحب إعلان مباشر.` : ''}</div></div>`;
}

function roiSection(R) {
  if (!R || !R.hasData) return `<div class="card"><h2>العائد الحقيقي</h2>
    <div class="note">محتاج بيانات حجوزات قناة «سوشيال ميديا» (من تقرير بيان الحالة) + كشف السحوبات البنكية معاً لحساب هذا القسم.</div></div>`;
  const goodRoi = R.roi !== null && R.roi >= 0;
  return `<div class="card insHead"><h2>٣) العائد الحقيقي (True ROI)</h2>
      <div class="note">مطابقة حجوزات قناة «سوشيال ميديا» الفعلية (من بيان الحالة) بالإنفاق الفعلي على الإعلانات</div></div>
    <div class="kpis">
      <div class="kpi"><div class="lbl">حجوزات من سوشيال ميديا</div><div class="val">${numS(fmt(R.bookings))}<span class="unit">حجز</span></div></div>
      <div class="kpi k4"><div class="lbl">إيراد هذه الحجوزات</div><div class="val">${numS(fmt(R.revenue))}<span class="unit">جنيه</span></div></div>
      <div class="kpi k5"><div class="lbl">الإنفاق الفعلي على الإعلانات</div><div class="val">${numS(fmt(R.spend))}<span class="unit">جنيه</span></div></div>
      <div class="kpi ${R.roi === null ? '' : (goodRoi ? 'k4' : 'k5')}"><div class="lbl">العائد الحقيقي</div>
        <div class="val">${numS(R.roi === null ? '—' : (R.roi >= 0 ? '+' : '') + (R.roi * 100).toFixed(0))}${R.roi !== null ? '<span class="unit">%</span>' : ''}</div>
        <div class="foot">(الإيراد − الإنفاق) ÷ الإنفاق</div></div>
      <div class="kpi k3"><div class="lbl">تكلفة اكتساب الحجز (CAC)</div><div class="val">${numS(R.cac ? fmt(R.cac) : '—')}${R.cac ? '<span class="unit">جنيه</span>' : ''}</div></div>
      ${R.conversionRate !== null ? `<div class="kpi k2"><div class="lbl">معدل التحويل من الليدز</div><div class="val">${numS(pc(R.conversionRate))}</div><div class="foot">${fmt(R.bookings)} حجز من ${fmt(R.leads)} تواصل/ليد</div></div>` : ''}
    </div>
    <div class="note">⚠️ الرقم تقريبي: الإنفاق مأخوذ من كل فترة كشف البنك، والحجوزات من كل فترة تقرير بيان الحالة — لو الفترتان مش متطابقتين تماماً، ارفع ملفات لنفس الفترة الزمنية لتحصل على رقم دقيق.</div>`;
}

function render(el, ctx) {
  ctx = ctx || {};
  const roi = root.SonoRoi ? root.SonoRoi.analyze(ctx) : { has: false };
  if (!roi.has) { el.innerHTML = emptyState(); return; }

  el.innerHTML = `
    ${perfSection(roi.perf, roi.spendTrend)}
    ${gapSection(roi.gap)}
    ${roiSection(roi.roi)}`;

  if (roi.spendTrend.length) {
    const t = document.getElementById('roiTrend');
    if (t) C.line(t, roi.spendTrend, { label: 'الإنفاق', color: 'var(--clay)' });
  }
  if (roi.gap) {
    const g = document.getElementById('roiGapDonut');
    if (g) C.donut(g, [
      { label: 'الرسمي (فاتورة Meta)', value: Math.max(roi.gap.official, 0), color: 'var(--petrol)' },
      { label: 'الفعلي (سحوبات البنك)', value: Math.max(roi.gap.actual, 0), color: 'var(--clay)' }
    ]);
  }
}

root.SonoRenderRoi = { render };
})(window);
