/* «الإيراد اليومي»: ورقة واحدة بجداول متجاورة. الاختبار يستعمل ورقة اصطناعية بنفس تخطيط الأعمدة
   (لا بيانات مرضى ولا ملفات حقيقية). */
const {JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..');

/* ---------- الورقة الاصطناعية ---------- */
function sheet(opts){
  opts=opts||{};
  const rows=[];const put=(r,c,v)=>{(rows[r]=rows[r]||[]);rows[r][c]=v;};
  put(1,34,'مركز عيادات تجريبي');put(2,6,'تقرير الايراد اليومى');
  put(5,12,'الفرع');put(5,16,'٣۰/۰٩/۲۰۲٦‎');put(5,29,'إلى');put(5,39,'من');put(6,32,'۰۱/۰٩/۲۰۲٦‎');
  const payHead=r=>{put(r,1,'الصافى');put(r,7,'المصروفات');put(r,13,'الرسوم شاملة الضريبة');put(r,18,'الايراد');put(r,26,'طريقة الدفع');put(r,37,'م');};
  payHead(10);[ -200,700,0,500,'نقدي',1].forEach((v,i)=>put(11,[1,7,13,18,26,37][i],v));put(12,26,'الاجمالى');
  payHead(15);[300,0,0,300,'فيزا',1].forEach((v,i)=>put(16,[1,7,13,18,26,37][i],v));put(17,26,'الاجمالى');
  const kv=(r,v,l,vc,lc)=>{put(r,vc||25,v);put(r,lc||35,l);};
  kv(24,800,'اجمالى الايرادات');kv(25,'300.00','اجمالى الائتمان والحوالات البنكية',2,11);kv(27,0,'اجمالى الرسوم شاملة الضريبة');
  kv(29,opts.expenseTotal||700,'اجمالى المصروفات');kv(31,100,'الصافى');kv(33,'50.0000','رصيد ما قبله');kv(35,150,'الرصيد الحالى');
  /* الخدمات: تتخلّلها صفوف ملخص في أعمدة أخرى */
  put(30,2,'تكلفة الخدمات');put(30,4,'القيمة');put(30,9,'الخدمة');put(30,19,'م');
  [[32,400,'كشف استشارى'],[34,250,'سونار'],[37,100,'CBC.']].forEach(([r,v,n],i)=>{put(r,2,0);put(r,4,v);put(r,9,n);put(r,19,i+1);});
  put(40,2,0);put(40,4,750);put(40,9,'الاجمالى');
  /* المصروفات والأطباء على الصفوف نفسها */
  const h=60;[[1,'الملاحظات'],[5,'القيمة'],[8,'المصروف'],[14,'الطريقة'],[17,'م'],[22,'نسبة الدكتور'],[27,'القيمة المحصلة'],[33,'عدد الحالات'],[36,'الدكتور'],[40,'م']].forEach(([c,v])=>put(h,c,v));
  [['اتعاب د / سارة',300,'حالة منى سالم'],['م . مرتبات - عمومية',250,''],['اطباء الطوارئ',100,'حالة ياسر'],['حساب فيزيتا',50,'حالة نور']]
    .forEach(([it,v,n],i)=>{put(h+1+i,1,n);put(h+1+i,5,v);put(h+1+i,8,it);put(h+1+i,14,'نقدي');put(h+1+i,17,i+1);});
  put(h+1,22,200);put(h+1,27,500);put(h+1,33,5);put(h+1,36,'د/ سارة ( استشاري )');put(h+1,40,1);
  put(h+2,22,0);put(h+2,27,250);put(h+2,33,3);put(h+2,36,'المعمل');put(h+2,40,2);
  put(h+3,22,200);put(h+3,27,750);put(h+3,33,8);put(h+3,36,'الاجمالى');
  return rows.map(r=>r?Array.from(r,v=>v===undefined?null:v):[]);
}

const ctx={window:{},console};vm.createContext(ctx);
for(const f of ['parser','analytics','reports','parser-auto','adapters','data-integrity','privacy','insights','rules','exporters'])vm.runInContext(fs.readFileSync(base+'/assets/js/'+f+'.js','utf8'),ctx,{filename:f});
const W=ctx.window;ctx.XLSX={utils:{sheet_to_json:s=>s,book_new:()=>({SheetNames:[],Sheets:{}}),aoa_to_sheet:rows=>({rows}),book_append_sheet:(wb,ws,n)=>{wb.SheetNames.push(n);wb.Sheets[n]=ws}},writeFile(wb){ctx.output=wb}};
const parse=rows=>W.SonoAuto.parseAll({SheetNames:['s'],Sheets:{s:rows}},'DailyRevenueReport.xlsx');
const sum=(a,f)=>a.reduce((s,r)=>s+f(r),0),iso=d=>W.SonoParser.iso(d);

/* التواريخ بأرقام هندية/فارسية وعلامات اتجاه */
assert.equal(iso(W.SonoParser.parseDate('٣۰/۰٩/۲۰۲٦‎')),'2026-09-30');
assert.equal(iso(W.SonoParser.parseDate('٠١/٠٩/٢٠٢٦')),'2026-09-01');

/* القراءة */
const [ds,...more]=parse(sheet());assert.equal(more.length,0);assert.equal(ds.id,'dailyRevenue');
assert.equal(iso(ds.period.from),'2026-09-01');assert.equal(iso(ds.period.to),'2026-09-30');
assert.equal(ds.rows.length,2);assert.equal(sum(ds.rows,r=>r.revenue),800);
const sec=ds.sections;
assert.equal(sec.services.length,3);assert.equal(sum(sec.services,x=>x.value),750);assert.equal(sec.servicesTotal.value,750);
assert.equal(sec.doctors.length,2);assert.equal(sec.doctorsTotal.cases,8);assert.equal(sec.doctorsTotal.collected,750);assert(sec.doctors.find(d=>d.name==='المعمل').dept);
assert.equal(sec.expenses.length,4);assert.equal(sum(sec.expenses,x=>x.amount),700);
assert.deepEqual({...sec.summary},{revenueTotal:800,bankTotal:300,feesTotal:0,expenseTotal:700,net:100,opening:50,closing:150});
/* الملاحظات تحمل أسماء مرضى: لا تدخل المخرجات أبداً */
assert(!JSON.stringify(sec).match(/منى|ياسر|نور/));

/* التحويل: الإيراد من جدول الدفع، والمصروف بالبند وبلا «غير مصنّف» */
const ad=W.SonoAdapters.apply([ds]);
assert.equal(sum(ad.income,r=>r.amount),800);assert.equal(ad.expense.length,4);assert.equal(sum(ad.expense,r=>r.amount),700);
assert(ad.expense.every(r=>r.cat!=='غير مصنّف'),JSON.stringify(ad.expense.map(r=>[r.bayan,r.cat])));
assert(ad.income.every(r=>r.date===null)&&ad.expense.every(r=>r.date===null));
assert(!JSON.stringify(ad).match(/منى|ياسر|نور/));
assert.equal(ad.expense.find(r=>r.bayan==='حساب فيزيتا').cat,'عمولات منصات الحجز');
assert.equal(ad.expense.find(r=>r.bayan==='اطباء الطوارئ').doctor,'أطباء الطوارئ (مجمّع)');
assert.equal(ad.expense.find(r=>r.bayan==='اتعاب د / سارة').doctor,'سارة');

/* لو لم يطابق مجموع البنود الإجمالي المعلن: لا نخمّن — سطر واحد غير مصنّف */
const [bad]=parse(sheet({expenseTotal:999}));const adBad=W.SonoAdapters.apply([bad]);
assert.equal(adBad.expense.length,1);assert.equal(adBad.expense[0].amount,700);assert.equal(adBad.expense[0].cat,'غير مصنّف');

/* التحليل عبر مسار التطبيق: دمج → تحليل → قواعد */
const merged=W.SonoDataIntegrity.mergeSources(ad.sources);
const A=W.SonoAnalytics.analyze(merged.income,merged.expense,{});
A.ins=W.SonoPrivacy.insights(W.SonoInsights.build([ds],{}));
const E=W.SonoRules.evaluate(A,null);
assert.equal(A.kpi.revenue,800);assert.equal(A.kpi.cost,700);assert.equal(A.kpi.net,100);assert.equal(A.kpi.doctorFees,400);
assert.equal(A.meta.spanDays,30);assert.equal(A.meta.rangeLabel.includes('2026'),true);
assert.equal(A.coverage.kind,'dailyRevenue');['services','patients','doctors','supplies','days'].forEach(k=>assert.equal(A.coverage[k],false));
['patients','avgTicket','avgPerPatient','repeatRate','topServiceShare','cv'].forEach(k=>assert.equal(A.kpi[k],null,k));
const ids=E.risks.map(r=>r.id);
['serviceConc','catConc','retention','ticket','supplies','weakDays','volatility','unclassified'].forEach(id=>assert(!ids.includes(id),'خطر كاذب: '+id));
/* تقدير الأثر: لا يشمل الحوكمة ولا يكرّر المجال الواحد */
const byArea={};E.risks.forEach(r=>{if(r.area!=='الحوكمة')byArea[r.area]=Math.max(byArea[r.area]||0,r.impact||0);});
assert.equal(E.upside,Object.values(byArea).reduce((s,v)=>s+v,0));
assert(E.upside<=sum(E.risks,r=>r.impact||0));

/* مراجعة الأرقام الداخلية */
const mod=A.ins.modules[0],check=mod.tables.find(t=>t.title==='مراجعة الأرقام داخل التقرير');
const row=label=>check.rows.find(r=>r[0].includes(label));
assert.equal(row('مجموع طرق الدفع')[4],'مطابق');assert.equal(row('مجموع سطور المصروفات')[4],'مطابق');assert.equal(row('الرصيد السابق')[4],'مطابق');
assert.equal(row('إيراد طرق الدفع = إيراد الخدمات')[4],'فرق — راجع');   /* 800 مقابل 750 */
assert(mod.risks.some(r=>r.id==='ins_revGap'));
assert(mod.kpis.find(k=>k.lbl==='عدد الحالات').val==='8');
assert(!JSON.stringify(mod).match(/NaN|Infinity|undefined/));

/* العرض: لا انهيار على المؤشرات الفارغة ولا نصوص «null/NaN» */
const dom=new JSDOM('<body><div id="summary"></div><div id="kpi"></div><div id="data"></div><div id="risk"></div><div id="tip"></div></body>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;
w.XLSX=ctx.XLSX;
for(const n of ['parser','analytics','reports','parser-auto','adapters','data-integrity','privacy','insights','rules','charts','render'])w.eval(fs.readFileSync(base+'/assets/js/'+n+'.js','utf8'));
const ds2=w.SonoAuto.parseAll({SheetNames:['s'],Sheets:{s:sheet()}},'x.xlsx'),m2=w.SonoDataIntegrity.mergeSources(w.SonoAdapters.apply(ds2).sources);
const A2=w.SonoAnalytics.analyze(m2.income,m2.expense,{});A2.ins=w.SonoPrivacy.insights(w.SonoInsights.build(ds2,{}));const E2=w.SonoRules.evaluate(A2,null);
w.SonoRender.renderSummary(w.document.getElementById('summary'),A2,E2,null);w.SonoRender.renderKpi(w.document.getElementById('kpi'),A2,E2,null);
w.SonoRender.renderData(w.document.getElementById('data'),A2,E2,null);w.SonoRender.renderRisks(w.document.getElementById('risk'),A2,E2,null);
const body=w.document.body.textContent;['NaN','Infinity','undefined','null'].forEach(t=>assert(!body.includes(t),'نص ظاهر: '+t));
const cards=[...w.document.querySelectorAll('#kpi .kpi')];
['عدد المرضى','متوسط الإيصال','المرضى المتكررون','بنود الخدمة','التذبذب اليومي'].forEach(l=>assert(cards.find(c=>c.querySelector('.lbl').textContent===l).querySelector('.val').textContent.includes('غير متاح'),l));
assert(w.document.getElementById('summary').textContent.includes('عدد المرضى والإيصالات غير متاح'));
dom.window.close();

/* التصدير */
assert.doesNotThrow(()=>W.SonoExport.toXlsx(A,E,{clinic:'test',branch:'test'},[ds]));assert(ctx.output.SheetNames.includes('الملخص'));
console.log('PASS daily revenue: multi-table reading, Arabic-digit period, itemized expenses, reconciliation checks, unavailable-not-zero coverage, de-duplicated impact estimate, null-safe rendering and export');
