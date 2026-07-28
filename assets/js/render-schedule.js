/* ============================================================
   render-schedule.js — تاب «جدول العيادات»
   أربع لوحات: بورد الأسبوع · دليل الأطباء · التغطية ·
   المخطط مقابل الفعلي — مع بحث شامل وفلاتر وتصدير.
   ============================================================ */
(function (root) {
'use strict';
const C  = root.SonoCharts;
const SC = () => root.SonoSchedule;
const esc = C.esc, fmt = C.fmt;
const pc = v => (isFinite(v) ? (v * 100).toFixed(1) : '0.0') + '%';
const eg = v => fmt(v) + ' جنيه';

/* حالة العرض */
const ST = { view: 'week', q: '', spec: '', day: '', grade: '', price: '', sort: 'spec' };
let CUR = null, CTX = null, EL = null;

const DAYS = () => SC().DAYS;
const todayName = () => ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][new Date().getDay()];

/* ============================================================
   البحث الشامل: اسم · تخصص · درجة · خدمة · هاتف · يوم
   ============================================================ */
function hay(d) {
  return [d.name, d.spec, d.specs.join(' '), d.grade, d.detail,
          d.subs.join(' '), d.services.join(' '), d.phone, d.phones.join(' '),
          d.dayNames.join(' '), d.aliases.join(' '), String(d.price)]
         .join(' ').toLowerCase();
}
function match(d) {
  if (ST.spec  && d.specs.indexOf(ST.spec) < 0) return false;
  if (ST.day   && d.dayNames.indexOf(ST.day) < 0) return false;
  if (ST.grade && d.grade !== ST.grade) return false;
  if (ST.price === 'lo' && !(d.price > 0 && d.price <= 500)) return false;
  if (ST.price === 'mid' && !(d.price > 500 && d.price <= 800)) return false;
  if (ST.price === 'hi' && !(d.price > 800)) return false;
  if (ST.price === 'none' && d.price > 0) return false;
  const q = SC().key(ST.q.trim());
  if (!q) return true;
  return SC().key(hay(d)).indexOf(q) >= 0;
}
function filtered() {
  const list = CUR.doctors.filter(match);
  const S = {
    spec : (a, b) => a.spec.localeCompare(b.spec, 'ar') || a.name.localeCompare(b.name, 'ar'),
    name : (a, b) => a.name.localeCompare(b.name, 'ar'),
    price: (a, b) => b.price - a.price,
    days : (a, b) => b.dayNames.length - a.dayNames.length,
    hours: (a, b) => b.weeklyMin - a.weeklyMin
  };
  return list.sort(S[ST.sort] || S.spec);
}

/* ============================================================
   الهيكل
   ============================================================ */
function render(el, sch, ctx) {
  EL = el; CUR = sch; CTX = ctx || {};
  if (!sch || !sch.doctors.length) {
    el.innerHTML = '<div class="empty"><b>لا يوجد جدول عيادات</b>' +
      'ارفع ملف «جدول العيادات» (إكسل فيه ورقة التخصصات أو جدول الأيام) ليظهر هنا.</div>';
    return;
  }
  el.innerHTML = `
    <div class="card schTop">
      <div class="chead">
        <div>
          <h2>جدول عيادات المركز</h2>
          <div class="note">${fmt(sch.stats.doctors)} طبيب · ${fmt(sch.stats.specialties)} تخصص ·
            ${fmt(sch.stats.slots)} خانة عيادة · ${fmt(sch.stats.weeklyHours)} ساعة أسبوعياً
            ${sch.savedLabel ? ' · ' + esc(sch.savedLabel) : ''}</div>
        </div>
        <div class="schActions">
          ${CTX.canSave ? '<button class="btn ghost" id="schSave">حفظ كمرجع دائم</button>' : ''}
          <button class="btn ghost" id="schXlsx">تصدير إكسل</button>
          <button class="btn ghost" id="schPdf">تصدير PDF</button>
        </div>
      </div>
      <div class="seg schNav" role="group">
        ${[['week', 'بورد الأسبوع'], ['dir', 'دليل الأطباء'], ['cov', 'التغطية'], ['vs', 'المخطط مقابل الفعلي']]
          .map(([k, n]) => `<button class="btn ghost" data-v="${k}" aria-pressed="${ST.view === k}">${n}</button>`).join('')}
      </div>
      <div id="schMsg"></div>
    </div>
    <div id="schBody"></div>`;

  el.querySelectorAll('.schNav button').forEach(b => b.onclick = () => {
    ST.view = b.dataset.v;
    el.querySelectorAll('.schNav button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === ST.view));
    body();
  });
  const sv = document.getElementById('schSave');
  if (sv) sv.onclick = async () => {
    sv.disabled = true; sv.textContent = 'جارٍ الحفظ…';
    try { await CTX.onSave(); msg('<div class="ok">تم حفظ الجدول كمرجع دائم — هيفضل موجود مهما رفعت تقارير تانية.</div>'); }
    catch (e) { msg(`<div class="err">${esc(e.message || e)}</div>`); }
    finally { sv.disabled = false; sv.textContent = 'حفظ كمرجع دائم'; }
  };
  document.getElementById('schXlsx').onclick = () => { try { toXlsx(); } catch (e) { msg(`<div class="err">${esc(e.message)}</div>`); } };
  document.getElementById('schPdf').onclick  = () => CTX.onPdf && CTX.onPdf();
  body();
}
function msg(h) { const m = document.getElementById('schMsg'); if (m) m.innerHTML = h; }

function body() {
  const b = document.getElementById('schBody');
  if (!b) return;
  b.innerHTML = ({ week: weekHtml, dir: dirHtml, cov: covHtml, vs: vsHtml })[ST.view]();
  ({ week: weekBind, dir: dirBind, cov: covBind, vs: vsBind })[ST.view](b);
}

/* ============================================================
   ١) بورد الأسبوع
   ============================================================ */
function weekHtml() {
  const today = todayName();
  const per = {};
  CUR.perDay.forEach(p => per[p.day] = p);
  return `
    <div class="card">
      <div class="chead">
        <div><h2>بورد الأسبوع</h2>
          <div class="note">كل يوم وأطباؤه ومواعيدهم وأسعارهم وتليفوناتهم — اليوم الحالي مُميَّز</div></div>
        <div class="seg" role="group">
          <button class="btn ghost" id="schToday">أطباء النهاردة (${esc(today)})</button>
          <button class="btn ghost" id="schAll" aria-pressed="true">كل الأسبوع</button>
        </div>
      </div>
      <div class="schWeek">
        ${DAYS().map(d => {
          const p = per[d] || { docs: [], specs: [] };
          const docs = p.docs.slice().sort((a, b) => {
            const sa = a.days.find(x => x.day === d), sb = b.days.find(x => x.day === d);
            return (sa && sa.from ? sa.from : 9999) - (sb && sb.from ? sb.from : 9999);
          });
          return `
          <div class="schDay${d === today ? ' isToday' : ''}" data-day="${esc(d)}">
            <div class="schDayHead">
              <b>${esc(d)}</b>
              <span>${fmt(docs.length)} طبيب · ${fmt(p.specs.length)} تخصص</span>
            </div>
            ${docs.length ? docs.map(x => {
              const s = x.days.find(y => y.day === d) || {};
              return `<div class="schSlot">
                <div class="sn">${esc(x.name)}</div>
                <div class="ss">${esc(x.spec)}${x.grade !== 'غير محدّد' ? ' · ' + esc(x.grade) : ''}</div>
                <div class="st">${esc(s.label || '—')}</div>
                <div class="sp">${x.price ? esc(fmt(x.price)) + ' ج' : '—'}${x.phone ? ` · <a href="tel:${esc(x.phone)}">${esc(x.phone)}</a>` : ''}</div>
              </div>`;
            }).join('') : '<div class="schEmpty">لا توجد عيادات</div>'}
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="grid2">
      <div class="card"><h2>عدد الأطباء لكل يوم</h2>
        <div class="note">يكشف الأيام الضعيفة التغطية</div><div id="schCd"></div></div>
      <div class="card"><h2>عدد التخصصات المتاحة لكل يوم</h2>
        <div class="note">كل تخصص ناقص في يوم = مريض بيتحوّل لمركز تاني</div><div id="schCs"></div></div>
    </div>`;
}
function weekBind(b) {
  const t = document.getElementById('schToday'), a = document.getElementById('schAll');
  const today = todayName();
  t.onclick = () => {
    t.setAttribute('aria-pressed', 'true'); a.setAttribute('aria-pressed', 'false');
    b.querySelectorAll('.schDay').forEach(el => el.classList.toggle('hide', el.dataset.day !== today));
  };
  a.onclick = () => {
    a.setAttribute('aria-pressed', 'true'); t.setAttribute('aria-pressed', 'false');
    b.querySelectorAll('.schDay').forEach(el => el.classList.remove('hide'));
  };
  C.hbars(document.getElementById('schCd'),
    CUR.perDay.map(p => ({ label: p.day, value: p.docs.length })), { suffix: ' طبيب' });
  C.hbars(document.getElementById('schCs'),
    CUR.perDay.map(p => ({ label: p.day, value: p.specs.length,
      color: p.specs.length < CUR.stats.specialties * 0.5 ? 'var(--clay)' : 'var(--petrol)' })), { suffix: ' تخصص' });
}

/* ============================================================
   ٢) دليل الأطباء
   ============================================================ */
function dirHtml() {
  const specs = CUR.specialties.map(s => s.spec);
  const grades = [...new Set(CUR.doctors.map(d => d.grade))];
  const list = filtered();
  return `
    <div class="card">
      <h2>دليل الأطباء</h2>
      <div class="note">ابحث بالاسم أو التخصص أو الدرجة العلمية أو الخدمة أو رقم التليفون</div>
      <div class="schFilters">
        <input type="search" id="fq" placeholder="ابحث… (اسم · تخصص · درجة · خدمة · رقم)" value="${esc(ST.q)}" />
        <select id="fspec"><option value="">كل التخصصات</option>
          ${specs.map(s => `<option value="${esc(s)}"${ST.spec === s ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
        <select id="fday"><option value="">كل الأيام</option>
          ${DAYS().map(d => `<option value="${esc(d)}"${ST.day === d ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select>
        <select id="fgrade"><option value="">كل الدرجات</option>
          ${grades.map(g => `<option value="${esc(g)}"${ST.grade === g ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select>
        <select id="fprice"><option value="">كل الأسعار</option>
          <option value="lo"${ST.price === 'lo' ? ' selected' : ''}>حتى 500 جنيه</option>
          <option value="mid"${ST.price === 'mid' ? ' selected' : ''}>501 – 800</option>
          <option value="hi"${ST.price === 'hi' ? ' selected' : ''}>أكثر من 800</option>
          <option value="none"${ST.price === 'none' ? ' selected' : ''}>بلا سعر</option></select>
        <select id="fsort">
          <option value="spec"${ST.sort === 'spec' ? ' selected' : ''}>ترتيب: التخصص</option>
          <option value="name"${ST.sort === 'name' ? ' selected' : ''}>ترتيب: الاسم</option>
          <option value="price"${ST.sort === 'price' ? ' selected' : ''}>ترتيب: السعر</option>
          <option value="days"${ST.sort === 'days' ? ' selected' : ''}>ترتيب: عدد الأيام</option>
          <option value="hours"${ST.sort === 'hours' ? ' selected' : ''}>ترتيب: الساعات</option>
        </select>
        <button class="btn ghost" id="fclear">مسح</button>
      </div>
      <div class="note" id="fcount">${fmt(list.length)} من ${fmt(CUR.doctors.length)} طبيب</div>
    </div>
    <div id="dirList">${dirTable(list)}</div>`;
}
function dirTable(list) {
  if (!list.length) return '<div class="empty"><b>لا نتائج</b>غيّر كلمة البحث أو الفلاتر.</div>';
  return `<div class="card"><div class="tscroll"><table>
    <thead><tr><th>الطبيب</th><th>التخصص</th><th>الدرجة</th><th>خدمات</th>
      <th>سعر الكشف</th><th>الأيام</th><th>المواعيد</th><th>ساعات/أسبوع</th><th>التليفون</th></tr></thead>
    <tbody>${list.map(d => `<tr>
      <td><b>${esc(d.name)}</b>${d.aliases.length ? `<div class="note">أيضاً: ${esc(d.aliases.join('، '))}</div>` : ''}</td>
      <td>${esc(d.specs.join(' · '))}</td>
      <td>${d.grade === 'غير محدّد' ? '<span class="note">غير مذكورة</span>' : esc(d.grade)}</td>
      <td>${d.subs.concat(d.services).length ? esc([...new Set(d.subs.concat(d.services))].join('، ')) : '—'}</td>
      <td class="n">${d.price ? esc(fmt(d.price)) : '—'}</td>
      <td class="n">${fmt(d.dayNames.length)}</td>
      <td style="font-size:12px">${d.days.length
        ? esc(d.days.map(s => s.day.replace('ال', '') + ' ' + (s.label || '—')).join(' · '))
        : (d.onCall ? 'تحت الطلب' : '—')}</td>
      <td class="n">${d.weeklyMin ? (d.weeklyMin / 60).toFixed(1) : '—'}</td>
      <td class="n">${d.phone ? `<a href="tel:${esc(d.phone)}">${esc(d.phone)}</a>` : '—'}</td>
    </tr>`).join('')}</tbody></table></div></div>`;
}
function dirBind() {
  const re = () => {
    const list = filtered();
    document.getElementById('dirList').innerHTML = dirTable(list);
    document.getElementById('fcount').textContent = `${fmt(list.length)} من ${fmt(CUR.doctors.length)} طبيب`;
  };
  const q = document.getElementById('fq');
  q.oninput = () => { ST.q = q.value; re(); };
  [['fspec', 'spec'], ['fday', 'day'], ['fgrade', 'grade'], ['fprice', 'price'], ['fsort', 'sort']]
    .forEach(([id, k]) => { const e = document.getElementById(id); e.onchange = () => { ST[k] = e.value; re(); }; });
  document.getElementById('fclear').onclick = () => {
    ST.q = ''; ST.spec = ''; ST.day = ''; ST.grade = ''; ST.price = ''; ST.sort = 'spec'; body();
  };
}

/* ============================================================
   ٣) لوحة التغطية
   ============================================================ */
function covHtml() {
  const M = CUR.matrix, D = DAYS();
  const worst = CUR.perDay.slice().sort((a, b) => a.specs.length - b.specs.length)[0];
  return `
    <div class="card">
      <h2>مصفوفة التغطية — تخصص × يوم</h2>
      <div class="note">الخانة الفارغة تعني أن المريض اللي بيدوّر على التخصص ده في اليوم ده مش هيلاقي</div>
      <div class="tscroll"><table class="schMatrix">
        <thead><tr><th>التخصص</th>${D.map(d => `<th>${esc(d.replace('ال', ''))}</th>`).join('')}<th>أيام</th></tr></thead>
        <tbody>${M.map(r => {
          const covered = r.cells.filter(c => c.length).length;
          return `<tr>
            <td><b>${esc(r.spec)}</b></td>
            ${r.cells.map(c => c.length
              ? `<td class="cvOn" title="${esc(c.map(x => x.name).join('، '))}">${c.length}</td>`
              : '<td class="cvOff">—</td>').join('')}
            <td class="n ${covered <= 2 ? 'cvBad' : ''}">${covered}</td></tr>`;
        }).join('')}
        <tr class="cvSum"><td><b>إجمالي التخصصات</b></td>
          ${D.map(d => { const p = CUR.perDay.find(x => x.day === d) || { specs: [] };
            return `<td class="n">${p.specs.length}</td>`; }).join('')}
          <td class="n">${fmt(CUR.stats.specialties)}</td></tr>
        </tbody></table></div>
    </div>

    ${CUR.gaps.length ? `<div class="card"><h2>فجوات التغطية</h2>
      <div class="note">تخصصات متاحة يومين أو أقل في الأسبوع</div>
      <div class="tscroll"><table>
        <thead><tr><th>التخصص</th><th>الأطباء</th><th>أيام التوافر</th><th>الأيام الغائبة</th></tr></thead>
        <tbody>${CUR.gaps.map(g => `<tr>
          <td><b>${esc(g.spec)}</b></td><td class="n">${fmt(g.docCount)}</td>
          <td>${esc(g.days.join(' · ')) || '—'}</td>
          <td style="color:var(--clay)">${esc(g.missing.join(' · '))}</td></tr>`).join('')}</tbody>
      </table></div></div>` : ''}

    ${CUR.solo.length ? `<div class="card"><h2>تخصصات بطبيب واحد</h2>
      <div class="note">غياب الطبيب = توقّف التخصص بالكامل</div>
      <div class="tscroll"><table>
        <thead><tr><th>التخصص</th><th>الطبيب</th><th>أيام</th></tr></thead>
        <tbody>${CUR.solo.map(s => `<tr><td><b>${esc(s.spec)}</b></td>
          <td>${esc(s.docs.join('، '))}</td><td class="n">${fmt(s.dayCount)}</td></tr>`).join('')}</tbody>
      </table></div></div>` : ''}

    <div class="grid2">
      <div class="card"><h2>تفاوت السعر داخل التخصص الواحد</h2>
        <div class="note">فارق كبير في نفس التخصص يربك الاستقبال ويفتح باب التفاوض</div>
        <div class="tscroll"><table>
          <thead><tr><th>التخصص</th><th>أقل</th><th>أعلى</th><th>الفارق</th></tr></thead>
          <tbody>${CUR.specialties.filter(s => s.priceSpread > 0)
            .sort((a, b) => b.priceSpread - a.priceSpread)
            .map(s => `<tr><td>${esc(s.spec)}</td><td class="n">${fmt(s.minPrice)}</td>
              <td class="n">${fmt(s.maxPrice)}</td>
              <td class="n" style="color:${s.priceSpread >= 200 ? 'var(--clay)' : 'inherit'}">${fmt(s.priceSpread)}</td></tr>`)
            .join('') || '<tr><td colspan="4" class="note">لا تفاوت.</td></tr>'}</tbody>
        </table></div></div>
      <div class="card"><h2>ملاحظات على الجدول</h2>
        <div class="note">${fmt(CUR.conflicts.length)} ملاحظة — صحّحها في ملف الجدول الأصلي</div>
        <div class="tscroll" style="max-height:340px"><table>
          <thead><tr><th>النوع</th><th>الطبيب</th><th>الملاحظة</th></tr></thead>
          <tbody>${CUR.conflicts.map(c => `<tr><td>${esc(c.type)}</td>
            <td>${esc(c.doctor)}</td><td>${esc(c.detail)}</td></tr>`).join('')}</tbody>
        </table></div></div>
    </div>`;
}
function covBind() {}

/* ============================================================
   ٤) المخطط مقابل الفعلي
   ============================================================ */
function vsHtml() {
  const V = CTX.vs;
  if (!V || !V.hasActual) return `
    <div class="empty"><b>محتاج تقرير أداء مع الجدول</b>
      ارفع مع جدول العيادات أي تقرير فيه نشاط الأطباء —
      بيان الحالة التفصيلي أو إيصالات الاستلام أو أيام عمل الأطباء أو مواعيد الحجز —
      علشان أقارن المخطط بالفعلي.</div>`;
  const R = V.rows;
  const best = R.filter(r => r.perPlannedDay > 0).sort((a, b) => b.perPlannedDay - a.perPlannedDay)[0];
  const sev = st => st === 'مطابق' ? 'low'
                  : (st === 'حاضر بلا إيراد' || st === 'مجدول بلا أي نشاط') ? 'high' : 'medium';
  return `
    <div class="notice">
      <h3>كيف تُقرأ هذه اللوحة</h3>
      <ul>
        <li><span>—</span><div>الفترة المقاسة <b>${fmt(V.spanDays)} يوماً</b> أي نحو <b>${V.weeks.toFixed(1)}</b> أسبوع.</div></li>
        <li><span>—</span><div>«مجدول/أسبوع» من جدول العيادات، و«المتوقّع» = مجدول/أسبوع × عدد الأسابيع، ثم يُقارن بالأيام الفعلية.</div></li>
        <li><span>—</span><div>«الالتزام باليوم» = كم يوماً من أيام الجدول عمل فيها فعلاً — يكشف من يعمل أياماً غير المكتوبة.</div></li>
      </ul>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="lbl">أطباء الجدول</div>
        <div class="val"><span class="num">${fmt(R.length)}</span><span class="unit">طبيب</span></div>
        <div class="foot">${fmt(R.filter(r => r.matched).length)} منهم لهم نشاط فعلي</div></div>
      <div class="kpi k5"><div class="lbl">مجدولون بلا إيراد</div>
        <div class="val"><span class="num">${fmt(V.idle.length)}</span><span class="unit">طبيب</span></div>
        <div class="foot">وقت عيادة محجوز بلا عائد</div></div>
      <div class="kpi k5"><div class="lbl">حضور أقل من نصف المتوقّع</div>
        <div class="val"><span class="num">${fmt(V.under.length)}</span><span class="unit">طبيب</span></div>
        <div class="foot">أيام فعلية دون نصف المخطط</div></div>
      <div class="kpi k6"><div class="lbl">يعملون أكثر من الجدول</div>
        <div class="val"><span class="num">${fmt((V.over || []).length)}</span><span class="unit">طبيب</span></div>
        <div class="foot">الجدول غالباً قديم ويحتاج تحديثاً</div></div>
      <div class="kpi k6"><div class="lbl">أيامهم غير أيام الجدول</div>
        <div class="val"><span class="num">${fmt((V.misfit || []).length)}</span><span class="unit">طبيب</span></div>
        <div class="foot">يحضرون في أيام غير المكتوبة</div></div>
      <div class="kpi k3"><div class="lbl">فجوة السعر</div>
        <div class="val"><span class="num">${fmt(V.priceGaps.length)}</span><span class="unit">طبيب</span></div>
        <div class="foot">المحصّل يبعد عن سعر الجدول أكثر من 15%</div></div>
      <div class="kpi k2"><div class="lbl">أطباء خارج الجدول</div>
        <div class="val"><span class="num">${fmt(V.extra.length)}</span><span class="unit">طبيب</span></div>
        <div class="foot">لهم نشاط ومش مدرجين في جدول العيادات</div></div>
      <div class="kpi k4"><div class="lbl">أعلى عائد ليوم مجدول</div>
        <div class="val"><span class="num">${fmt(best ? best.perPlannedDay : 0)}</span><span class="unit">جنيه</span></div>
        <div class="foot">${esc(best ? best.name : '—')}</div></div>
    </div>

    <div class="card"><h2>المخطط مقابل الفعلي لكل طبيب</h2>
      <div class="note">«عائد اليوم المجدول» = الإيراد ÷ الأيام المتوقّعة من الجدول — الرقم اللي بيقرّر إبقاء العيادة أو تعديل أيامها</div>
      <div class="tscroll"><table>
        <thead><tr><th>الطبيب</th><th>التخصص</th><th>مجدول/أسبوع</th><th>متوقّع</th><th>فعلي</th>
          <th>الالتزام باليوم</th><th>الإيراد</th><th>عائد اليوم المجدول</th>
          <th>سعر الجدول</th><th>السعر الفعلي</th><th>الحالة</th></tr></thead>
        <tbody>${R.map(r => `<tr>
          <td><b>${esc(r.name)}</b>${r.offDays.length
            ? `<div class="note">يحضر أيضاً: ${esc(r.offDays.join('، '))}</div>` : ''}</td>
          <td>${esc(r.spec)}</td>
          <td class="n">${fmt(r.plannedDays)}</td>
          <td class="n">${r.expectedDays ? fmt(r.expectedDays) : '—'}</td>
          <td class="n">${r.matched ? fmt(r.workedDays) : '—'}</td>
          <td class="n">${r.adherence === null ? '—' : `${fmt(r.hitDays.length)}/${fmt(r.plannedDays)}`}</td>
          <td class="n">${r.revenue ? esc(fmt(r.revenue)) : '—'}</td>
          <td class="n">${r.perPlannedDay ? esc(fmt(r.perPlannedDay)) : '—'}</td>
          <td class="n">${r.listPrice ? esc(fmt(r.listPrice)) : '—'}</td>
          <td class="n">${r.actualPrice ? esc(fmt(r.actualPrice)) : '—'}${
            r.priceGap !== null && Math.abs(r.priceGap) > 0.15
              ? ` <span style="color:var(--clay);font-size:11px">${r.priceGap > 0 ? '+' : ''}${pc(r.priceGap)}</span>` : ''}</td>
          <td><span class="tag ${sev(r.status)}">${esc(r.status)}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>

    ${V.extra.length ? `<div class="card"><h2>أطباء يعملون وليسوا في جدول العيادات</h2>
      <div class="note">لهم إيراد أو زيارات في تقارير الأداء لكن لا وجود لهم في الجدول — إما الجدول قديم أو الاسم مكتوب بشكل مختلف</div>
      <div class="tscroll"><table>
        <thead><tr><th>الطبيب</th><th>الإيراد</th><th>الزيارات</th><th>أيام النشاط</th></tr></thead>
        <tbody>${V.extra.map(x => `<tr><td><b>${esc(x.name)}</b></td>
          <td class="n">${esc(fmt(x.revenue))}</td><td class="n">${fmt(x.visits)}</td>
          <td class="n">${fmt(x.days)}</td></tr>`).join('')}</tbody>
      </table></div></div>` : ''}

    <div class="card"><h2>عائد اليوم المجدول</h2>
      <div class="note">الأطباء أصحاب النشاط فقط</div>
      <div id="schVs"></div></div>`;
}
function vsBind() {
  const V = CTX.vs;
  if (!V || !V.hasActual) return;
  const el = document.getElementById('schVs');
  if (!el) return;
  C.hbars(el, V.rows.filter(r => r.perPlannedDay > 0)
    .sort((a, b) => b.perPlannedDay - a.perPlannedDay).slice(0, 15)
    .map(r => ({ label: r.name, value: Math.round(r.perPlannedDay) })), { suffix: ' ج' });
}

/* ============================================================
   تصدير إكسل
   ============================================================ */
function toXlsx() {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const add = (n, rows, w) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = (w || []).map(x => ({ wch: x }));
    XLSX.utils.book_append_sheet(wb, ws, n.slice(0, 31));
  };
  const D = DAYS();
  const list = filtered();

  add('دليل الأطباء', [
    ['الطبيب', 'التخصص', 'الدرجة', 'خدمات', 'سعر الكشف', 'عدد الأيام', 'الأيام', 'المواعيد', 'ساعات/أسبوع', 'التليفون'],
    ...list.map(d => [d.name, d.specs.join(' · '), d.grade,
      [...new Set(d.subs.concat(d.services))].join('، '), d.price || '',
      d.dayNames.length, d.dayNames.join(' · '),
      d.days.map(s => s.day + ' ' + (s.label || '')).join(' · '),
      d.weeklyMin ? +(d.weeklyMin / 60).toFixed(1) : '', d.phone])
  ], [26, 22, 12, 26, 11, 9, 34, 46, 12, 14]);

  add('بورد الأسبوع', [
    ['اليوم', 'الطبيب', 'التخصص', 'الدرجة', 'المواعيد', 'سعر الكشف', 'التليفون'],
    ...D.flatMap(day => (CUR.perDay.find(p => p.day === day) || { docs: [] }).docs.map(d => {
      const s = d.days.find(x => x.day === day) || {};
      return [day, d.name, d.spec, d.grade, s.label || '', d.price || '', d.phone];
    }))
  ], [12, 26, 20, 12, 20, 11, 14]);

  add('التغطية', [
    ['التخصص', ...D, 'أيام التغطية', 'أقل سعر', 'أعلى سعر'],
    ...CUR.matrix.map(r => {
      const s = CUR.specialties.find(x => x.spec === r.spec) || {};
      return [r.spec, ...r.cells.map(c => c.length || ''), r.cells.filter(c => c.length).length,
              s.minPrice || '', s.maxPrice || ''];
    })
  ], [22, 8, 8, 8, 8, 8, 8, 8, 13, 10, 10]);

  add('ملاحظات على الجدول', [['النوع', 'الطبيب', 'الملاحظة'],
    ...CUR.conflicts.map(c => [c.type, c.doctor, c.detail])], [12, 26, 70]);

  const V = CTX.vs;
  if (V && V.hasActual) {
    add('المخطط مقابل الفعلي', [
      ['الطبيب', 'التخصص', 'مجدول/أسبوع', 'أيام متوقّعة', 'أيام فعلية', 'التزام باليوم',
       'أيام إضافية', 'الإيراد', 'عائد اليوم المجدول', 'سعر الجدول', 'السعر الفعلي', 'الحالة'],
      ...V.rows.map(r => [r.name, r.spec, r.plannedDays, r.expectedDays || '',
        r.matched ? r.workedDays : '', r.adherence === null ? '' : r.hitDays.length + '/' + r.plannedDays,
        r.offDays.join('، '), Math.round(r.revenue), Math.round(r.perPlannedDay),
        r.listPrice || '', Math.round(r.actualPrice) || '', r.status])
    ], [26, 20, 12, 12, 11, 13, 22, 13, 18, 12, 12, 26]);
    if (V.extra.length) add('أطباء خارج الجدول', [['الطبيب', 'الإيراد', 'الزيارات', 'أيام النشاط'],
      ...V.extra.map(x => [x.name, Math.round(x.revenue), x.visits, x.days])], [26, 13, 11, 12]);
  }
  const st = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `جدول-العيادات-سونو-${st}.xlsx`, { compression: true });
}

root.SonoRenderSchedule = { render, toXlsx, state: ST };
})(window);
