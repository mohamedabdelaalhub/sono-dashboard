/* ============================================================
   render.js — بناء محتوى التابات
   ============================================================ */
(function (root) {
'use strict';
const C = root.SonoCharts;
const fmt = C.fmt, esc = C.esc;
const pc  = v => (isFinite(v) ? (v * 100).toFixed(1) : '0.0') + '%';
const eg  = v => fmt(v) + ' جنيه';
const num = v => `<span class="num">${fmt(v)}</span>`;
const numS = s => `<span class="num">${esc(s)}</span>`;

function delta(d, invert) {
  if (!d || d.pct === null || !isFinite(d.pct)) return '';
  const up = d.pct >= 0;
  const good = invert ? !up : up;
  return `<span class="${good ? 'dl-up' : 'dl-dn'}">${up ? '▲' : '▼'} ${Math.abs(d.pct * 100).toFixed(1)}%</span>`;
}


/* ============================================================
   كتل التحليلات التشغيلية (insights.js) — تُعرض في كل التابات
   ============================================================ */
function insHtml(A, opts) {
  opts = opts || {};
  const I = A.ins;
  if (!I || !I.has) return '';
  return I.modules.map((m, i) => {
    const kp = (m.kpis || []).filter(Boolean);
    const chs = (m.charts || []).filter(c => c.data && c.data.length);
    const tbs = (m.tables || []).filter(t => t.rows && t.rows.length);
    return `
      <div class="card insHead">
        <h2>${esc(m.name)} <span class="tag area">${esc(m.group || '')}</span></h2>
        <div class="note">${esc(m.headline || '')}${m.rowCount ? ` · ${fmt(m.rowCount)} سطر` : ''}</div>
      </div>
      ${kp.length ? `<div class="kpis">${kp.map(c => `
        <div class="kpi ${c.tone || ''}">
          <div class="lbl">${esc(c.lbl)}</div>
          <div class="val">${numS(String(c.val))}${c.unit ? `<span class="unit">${esc(c.unit)}</span>` : ''}</div>
          <div class="foot">${esc(c.foot || '')}</div>
        </div>`).join('')}</div>` : ''}
      ${chs.length ? `<div class="${chs.length > 1 ? 'grid2' : ''}">${chs.map((c, j) => `
        <div class="card"><h2>${esc(c.title)}</h2>
          ${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}
          <div id="ins${i}_${j}"></div></div>`).join('')}</div>` : ''}
      ${tbs.map(t => `
        <div class="card"><h2>${esc(t.title)}</h2>
          ${t.note ? `<div class="note">${esc(t.note)}</div>` : ''}
          <div class="tscroll"><table>
            <thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
            <tbody>${t.rows.map(r => `<tr>${r.map((c, ci) => ci
              ? `<td class="n">${esc(String(c))}</td>` : `<td>${esc(String(c))}</td>`).join('')}</tr>`).join('')}</tbody>
          </table></div></div>`).join('')}`;
  }).join('');
}

function insDraw(A) {
  const I = A.ins;
  if (!I || !I.has) return;
  I.modules.forEach((m, i) => {
    (m.charts || []).filter(c => c.data && c.data.length).forEach((c, j) => {
      const el = document.getElementById(`ins${i}_${j}`);
      if (!el) return;
      const rows = c.data.map(d => ({
        label: String(d.label).length > 34 ? String(d.label).slice(0, 33) + '…' : String(d.label),
        title: String(d.label), value: d.value
      }));
      if (c.kind === 'donut') C.donut(el, rows, c.opts || {});
      else C.hbars(el, rows, c.opts || {});
    });
  });
}

/* ============================================================
   1) ملخص التقرير
   ============================================================ */
function renderSummary(el, A, E, cmp) {
  const k = A.kpi;
  const fin = k.revenue > 0 || k.cost > 0;
  el.innerHTML = `
    ${A.dupWarn ? `<div class="notice">
      <h3>تنبيه: أكثر من تقرير يصف نفس الإيراد</h3>
      <ul>
        <li><span>—</span><div>رفعت ${A.dupWarn.length} تقارير فيها مبالغ إيراد:
          <b>${A.dupWarn.map(esc).join('، ')}</b>.</div></li>
        <li><span>—</span><div>هذه التقارير تصف <b>نفس الأموال من زوايا مختلفة</b>، فجمعها معاً يضاعف الإيراد ويجعل الأرقام أعلى من الحقيقة.</div></li>
        <li><span>—</span><div>للحصول على رقم صحيح: ارفع <b>مصدر إيراد واحد</b> في المرة (تقرير الخزينة أو بيان الحالة أو كشف الحساب)، ومعه تقارير المصروفات والمرجعية.</div></li>
      </ul></div>` : ''}
    <div class="card">
      <div class="score">
        <div class="gauge" id="gg"></div>
        <div class="sd">
          <h2>مؤشر الصحة المالية والتشغيلية</h2>
          <p>محسوب آلياً من عدد المخاطر المكتشفة ودرجة خطورتها مقابل معايير المركز.
             ${E.criticalCount ? `<b>${E.criticalCount}</b> مخاطرة ذات أولوية عالية تحتاج قراراً هذا الشهر.` : 'لا مخاطر عالية في هذه الفترة.'}</p>
          <p style="margin-top:8px">الفرصة المالية القابلة للاسترداد من معالجة كل المخاطر: <b class="num">${fmt(E.upside)}</b> جنيه خلال الفترة.</p>
        </div>
      </div>
    </div>

    ${E.summary.map(s => `
      <div class="card">
        <h2>${esc(s.h)}</h2>
        <p style="font-size:14.5px;line-height:1.95;margin-top:8px">${esc(s.p)}</p>
      </div>`).join('')}

    ${!fin ? `<div class="notice">
      <h3>تحليل تشغيلي — لا توجد حركة إيراد أو مصروف في هذه التقارير</h3>
      <ul>
        <li><span>—</span><div>التقارير المرفوعة مرجعية أو تشغيلية، فبُني التقرير كله على تحليلها: المؤشرات والمخاطر والتوصيات وخطة العمل.</div></li>
        <li><span>—</span><div>لإضافة الهامش ونقطة التعادل وربحية الأطباء، ارفع معها <b>مصدر إيراد واحداً</b> (الخزينة أو بيان الحالة أو كشف الحساب).</div></li>
      </ul></div>` : ''}
    ${!fin ? '' : `<div class="card">
      <div class="chead">
        <div><h2>شريط حركة الخزينة</h2>
          <div class="note">الوارد أعلى الخط · المنصرف أسفله · الخط المتقطع = الرصيد التراكمي</div></div>
        <div class="seg" role="group">
          <button class="btn ghost" id="rbD" aria-pressed="true">يومي</button>
          <button class="btn ghost" id="rbW" aria-pressed="false">أسبوعي</button>
        </div>
      </div>
      <div id="ribbon"></div>
      <div class="ribbon-legend">
        <span><i style="background:var(--petrol)"></i>الوارد</span>
        <span><i style="background:var(--clay)"></i>المنصرف</span>
        <span><i style="background:var(--ink);opacity:.5"></i>الرصيد التراكمي</span>
      </div>
    </div>`}

    <div class="grid2">
      <div class="card"><h2>أعلى المخاطر</h2>
        <div class="note">مرتبة بالخطورة ثم بالأثر المالي</div>
        ${E.risks.slice(0, 4).map(r => `
          <div style="padding:9px 0;border-bottom:1px solid var(--line)">
            <span class="tag ${r.sev}">${esc(r.sevAr)}</span>
            <b style="font-size:13.5px;margin-right:7px">${esc(r.title)}</b>
            <div style="font-size:12.5px;color:var(--muted);margin-top:4px">${esc(r.metric)}: ${esc(r.value)} · الهدف ${esc(r.target)}</div>
          </div>`).join('') || '<p class="note">لا مخاطر.</p>'}
      </div>
      <div class="card"><h2>أول خمس مهام في خطة الشهر</h2>
        <div class="note">التفاصيل الكاملة في تاب «خطة العمل»</div>
        ${E.plan.slice(0, 5).map(t => `
          <div style="padding:9px 0;border-bottom:1px solid var(--line)">
            <span class="prio p${t.pr}">أولوية ${t.pr}</span>
            <b style="font-size:13.5px;margin-right:7px">${esc(t.t)}</b>
            <div style="font-size:12.5px;color:var(--muted);margin-top:4px">${esc(t.own)} · أسبوع ${esc(t.wk)} · ${esc(t.kpi)} → ${esc(t.tgt)}</div>
          </div>`).join('')}
      </div>
    </div>`;

  C.gauge(document.getElementById('gg'), E.score);
  if (!fin) return;
  drawRibbon(A, 'd');
  const bD = document.getElementById('rbD'), bW = document.getElementById('rbW');
  bD.onclick = () => { bD.setAttribute('aria-pressed', 'true'); bW.setAttribute('aria-pressed', 'false'); drawRibbon(A, 'd'); };
  bW.onclick = () => { bW.setAttribute('aria-pressed', 'true'); bD.setAttribute('aria-pressed', 'false'); drawRibbon(A, 'w'); };
}

function drawRibbon(A, mode) {
  const el = document.getElementById('ribbon');
  if (!el) return;
  const data = mode === 'd'
    ? A.daily.map(d => ({ lab: d.date.slice(8, 10), full: d.date + ' — ' + d.dow, inc: d.rev, out: d.exp, rcpt: d.rcpt, pat: d.pat }))
    : A.weekly.map(w => ({ lab: 'أ' + w.idx, full: w.label, inc: w.rev, out: w.exp, rcpt: w.rcpt }));
  C.ribbon(el, data, {});
}

/* ============================================================
   2) المؤشرات
   ============================================================ */
function renderKpi(el, A, E, cmp) {
  const k = A.kpi;
  const fin = k.revenue > 0 || k.cost > 0;
  const cards = [
    ['إجمالي الإيراد', fmt(k.revenue), 'جنيه', `${eg(k.revPerDay)} في اليوم`, '', cmp && cmp.revenue],
    ['إجمالي المنصرف', fmt(k.cost), 'جنيه', `${pc(k.costRatio)} من الإيراد`, 'k5', cmp && cmp.cost],
    ['الصافي', fmt(k.net), 'جنيه', `هامش ${pc(k.margin)}`, 'k4', cmp && cmp.net],
    ['عدد المرضى', fmt(k.patients), 'مريض', `${fmt(k.receipts)} إيصال · ${k.visitsPerPatient.toFixed(2)} زيارة/مريض`, 'k2', cmp && cmp.patients],
    ['متوسط الإيصال', fmt(k.avgTicket), 'جنيه', `المريض ${eg(k.avgPerPatient)}`, 'k3', cmp && cmp.avgTicket],
    ['المرضى المتكررون', pc(k.repeatRate), '', `${fmt(k.repeat)} من ${fmt(k.patients)} · ${fmt(k.oneVisit)} بزيارة واحدة`, 'k6', cmp && cmp.repeatRate],
    ['أتعاب الأطباء', fmt(k.doctorFees), 'جنيه', `${pc(k.doctorFeeRatio)} من الإيراد · ${A.doctors.length} طبيب`, 'k5', cmp && cmp.doctorFeeRatio],
    ['التحصيل النقدي', pc(k.cashShare), '', `الرقمي ${pc(k.digitalShare)}`, 'k3', cmp && cmp.cashShare],
    ['التكاليف الثابتة', fmt(k.fixedCost), 'جنيه', `${pc(k.fixedRatio)} من الإيراد`, 'k6', null],
    ['نقطة التعادل', fmt(k.breakEvenRev), 'جنيه', `التغطية ${(k.revenue / (k.breakEvenRev || 1)).toFixed(2)}×`, 'k2', null],
    ['التذبذب اليومي', pc(k.cv), '', `أعلى/أدنى يوم`, 'k3', null],
    ['بنود الخدمة', fmt(k.lineItems), 'بند', `متوسط البند ${eg(k.avgLine)}`, '', null]
  ];
  el.innerHTML = (!fin ? insHtml(A) : `
    <div class="kpis">${cards.map(c => `
      <div class="kpi ${c[4]}">
        <div class="lbl">${esc(c[0])}</div>
        <div class="val">${numS(c[1])}${c[2] ? `<span class="unit">${esc(c[2])}</span>` : ''}</div>
        <div class="foot">${esc(c[3])} ${delta(c[5], c[0] === 'إجمالي المنصرف' || c[0] === 'التحصيل النقدي')}</div>
      </div>`).join('')}</div>

    <div class="card">
      <h2>جدول المؤشرات مقابل المستهدف</h2>
      <div class="note">المستهدفات مأخوذة من ملف الإعدادات — يمكن تعديلها لتعكس سياسة المركز</div>
      <div class="tscroll"><table>
        <thead><tr><th>المؤشر</th><th>القيمة</th><th>المستهدف</th><th>الحالة</th><th>ملاحظة</th></tr></thead>
        <tbody>${metricTable(A, E)}</tbody>
      </table></div>
    </div>

    <div class="grid32">
      <div class="card"><h2>متوسط الإيراد حسب يوم الأسبوع</h2>
        <div class="note">إجمالي إيراد اليوم ÷ عدد مرات تكراره في الفترة</div>
        <div id="cDow"></div></div>
      <div class="card"><h2>طرق الدفع</h2>
        <div class="note">توزيع الإيراد حسب وسيلة التحصيل</div>
        <div id="cPay"></div></div>
    </div>

    <div class="grid2">
      <div class="card"><h2>مزيج الخدمات حسب الفئة</h2>
        <div class="note">الإيراد موزّع بالتساوي على بنود الإيصال متعدد الخدمات</div>
        <div id="cCat"></div></div>
      <div class="card"><h2>أعلى 12 خدمة بالإيراد</h2>
        <div class="note">من إجمالي ${A.services.length} خدمة مختلفة</div>
        <div id="cSvc"></div></div>
    </div>

    <div class="card">
      <h2>مقارنة الأطباء — الأتعاب المصروفة</h2>
      <div class="note">مصدرها بند «أتعاب د/…» في جانب المنصرف. لا يوجد ربط بين الطبيب والإيصال، لذا لا يمكن حساب إيراد كل طبيب.</div>
      <div class="tscroll"><table>
        <thead><tr><th>الطبيب</th><th>الأتعاب</th><th>عدد الدفعات</th><th>أيام النشاط</th><th>متوسط الدفعة</th><th style="width:24%">الحصة</th></tr></thead>
        <tbody>${A.doctors.map(d => `
          <tr><td>د/ ${esc(d.doctor)}</td>
            <td class="n">${fmt(d.fees)}</td><td class="n">${d.payouts}</td><td class="n">${d.days}</td>
            <td class="n">${fmt(d.avg)}</td>
            <td><div class="track" style="height:14px"><div class="fill" style="width:${(d.share / (A.doctors[0].share || 1) * 100).toFixed(1)}%"></div></div>
                <span class="num" style="font-size:11px;color:var(--muted)">${pc(d.share)}</span></td></tr>`).join('')}
        </tbody></table></div>
    </div>

    ${A.status ? statusBlocks(A.status) : ''}

    <div class="grid2">
      <div class="card"><h2>هيكل المصروفات</h2>
        <div class="note">إجمالي المنصرف ${eg(k.cost)}</div>
        <div id="cExp"></div></div>
      <div class="card"><h2>المستهلكات المرصودة من الملاحظات</h2>
        <div class="note">استُخرجت نصياً من حقل ملاحظات الإيصال — ليست دفتر مخزون</div>
        <div id="cSup"></div></div>
    </div>` + insHtml(A));

  if (!fin) { insDraw(A); return; }

  C.hbars(document.getElementById('cDow'),
    A.dowAgg.filter(d => d.days).map(d => ({ label: d.dow, value: d.avg })));
  C.donut(document.getElementById('cPay'),
    A.methods.map(m => ({ label: m.method, value: m.total })));
  C.donut(document.getElementById('cCat'),
    A.serviceCats.map(c => ({ label: c.key, value: c.total })));
  C.hbars(document.getElementById('cSvc'),
    A.services.slice(0, 12).map(s => ({ label: s.key.length > 34 ? s.key.slice(0, 33) + '…' : s.key, title: s.key, value: s.total })));
  C.hbars(document.getElementById('cExp'),
    A.expCats.map(c => ({ label: c.cat, value: c.total, color: c.cat === 'غير مصنّف' ? 'var(--clay)' : 'var(--petrol)' })));
  if (A.status) {
    const dc = document.getElementById('cDisc');
    if (dc) C.hbars(dc, A.status.cats.filter(c => c.disc > 0)
      .sort((a, b) => b.discRate - a.discRate)
      .map(c => ({ label: c.cat, value: +(c.discRate * 100).toFixed(1),
                   title: `${c.cat}: خصم ${fmt(c.disc)} من ${fmt(c.gross)}`,
                   color: c.discRate > 0.15 ? 'var(--clay)' : 'var(--petrol)' })), { suffix: '%' });
  }
  const sup = document.getElementById('cSup');
  if (A.supplies.length) {
    C.hbars(sup, A.supplies.map(s => ({ label: s.item, value: s.mentions })), { suffix: ' مرة' });
    sup.insertAdjacentHTML('beforeend',
      `<p class="note" style="margin-top:12px">المسجّل محاسبياً تحت «مستلزمات طبية»: <b class="num">${fmt(k.suppliesRecorded)}</b> جنيه فقط.</p>`);
  } else sup.innerHTML = '<p class="note">لا توجد ملاحظات استهلاك في هذه الفترة.</p>';
  insDraw(A);
}

/* ============================================================
   كتل تقرير بيان الحالة: إيراد الأطباء + الخصومات
   ============================================================ */
function statusBlocks(S) {
  const doc = d => (d.isDept ? '' : 'د/ ') + esc(d.doctor) + (d.grade ? ` <span style="color:var(--muted);font-size:11px">(${esc(d.grade)})</span>` : '');
  return `
    <div class="card" style="border-top:3px solid var(--petrol)">
      <div class="chead">
        <div><h2>إيراد الأطباء والأقسام</h2>
          <div class="note">من تقرير بيان الحالة المجمع · ${fmt(S.lines)} بند خدمة تحت
            ${fmt(S.doctorCount)} طبيب و${fmt(S.depts.length)} قسم مساند
            ${S.matched ? ` · طوبقت أتعاب ${fmt(S.matched)} منهم مع تقرير الخزينة` : ''}</div></div>
        <div style="text-align:left">
          <div style="font-size:12px;color:var(--muted)">الصافي المحصّل</div>
          <div class="num" style="font-size:20px;font-weight:600">${fmt(S.net)}</div>
        </div>
      </div>
      <div class="tscroll"><table>
        <thead><tr>
          <th>الطبيب / القسم</th><th>سعر القائمة</th><th>الخصم</th><th>%</th>
          <th>الصافي</th><th>الوحدات</th><th>متوسط السعر</th>
          ${S.matched ? '<th>الأتعاب</th><th>المتبقي</th><th>أتعاب/إيراد</th>' : ''}
          <th style="width:16%">الحصة</th>
        </tr></thead>
        <tbody>${S.doctors.map(d => `
          <tr>
            <td>${doc(d)}${d.isDept ? ' <span class="badge pend">قسم</span>' : ''}</td>
            <td class="n">${fmt(d.gross)}</td>
            <td class="n">${fmt(d.disc)}</td>
            <td class="n" style="color:${d.discRate > 0.15 ? 'var(--clay)' : 'inherit'}">${pc(d.discRate)}</td>
            <td class="n">${fmt(d.net)}</td>
            <td class="n">${fmt(d.qty)}</td>
            <td class="n">${fmt(d.avgPrice)}</td>
            ${S.matched ? `
              <td class="n">${d.fees === null ? '—' : fmt(d.fees)}</td>
              <td class="n" style="color:${d.margin !== null && d.margin < 0 ? 'var(--clay)' : 'inherit'}">${d.margin === null ? '—' : fmt(d.margin)}</td>
              <td class="n" style="color:${d.feeRatio !== null && d.feeRatio > 0.55 ? 'var(--clay)' : 'inherit'}">${d.feeRatio === null ? '—' : pc(d.feeRatio)}</td>` : ''}
            <td><div class="track" style="height:14px"><div class="fill" style="width:${(d.share / (S.doctors[0].share || 1) * 100).toFixed(1)}%"></div></div>
              <span class="num" style="font-size:11px;color:var(--muted)">${pc(d.share)}</span></td>
          </tr>`).join('')}</tbody>
      </table></div>
      ${S.periodMismatch ? `<div class="notice" style="margin-top:14px">
        <h3>لم تُطابَق الأتعاب بالإيراد — الفترتان مختلفتان</h3>
        <ul>
          <li><span>—</span><div>تقرير بيان الحالة يغطي <b>${esc(S.periodMismatch.statusLabel)}</b> (${fmt(S.periodMismatch.statusDays)} يوم).</div></li>
          <li><span>—</span><div>تقرير الخزينة يغطي <b>${esc(S.periodMismatch.treasuryLabel)}</b> (${fmt(S.periodMismatch.treasuryDays)} يوم).</div></li>
          <li><span>—</span><div>مقارنة أتعاب شهر بإيراد عدة شهور تعطي نسباً مضلِّلة، لذلك أوقفناها. ارفع التقريرين لنفس الفترة لتظهر ربحية كل طبيب.</div></li>
        </ul></div>`
      : S.matched ? '' : `<p class="note" style="margin-top:12px">
        لعرض ربحية كل طبيب، ارفع تقرير حركة الخزينة لنفس الفترة مع هذا الملف — عندها تُطابَق الأتعاب بالإيراد تلقائياً.</p>`}
    </div>

    <div class="grid32">
      <div class="card">
        <div class="chead"><div><h2>الخصومات</h2>
          <div class="note">الفرق بين سعر القائمة والمحصّل فعلاً</div></div>
          <div style="text-align:left">
            <div style="font-size:12px;color:var(--muted)">إجمالي الخصم</div>
            <div class="num" style="font-size:20px;font-weight:600;color:var(--clay)">${fmt(S.disc)}</div>
            <div style="font-size:12px;color:var(--muted)">${pc(S.discRate)} من ${fmt(S.gross)}</div>
          </div></div>
        <div class="tscroll" style="max-height:300px;overflow-y:auto"><table>
          <thead><tr><th>البند</th><th>سعر القائمة</th><th>الخصم</th><th>النسبة</th></tr></thead>
          <tbody>${S.heavyDiscounts.map(x => `<tr>
            <td>${esc(x.service)}<div style="font-size:11px;color:var(--muted)">${esc(x.isDept ? '' : 'د/ ')}${esc(x.doctor)}</div></td>
            <td class="n">${fmt(x.gross)}</td><td class="n">${fmt(x.discount)}</td>
            <td class="n" style="color:var(--clay)">${pc(x.rate)}</td></tr>`).join('')
            || '<tr><td colspan="4" class="note">لا خصومات مؤثرة.</td></tr>'}</tbody>
        </table></div>
      </div>
      <div class="card"><h2>الخصم حسب الفئة</h2>
        <div class="note">أي تخصص يمنح أكبر خصم</div>
        <div id="cDisc"></div></div>
    </div>`;
}

function metricTable(A, E) {
  const k = A.kpi, B = Object.assign({}, (root.SONO_CONFIG || {}).benchmarks || {});
  const rows = [
    ['الهامش الصافي', pc(k.margin), '≥ ' + pc(B.netMarginMin || .25), k.margin >= (B.netMarginMin || .25), 'الصافي ÷ الإيراد'],
    ['المنصرف ÷ الإيراد', pc(k.costRatio), '≤ 70%', k.costRatio <= .70, ''],
    ['أتعاب الأطباء ÷ الإيراد', pc(k.doctorFeeRatio), '≤ ' + pc(B.doctorFeeRatioMax || .35), k.doctorFeeRatio <= (B.doctorFeeRatioMax || .35), ''],
    ['التكاليف الثابتة ÷ الإيراد', pc(k.fixedRatio), '≤ ' + pc(B.fixedCostRatioMax || .45), k.fixedRatio <= (B.fixedCostRatioMax || .45), 'مرتبات + إيجار + مرافق + نظافة'],
    ['تغطية نقطة التعادل', (k.revenue / (k.breakEvenRev || 1)).toFixed(2) + '×', '≥ 1.60×', (k.revenue / (k.breakEvenRev || 1)) >= 1.6, ''],
    ['حصة التحصيل النقدي', pc(k.cashShare), '≤ ' + pc(B.cashShareMax || .60), k.cashShare <= (B.cashShareMax || .60), ''],
    ['حصة أعلى خدمة', pc(k.topServiceShare), '≤ ' + pc(B.topServiceShareMax || .30), k.topServiceShare <= (B.topServiceShareMax || .30), A.services[0] ? A.services[0].key : ''],
    ['حصة أعلى طبيب', pc(k.topDoctorShare), '≤ ' + pc(B.topDoctorShareMax || .25), k.topDoctorShare <= (B.topDoctorShareMax || .25), A.doctors[0] ? 'د/ ' + A.doctors[0].doctor : ''],
    ['نسبة المرضى المتكررين', pc(k.repeatRate), '≥ ' + pc(B.returningRateMin || .30), k.repeatRate >= (B.returningRateMin || .30), ''],
    ['تذبذب الإيراد اليومي', pc(k.cv), '≤ ' + pc(B.revenueCvMax || .45), k.cv <= (B.revenueCvMax || .45), 'معامل الاختلاف'],
    ['المستلزمات ÷ الإيراد', pc(k.suppliesRatio), '≥ ' + pc(B.suppliesRatioMin || .02), k.suppliesRatio >= (B.suppliesRatioMin || .02), 'مؤشر على اكتمال قيد المخزون'],
    ['المصروفات غير المصنّفة', pc(k.unclassifiedRatio), '≤ ' + pc(B.unclassifiedMax || .03), k.unclassifiedRatio <= (B.unclassifiedMax || .03), 'من الإيراد']
  ];
  return rows.map(r => `<tr>
    <td>${esc(r[0])}</td><td class="n">${esc(r[1])}</td><td class="n">${esc(r[2])}</td>
    <td><span class="tag ${r[3] ? 'low' : 'high'}">${r[3] ? 'ضمن المستهدف' : 'خارج المستهدف'}</span></td>
    <td style="color:var(--muted);font-size:12.5px">${esc(r[4])}</td></tr>`).join('');
}

/* ============================================================
   3) المخاطر
   ============================================================ */
function renderRisks(el, A, E) {
  if (!E.risks.length) { el.innerHTML = '<div class="empty"><b>لا توجد مخاطر مرصودة</b>كل المؤشرات ضمن النطاقات المستهدفة.</div>'; return; }
  const byArea = {};
  E.risks.forEach(r => (byArea[r.area] = byArea[r.area] || []).push(r));
  el.innerHTML = `
    <div class="notice">
      <h3>كيف تُقرأ هذه الصفحة</h3>
      <ul>
        <li><span>—</span><div>كل مخاطرة مرفقة بالرقم الذي أطلقها، والمستهدف الذي تقيسه ضده، والأثر المالي التقديري.</div></li>
        <li><span>—</span><div>«الأثر» تقدير لما يمكن استرداده أو حمايته عند معالجة المخاطرة، وليس خسارة مؤكدة.</div></li>
        <li><span>—</span><div>المستهدفات قابلة للتعديل من ملف <code>config.js</code>.</div></li>
      </ul>
    </div>
    ${Object.keys(byArea).map(area => `
      <div class="card" style="padding-bottom:6px">
        <h2>${esc(area)} <span class="tag area">${byArea[area].length}</span></h2>
      </div>
      ${byArea[area].map(r => `
        <div class="risk ${r.sev}">
          <div class="rh">
            <span class="tag ${r.sev}">${esc(r.sevAr)}</span>
            <h3>${esc(r.title)}</h3>
          </div>
          <p>${esc(r.finding)}</p>
          ${r.impactNote ? `<div class="imp">${esc(r.impactNote)}</div>` : ''}
          <div class="mt">
            <span>${esc(r.metric)}: <b>${esc(r.value)}</b></span>
            <span>المستهدف: <b>${esc(r.target)}</b></span>
            ${r.impact > 0 ? `<span>الأثر المالي: <b>${fmt(r.impact)}</b> جنيه</span>` : ''}
            ${r.src ? `<span>المصدر: <b>${esc(r.src)}</b></span>` : ''}
          </div>
        </div>`).join('')}`).join('')}`;
}

/* ============================================================
   4) التوصيات
   ============================================================ */
function renderRecos(el, A, E) {
  if (!E.recos.length) { el.innerHTML = '<div class="empty"><b>لا توصيات</b>الأداء ضمن المستهدفات.</div>'; return; }
  el.innerHTML = E.recos.map(r => `
    <div class="reco">
      <div class="rh">
        <div class="no">${r.n}</div>
        <h3>${esc(r.title)}</h3>
        <span class="tag ${r.sev}">${esc(r.sevAr)}</span>
      </div>
      <ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="lnk">مرتبطة بمخاطرة: ${esc(r.linkedRisk)}${r.impact > 0 ? ` · الأثر التقديري ${fmt(r.impact)} جنيه` : ''}${r.src ? ` · من «${esc(r.src)}»` : ''}</div>
    </div>`).join('');
}

/* ============================================================
   5) خطة العمل
   ============================================================ */
function renderPlan(el, A, E, ctx) {
  const owners = [...new Set(E.plan.map(t => t.own))].sort();
  const areas  = [...new Set(E.plan.map(t => t.area))].sort();
  let fOwner = '', fArea = '', fPrio = '';

  el.innerHTML = `
    <div class="card">
      <div class="chead">
        <div><h2>خطة عمل الشهر القادم</h2>
          <div class="note">${E.plan.length} مهمة مولّدة من المخاطر المرصودة — مرتبة بالأولوية، وكل مهمة لها مسؤول ومدة ومؤشر قياس</div></div>
        <div><span class="prio p1">أولوية 1 = هذا الأسبوع</span> <span class="prio p2">2 = خلال الشهر</span> <span class="prio p3">3 = خلال الربع</span></div>
      </div>

      <div class="frow" style="align-items:flex-end">
        <div class="fld narrow"><label for="plOwner">المسؤول</label>
          <select id="plOwner"><option value="">كل المسؤولين</option>
            ${owners.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select></div>
        <div class="fld narrow"><label for="plArea">المجال</label>
          <select id="plArea"><option value="">كل المجالات</option>
            ${areas.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select></div>
        <div class="fld narrow"><label for="plPrio">الأولوية</label>
          <select id="plPrio"><option value="">الكل</option>
            <option value="1">1 — هذا الأسبوع</option><option value="2">2 — خلال الشهر</option>
            <option value="3">3 — خلال الربع</option></select></div>
        <div class="fld narrow" style="flex:0 0 auto"><label>&nbsp;</label>
          <button class="btn ghost sm" id="plXlsx">تصدير Excel</button></div>
        <div class="fld narrow" style="flex:0 0 auto"><label>&nbsp;</label>
          <button class="btn ghost sm" id="plPdf">تصدير PDF</button></div>
        <div class="fld" style="margin-right:auto;text-align:left">
          <label>&nbsp;</label><span class="who" id="plCount"></span></div>
      </div>

      <div id="plWrap"></div>
    </div>`;

  const wrap = document.getElementById('plWrap');

  function filtered() {
    return E.plan.filter(t =>
      (!fOwner || t.own === fOwner) &&
      (!fArea  || t.area === fArea) &&
      (!fPrio  || String(t.pr) === fPrio));
  }

  function paint() {
    const done = JSON.parse(localStorage.getItem('sono_done') || '{}');
    const rows = filtered();
    document.getElementById('plCount').textContent =
      `${rows.length} من ${E.plan.length} مهمة` +
      (fOwner ? ` · ${rows.filter(t => done[t.t]).length} منجزة` : '');
    wrap.innerHTML = `<div class="tscroll"><table class="plan">
      <thead><tr>
        <th style="width:34px">✓</th><th style="width:34px">#</th><th>المهمة</th>
        <th>المسؤول</th><th>التوقيت</th><th>مؤشر القياس</th><th>المستهدف</th><th>الأولوية</th>
      </tr></thead>
      <tbody>${rows.map(t => `
        <tr data-k="${esc(t.t)}" class="${done[t.t] ? 'done' : ''}">
          <td><input type="checkbox" class="chk" ${done[t.t] ? 'checked' : ''}></td>
          <td class="n">${t.n}</td>
          <td><b>${esc(t.t)}</b><div style="font-size:11.5px;color:var(--muted);margin-top:2px">${esc(t.area)}</div>
            ${(t.why || (t.steps && t.steps.length)) ? `<button type="button" class="tbtn noprint">التفاصيل وخطوات التنفيذ ▾</button>` : ''}</td>
          <td>${esc(t.own)}</td>
          <td class="pr">أسبوع ${esc(t.wk)}</td>
          <td>${esc(t.kpi)}</td>
          <td class="n">${esc(t.tgt)}</td>
          <td><span class="prio p${t.pr}">${t.pr}</span></td>
        </tr>
        <tr class="tdrow hide"><td></td><td colspan="7">
          <div class="tdet">
            ${t.risk ? `<b>سبب هذه المهمة</b><div>${esc(t.risk)}</div>` : ''}
            ${t.why ? `<b>ما الذي رصدناه</b><div>${esc(t.why)}</div>` : ''}
            ${t.steps && t.steps.length ? `<b>خطوات التنفيذ المقترحة</b>
              <ol>${t.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
            <b>كيف تعرف أنك نجحت</b>
            <div>${esc(t.kpi)} — المستهدف <b style="display:inline">${esc(t.tgt)}</b>${t.metric ? ` · القيمة الحالية ${esc(t.value)}` : ''}</div>
            ${t.impact > 0 ? `<b>الأثر المالي التقديري</b><div>${fmt(t.impact)} جنيه</div>` : ''}
          </div>
        </td></tr>`).join('') || '<tr><td colspan="8" class="note">لا مهام بهذا الفلتر.</td></tr>'}</tbody>
    </table></div>`;

    wrap.querySelectorAll('.tbtn').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const det = b.closest('tr').nextElementSibling;
      if (!det) return;
      const open = !det.classList.contains('hide');
      det.classList.toggle('hide', open);
      b.textContent = open ? 'التفاصيل وخطوات التنفيذ ▾' : 'إخفاء التفاصيل ▴';
    });
    wrap.querySelectorAll('.chk').forEach(c => c.addEventListener('change', e => {
      const tr = e.target.closest('tr'), k = tr.dataset.k;
      const d = JSON.parse(localStorage.getItem('sono_done') || '{}');
      if (e.target.checked) d[k] = 1; else delete d[k];
      localStorage.setItem('sono_done', JSON.stringify(d));
      tr.classList.toggle('done', e.target.checked);
      paint();
    }));
  }

  document.getElementById('plOwner').onchange = e => { fOwner = e.target.value; paint(); };
  document.getElementById('plArea').onchange  = e => { fArea  = e.target.value; paint(); };
  document.getElementById('plPrio').onchange  = e => { fPrio  = e.target.value; paint(); };

  document.getElementById('plXlsx').onclick = () => {
    try {
      root.SonoExport.planXlsx(filtered(),
        { clinic: (ctx && ctx.clinic) || '', branch: (ctx && ctx.branch) || '', range: A.meta.rangeLabel },
        fOwner);
    } catch (e) { alert('تعذّر التصدير: ' + (e.message || e)); }
  };
  document.getElementById('plPdf').onclick = async () => {
    try {
      await root.SonoExport.toPdfFromNodes([wrap], {
        clinic: (ctx && ctx.clinic) || '', branch: (ctx && ctx.branch) || '',
        range: A.meta.rangeLabel,
        section: 'خطة العمل' + (fOwner ? ' — ' + fOwner : ''),
        fileName: `خطة-العمل${fOwner ? '-' + fOwner : ''}.pdf`.replace(/[\/\\:*?"<>|]/g, '-')
      });
    } catch (e) { alert('تعذّر إنشاء PDF: ' + (e.message || e)); }
  };

  paint();
}

/* ============================================================
   6) البيانات التفصيلية
   ============================================================ */
function renderData(el, A, E, raw) {
  el.innerHTML = `
    <div class="card">
      <h2>الحركة اليومية</h2>
      <div class="note">${A.daily.length} يوماً في الفترة المختارة</div>
      <div class="tscroll" style="max-height:420px;overflow-y:auto"><table>
        <thead><tr><th>التاريخ</th><th>اليوم</th><th>الوارد</th><th>المنصرف</th><th>الصافي</th><th>إيصالات</th><th>مرضى</th></tr></thead>
        <tbody>${A.daily.map(d => `<tr>
          <td class="n">${esc(d.date)}</td><td>${esc(d.dow)}</td>
          <td class="n">${fmt(d.rev)}</td><td class="n">${fmt(d.exp)}</td>
          <td class="n" style="color:${d.net >= 0 ? 'var(--moss)' : 'var(--clay)'}">${fmt(d.net)}</td>
          <td class="n">${d.rcpt}</td><td class="n">${d.pat}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="grid2">
      <div class="card"><h2>كل الخدمات</h2>
        <div class="note">${A.services.length} خدمة · الإيراد موزّع على بنود الإيصال</div>
        <div class="tscroll" style="max-height:380px;overflow-y:auto"><table>
          <thead><tr><th>الخدمة</th><th>الفئة</th><th>مرات</th><th>الإيراد</th></tr></thead>
          <tbody>${A.services.map(s => `<tr><td>${esc(s.key)}</td><td style="color:var(--muted);font-size:12px">${esc(s.cat)}</td>
            <td class="n">${s.count}</td><td class="n">${fmt(s.total)}</td></tr>`).join('')}</tbody>
        </table></div></div>

      <div class="card"><h2>بنود المصروف</h2>
        <div class="note">مصنّفة آلياً من حقل «البيان»</div>
        <div class="tscroll" style="max-height:380px;overflow-y:auto"><table>
          <thead><tr><th>البند</th><th>الطبيعة</th><th>حركات</th><th>المبلغ</th><th>% من المنصرف</th></tr></thead>
          <tbody>${A.expCats.map(c => `<tr><td>${esc(c.cat)}</td><td style="color:var(--muted);font-size:12px">${esc(c.group)}</td>
            <td class="n">${c.count}</td><td class="n">${fmt(c.total)}</td><td class="n">${pc(c.pct)}</td></tr>`).join('')}</tbody>
        </table></div></div>
    </div>

    ${A.archived && A.unclassifiedSummary && A.unclassifiedSummary.count ? `
    <div class="notice">
      <h3>حركات تحتاج تصنيف محاسبي</h3>
      <ul><li><span>—</span><div>${fmt(A.unclassifiedSummary.count)} حركة بإجمالي ${eg(A.unclassifiedSummary.total)}.
        تفاصيل هذه الحركات لا تُحفظ في الأرشيف لأن حقل البيان قد يحتوي أسماء أشخاص —
        ارفع ملف الفترة من جديد لعرضها.</div></li></ul>
    </div>` : ''}

    ${A.unclassifiedRows.length ? `
    <div class="card">
      <h2>حركات تحتاج تصنيف محاسبي</h2>
      <div class="note">${A.unclassifiedRows.length} حركة بإجمالي ${eg(A.unclassifiedRows.reduce((s, r) => s + r.amount, 0))} — راجعها قبل إقفال الشهر</div>
      <div class="tscroll" style="max-height:320px;overflow-y:auto"><table>
        <thead><tr><th>التاريخ</th><th>البيان</th><th>الملاحظات</th><th>المبلغ</th></tr></thead>
        <tbody>${A.unclassifiedRows.map(r => `<tr><td class="n">${esc(r.date)}</td><td>${esc(r.bayan)}</td>
          <td style="color:var(--muted);font-size:12px">${esc(r.note || '—')}</td><td class="n">${fmt(r.amount)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>` : ''}

    <div class="card">
      <h2>أعلى 15 مريضاً بالإيراد</h2>
      <div class="note">${A.archived
        ? 'أسماء المرضى لا تُحفظ في الأرشيف إطلاقاً — ارفع ملف الفترة لعرضها.'
        : 'تُعرض الأسماء للمراجعة الإدارية فقط — لا تُصدَّر في تقرير PDF العام'}</div>
      <div class="tscroll"><table>
        <thead><tr><th>المريض</th><th>رقم الملف</th><th>الزيارات</th><th>الإيراد</th></tr></thead>
        <tbody>${A.topPatients.map(p => `<tr><td>${esc(p.name)}</td><td class="n">${esc(p.file)}</td>
          <td class="n">${p.visits}</td><td class="n">${fmt(p.total)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>`;
}

/* ============================================================
   7) التحليل الذكي
   ============================================================ */
const AI_SUGG = [
  'ليه الإيراد اتحرك كده الفترة دي؟',
  'أنهي خدمة أرفع لسعرها وأنهي أسيبها؟',
  'لو عايز أزوّد الصافي 20% أعمل إيه بالترتيب؟',
  'إيه المصروف اللي أقدر أقصّه من غير ما يأثر على الخدمة؟',
  'إزاي أرجّع المرضى اللي جم مرة واحدة بس؟'
];

function renderAiTab(el, state) {
  const canUse = root.SonoRoles.can(root.SonoAuth.user(), 'useAi');
  const hasKey = root.SonoSettings.hasKey();
  const isSuper = root.SonoRoles.isSuper(root.SonoAuth.user());

  if (!canUse || !hasKey) {
    el.innerHTML = `<div class="empty">
      <b>التحليل الذكي غير مفعّل</b>
      ${!hasKey
        ? (isSuper
            ? 'أضف مفتاح النموذج من <b>⚙ لوحة التحكم ← إعدادات الذكاء الاصطناعي</b>.'
            : 'لم يُضِف السوبر أدمن مفتاح النموذج بعد.')
        : 'السوبر أدمن لم يفعّل هذه الميزة لباقي المستخدمين.'}
      <p style="margin-top:14px;font-size:13px;max-width:560px;margin-inline:auto;line-height:1.9">
        باقي اللوحة يعمل بالكامل بدونه — المخاطر والتوصيات وخطة العمل كلها من محرك القواعد
        المدمج، بلا تكلفة وبلا إنترنت.</p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="aibox">
      <div class="chead">
        <div><h2>القراءة التنفيذية</h2>
          <div class="note">تحليل مكتوب من النموذج فوق محرك القواعد — يضيف ما لم ترصده القواعد.
            تُرسل أرقام مجمّعة فقط، بلا أسماء مرضى.</div></div>
        <button class="btn sm" id="aiGen" style="width:auto">توليد القراءة</button>
      </div>
      <div id="aiOut"><p class="note">اضغط «توليد القراءة» للبدء. الاستدعاء يستغرق ١٠–٣٠ ثانية.</p></div>
    </div>

    <div class="aibox">
      <h2>اسأل عن أرقامك</h2>
      <div class="note">أسئلة بالعامية عن الفترة المعروضة حالياً</div>
      <div class="sugg" id="aiSugg">${AI_SUGG.map(q => `<button type="button">${esc(q)}</button>`).join('')}</div>
      <div class="chat" id="aiChat"></div>
      <div class="askrow">
        <textarea id="aiQ" rows="1" placeholder="اكتب سؤالك… (Enter للإرسال)"></textarea>
        <button class="btn sm" id="aiSend" style="width:auto">إرسال</button>
      </div>
    </div>`;

  const out = document.getElementById('aiOut');
  const chat = document.getElementById('aiChat');
  const hist = [];

  document.getElementById('aiGen').onclick = async function () {
    this.disabled = true;
    out.innerHTML = '<p class="note">جارٍ التحليل… قد يستغرق نصف دقيقة.</p>';
    try {
      const t = await root.SonoAI.narrative(state.A, state.E, state.cmp, state.ctx);
      out.innerHTML = `<div class="aimd">${root.SonoAI.md(t)}</div>`;
    } catch (e) {
      out.innerHTML = `<div class="err">${esc(e.message)}</div>`;
    } finally { this.disabled = false; }
  };

  async function send(q) {
    q = String(q || '').trim();
    if (!q) return;
    document.getElementById('aiQ').value = '';
    chat.insertAdjacentHTML('beforeend', `<div class="msg me">${esc(q)}</div>`);
    const ph = document.createElement('div');
    ph.className = 'msg ai'; ph.innerHTML = '<span class="note">جارٍ التفكير…</span>';
    chat.appendChild(ph); chat.scrollTop = chat.scrollHeight;
    try {
      const t = await root.SonoAI.ask(q, state.A, state.E, state.cmp, state.ctx, hist);
      ph.innerHTML = `<div class="aimd">${root.SonoAI.md(t)}</div>`;
      hist.push({ role: 'user', content: q }, { role: 'assistant', content: t });
    } catch (e) {
      ph.innerHTML = `<div class="err" style="margin:0">${esc(e.message)}</div>`;
    }
    chat.scrollTop = chat.scrollHeight;
  }

  document.getElementById('aiSend').onclick = () => send(document.getElementById('aiQ').value);
  document.getElementById('aiQ').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e.target.value); }
  });
  document.getElementById('aiSugg').querySelectorAll('button')
    .forEach(b => b.onclick = () => send(b.textContent));
}

/* ============================================================
   8) عرض تقرير المقارنة
   ============================================================ */
function renderComparison(el, C, title, onSave) {
  const money = (m, v) => m.money ? fmt(v) : m.rate ? pc(v) : fmt(v);
  const chg = m => m.change === null ? '—'
    : `<span class="${m.change * m.good >= 0 ? 'dl-up' : 'dl-dn'}">${m.change >= 0 ? '▲' : '▼'} ${Math.abs(m.change * 100).toFixed(1)}%</span>`;
  const vTag = v => `<span class="tag ${v === 'تحسّن' ? 'low' : v === 'تراجع' ? 'high' : 'medium'}">${esc(v)}</span>`;

  el.innerHTML = `
    <div class="card" style="border-top:3px solid var(--petrol)">
      <div class="chead">
        <div><h2>${esc(title || 'تقرير مقارنة')}</h2>
          <div class="note">مقارنة ${fmt(C.n)} فترات · التحليل مبني على التقارير المحفوظة كما هي</div></div>
        <div style="text-align:left">
          <div style="font-size:12px;color:var(--muted)">مؤشر الصحة</div>
          <div class="num" style="font-size:20px;font-weight:600">${C.scores.join(' ← ')}</div>
        </div>
      </div>
      ${onSave ? `<div class="frow noprint" style="margin-bottom:14px">
        <div class="fld"><label for="cmpTitle">اسم تقرير المقارنة</label>
          <input type="text" id="cmpTitle" placeholder="${esc(title || '')}"></div>
        <div class="fld narrow" style="flex:0 0 auto"><label>&nbsp;</label>
          <button class="btn sm" id="cmpSave">حفظ في الأرشيف</button></div>
      </div><div id="cmpMsg" class="noprint"></div>` : ''}
      <div class="tscroll"><table>
        <thead><tr><th>الفترة</th><th>المدى</th><th>أيام</th><th>الإيراد</th><th>المنصرف</th>
          <th>الصافي</th><th>الهامش</th><th>المرضى</th><th>المؤشر</th><th>المخاطر</th></tr></thead>
        <tbody>${C.periods.map(p => `<tr>
          <td><b>${esc(p.label)}</b></td>
          <td style="font-size:12px;color:var(--muted)">${esc(p.range)}</td>
          <td class="n">${fmt(p.days)}</td>
          <td class="n">${fmt(p.revenue)}</td>
          <td class="n">${fmt(p.cost)}</td>
          <td class="n" style="color:${p.net >= 0 ? 'var(--moss)' : 'var(--clay)'}">${fmt(p.net)}</td>
          <td class="n">${pc(p.margin)}</td>
          <td class="n">${fmt(p.patients)}</td>
          <td class="n">${p.score}</td>
          <td class="n">${p.riskCount}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>

    ${C.summary.map(s => `
      <div class="card"><h2>${esc(s.h)}</h2>
        <p style="font-size:14.5px;line-height:1.95;margin-top:8px">${esc(s.p)}</p></div>`).join('')}

    <div class="card">
      <h2>حركة المؤشرات</h2>
      <div class="note">القيم بترتيب الفترات من الأقدم للأحدث</div>
      <div class="tscroll"><table>
        <thead><tr><th>المؤشر</th>${C.periods.map(p => `<th>${esc(p.label)}</th>`).join('')}
          <th>الفرق</th><th>التغيّر</th><th>الاتجاه</th><th>الحكم</th></tr></thead>
        <tbody>${C.metrics.map(m => `<tr>
          <td>${esc(m.name)}</td>
          ${m.values.map(v => `<td class="n">${money(m, v)}</td>`).join('')}
          <td class="n">${m.money ? fmt(m.diff) : m.rate ? (m.diff * 100).toFixed(1) + ' نقطة' : fmt(m.diff)}</td>
          <td class="n">${chg(m)}</td>
          <td>${esc(m.direction)}</td>
          <td>${vTag(m.verdict)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="grid2">
      <div class="card"><h2>الخدمات الأكثر نمواً</h2>
        <div class="note">فرق الإيراد بين أول وآخر فترة</div>
        <div class="tscroll" style="max-height:340px;overflow-y:auto"><table>
          <thead><tr><th>الخدمة</th><th>الأولى</th><th>الأخيرة</th><th>الفرق</th></tr></thead>
          <tbody>${C.gainers.filter(s => s.diff > 0).map(s => `<tr>
            <td>${esc(s.name)}</td><td class="n">${fmt(s.first)}</td><td class="n">${fmt(s.last)}</td>
            <td class="n" style="color:var(--moss)">+${fmt(s.diff)}</td></tr>`).join('')
            || '<tr><td colspan="4" class="note">لا نمو.</td></tr>'}</tbody>
        </table></div></div>

      <div class="card"><h2>الخدمات الأكثر تراجعاً</h2>
        <div class="note">تحتاج تفسيراً: توقف طبيب؟ تغيّر سعر؟ منافسة؟</div>
        <div class="tscroll" style="max-height:340px;overflow-y:auto"><table>
          <thead><tr><th>الخدمة</th><th>الأولى</th><th>الأخيرة</th><th>الفرق</th></tr></thead>
          <tbody>${C.losers.filter(s => s.diff < 0).map(s => `<tr>
            <td>${esc(s.name)}</td><td class="n">${fmt(s.first)}</td><td class="n">${fmt(s.last)}</td>
            <td class="n" style="color:var(--clay)">${fmt(s.diff)}</td></tr>`).join('')
            || '<tr><td colspan="4" class="note">لا تراجع.</td></tr>'}</tbody>
        </table></div></div>
    </div>

    <div class="card">
      <h2>حركة بنود المصروف</h2>
      <div class="tscroll"><table>
        <thead><tr><th>البند</th>${C.periods.map(p => `<th>${esc(p.label)}</th>`).join('')}
          <th>الفرق</th><th>التغيّر</th></tr></thead>
        <tbody>${C.expenses.map(e => `<tr>
          <td>${esc(e.name)}</td>
          ${e.vals.map(v => `<td class="n">${fmt(v)}</td>`).join('')}
          <td class="n" style="color:${e.diff > 0 ? 'var(--clay)' : 'var(--moss)'}">${e.diff >= 0 ? '+' : ''}${fmt(e.diff)}</td>
          <td class="n">${e.change === null ? '—' : (e.change >= 0 ? '+' : '') + pc(e.change)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="card">
      <h2>المخاطر عبر الفترات</h2>
      <div class="note">المستمرة تعني أن المعالجة لم تُنفَّذ · الجديدة تحتاج قراراً الآن</div>
      <div class="tscroll"><table>
        <thead><tr><th>المخاطرة</th><th>المجال</th><th>الخطورة</th>
          ${C.periods.map(p => `<th>${esc(p.label)}</th>`).join('')}<th>الحالة</th></tr></thead>
        <tbody>${C.risks.map(r => `<tr>
          <td>${esc(r.title)}</td><td style="font-size:12px;color:var(--muted)">${esc(r.area)}</td>
          <td><span class="tag ${r.sev === 'مرتفعة' ? 'high' : r.sev === 'حرجة' ? 'critical' : r.sev === 'متوسطة' ? 'medium' : 'low'}">${esc(r.sev)}</span></td>
          ${r.in.map(v => `<td style="text-align:center">${v ? '●' : '—'}</td>`).join('')}
          <td>${r.persistent ? '<span class="tag high">مستمرة</span>'
              : r.emerged ? '<span class="tag medium">جديدة</span>'
              : r.resolved ? '<span class="tag low">عولجت</span>' : '—'}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="card">
      <h2>حركة أتعاب الأطباء</h2>
      <div class="tscroll" style="max-height:400px;overflow-y:auto"><table>
        <thead><tr><th>الطبيب</th>${C.periods.map(p => `<th>${esc(p.label)}</th>`).join('')}
          <th>الفرق</th><th>ظهر في</th></tr></thead>
        <tbody>${C.doctors.map(d => `<tr>
          <td>د/ ${esc(d.name)}</td>
          ${d.vals.map(v => `<td class="n">${v ? fmt(v) : '—'}</td>`).join('')}
          <td class="n">${d.diff >= 0 ? '+' : ''}${fmt(d.diff)}</td>
          <td class="n">${d.periods}/${C.n}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>`;

  const sv = document.getElementById('cmpSave');
  if (sv && onSave) sv.onclick = async () => {
    sv.disabled = true; sv.textContent = 'جارٍ الحفظ…';
    const msg = document.getElementById('cmpMsg');
    try {
      await onSave(document.getElementById('cmpTitle').value);
      msg.innerHTML = '<div class="ok">تم حفظ تقرير المقارنة في الأرشيف.</div>';
    } catch (e) { msg.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    finally { sv.disabled = false; sv.textContent = 'حفظ في الأرشيف'; }
  };
}

/* ============================================================
   9) الأرشيف
   ============================================================ */
async function renderArchive(el, state, handlers) {
  const AR = root.SonoArchive, AU = root.SonoAuth, RO = root.SonoRoles;
  const canSave = state.A && RO.can(AU.user(), 'upload');
  const local = AU.mode() !== 'supabase';

  el.innerHTML = `
    <div class="card">
      <div class="chead">
        <div><h2>حفظ التقرير الحالي</h2>
          <div class="note">${local
            ? 'الأرشيف يحتاج تفعيل Supabase ليُحفظ مشتركاً بين كل المستخدمين والأجهزة.'
            : 'يُحفظ التحليل المجمّع كاملاً — المؤشرات والمخاطر والتوصيات وخطة العمل. لا تُحفظ أسماء المرضى إطلاقاً.'}</div></div>
      </div>
      ${canSave && !local ? `
        <div class="frow">
          <div class="fld"><label for="arTitle">اسم التقرير</label>
            <input type="text" id="arTitle" placeholder="${esc(state.A.meta.rangeLabel || 'تقرير الفترة')}"></div>
          <div class="fld narrow" style="flex:0 0 auto"><label>&nbsp;</label>
            <button class="btn sm" id="arSave">حفظ في الأرشيف</button></div>
        </div>
        <div id="arMsg"></div>`
        : `<p class="note">${local ? 'فعّل Supabase أولاً.'
            : state.A ? 'دورك الحالي لا يسمح بحفظ التقارير.' : 'ارفع ملفاً أولاً ليصبح هناك تقرير للحفظ.'}</p>`}
    </div>

    <div class="card">
      <div class="chead">
        <div><h2>التقارير المحفوظة</h2>
          <div class="note">اضغط أي تقرير لعرضه بالكامل في اللوحة</div></div>
        <button class="btn ghost sm" id="arRefresh">تحديث</button>
      </div>
      <div id="arList"><p class="note">جارٍ التحميل…</p></div>
    </div>`;

  const listEl = document.getElementById('arList');

  async function fill() {
    if (local) { listEl.innerHTML = '<p class="note">غير متاح في الوضع المحلي.</p>'; return; }
    listEl.innerHTML = '<p class="note">جارٍ التحميل…</p>';
    let rows;
    try { rows = await AR.list(); }
    catch (e) { listEl.innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
    if (!rows.length) { listEl.innerHTML = '<p class="note">لا توجد تقارير محفوظة بعد.</p>'; return; }

    const isCmp = r => /مقارنة/.test(r.title || '');
    listEl.innerHTML = `
      <div class="frow" style="margin-bottom:12px;align-items:center">
        <button class="btn sm" id="arCompare" disabled>مقارنة المحدَّد</button>
        <span class="who" id="arSel">اختر تقريرين أو أكثر للمقارنة</span>
      </div>
      <div class="tscroll"><table>
      <thead><tr><th style="width:34px"></th><th>التقرير</th><th>الفترة</th><th>الإيراد</th><th>الصافي</th>
        <th>المؤشر</th><th>المخاطر</th><th>حفظه</th><th></th></tr></thead>
      <tbody>${rows.map(r => `<tr data-id="${esc(r.id)}">
        <td>${isCmp(r) ? '' : `<input type="checkbox" class="chk arPick">`}</td>
        <td><b>${esc(r.title)}</b>${isCmp(r) ? ' <span class="badge pend">مقارنة</span>' : ''}
          <div style="font-size:11px;color:var(--muted)">${(r.files || []).map(esc).join(' · ') || '—'}</div></td>
        <td class="n" style="font-size:12px">${esc(r.period_from || '—')} ${r.period_to ? '→ ' + esc(r.period_to) : ''}</td>
        <td class="n">${fmt(r.revenue)}</td>
        <td class="n" style="color:${r.net >= 0 ? 'var(--moss)' : 'var(--clay)'}">${fmt(r.net)}</td>
        <td class="n">${r.score}</td>
        <td class="n">${r.risk_count}</td>
        <td style="font-size:12px">${esc(r.created_name || '—')}
          <div style="font-size:11px;color:var(--muted)">${new Date(r.created_at).toLocaleDateString('ar-EG')}</div></td>
        <td style="white-space:nowrap">
          <button class="btn ghost sm arOpen">عرض</button>
          <button class="btn ghost sm arDel">حذف</button></td>
      </tr>`).join('')}</tbody></table></div>`;

    const cmpBtn = document.getElementById('arCompare');
    const selLbl = document.getElementById('arSel');
    const picked = () => [...listEl.querySelectorAll('.arPick:checked')]
      .map(c => c.closest('tr').dataset.id);

    listEl.querySelectorAll('.arPick').forEach(c => c.onchange = () => {
      const p = picked();
      cmpBtn.disabled = p.length < 2;
      selLbl.textContent = p.length ? `${p.length} تقرير محدَّد` : 'اختر تقريرين أو أكثر للمقارنة';
    });

    cmpBtn.onclick = async () => {
      cmpBtn.disabled = true; cmpBtn.textContent = 'جارٍ التحليل…';
      try { await handlers.compare(picked()); }
      catch (e) { listEl.insertAdjacentHTML('afterbegin', `<div class="err">${esc(e.message)}</div>`); }
      finally { cmpBtn.disabled = false; cmpBtn.textContent = 'مقارنة المحدَّد'; }
    };

    listEl.querySelectorAll('tr[data-id]').forEach(tr => {
      const id = tr.dataset.id;
      const op = tr.querySelector('.arOpen');
      if (op) op.onclick = () => handlers.open(id);
      const dl = tr.querySelector('.arDel');
      if (dl) dl.onclick = async () => {
        if (!confirm('حذف هذا التقرير من الأرشيف نهائياً؟')) return;
        try { await AR.remove(id); await fill(); }
        catch (e) { listEl.insertAdjacentHTML('afterbegin', `<div class="err">${esc(e.message)}</div>`); }
      };
    });
  }

  const sv = document.getElementById('arSave');
  if (sv) sv.onclick = async () => {
    sv.disabled = true; sv.textContent = 'جارٍ الحفظ…';
    const msg = document.getElementById('arMsg');
    try {
      await handlers.save(document.getElementById('arTitle').value);
      msg.innerHTML = '<div class="ok">تم حفظ التقرير في الأرشيف.</div>';
      document.getElementById('arTitle').value = '';
      await fill();
    } catch (e) { msg.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    finally { sv.disabled = false; sv.textContent = 'حفظ في الأرشيف'; }
  };
  document.getElementById('arRefresh').onclick = fill;
  await fill();
}

root.SonoRender = { insHtml, insDraw, renderSummary, renderKpi, renderRisks, renderRecos, renderPlan, renderData,
                    renderAiTab, renderArchive, renderComparison, drawRibbon };
})(window);
