const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..'),dom=new JSDOM('<body><div id="report"></div><div id="risks"></div></body>',{url:'https://test.invalid',runScripts:'outside-only'}),w=dom.window;
for(const n of ['charts','insights','render'])w.eval(fs.readFileSync(base+'/assets/js/'+n+'.js','utf8'));
const rows=[{date:'2026-09-01',doctor:'',service:'جلسة',qty:1,price:100,discount:100,total:0,patient:'PRIVATE',fileNo:'PRIVATE',channel:'',insurer:'جهة'}, {date:'2026-09-02',doctor:'',service:'كشف',qty:1,price:200,discount:0,total:200,channel:'',insurer:'جهة'}, {date:'2026-09-03',doctor:'طبيب',service:'كشف',qty:1,price:100,discount:20,total:80}];
// Exercise the report registry through the public analysis entry point.
for(const n of ['reports'])w.eval(fs.readFileSync(base+'/assets/js/'+n+'.js','utf8'));
const I=w.SonoInsights.build([{id:'statusDetail',name:'بيان',rows}],{});
const A={ins:I};w.document.getElementById('report').innerHTML=w.SonoRender.insHtml(A);w.SonoRender.insDraw(A);
const button=[...w.document.querySelectorAll('.detailLink')].find(b=>b.dataset.tbl==='0' && b.textContent==='غير محدّد');assert(button);button.click();
let box=w.document.getElementById('financialDetailModal');assert.equal(box.querySelectorAll('tbody tr').length,1);assert(box.textContent.includes('جلسة'));assert(!box.textContent.includes('PRIVATE'));box.querySelector('[data-close]').click();assert(!w.document.getElementById('financialDetailModal'));
const revenue=[...w.document.querySelectorAll('.detailLink')].find(b=>b.dataset.tbl==='2');assert(revenue);revenue.click();box=w.document.getElementById('financialDetailModal');assert.equal(box.querySelectorAll('tbody tr').length,2);
w.SonoRender.renderRisks(w.document.getElementById('risks'),{}, {risks:[{area:'الحوكمة',title:'عنوان',finding:'التفاصيل',sev:'low',sevAr:'منخفضة'}]});assert.equal(w.document.querySelectorAll('.riskGroup[open] .risk').length,1);assert(w.document.querySelector('.riskGroup').textContent.includes('التفاصيل'));
const index=fs.readFileSync(base+'/index.html','utf8'),order=[...index.matchAll(/role="tab" data-t="(\w+)"/g)].map(m=>m[1]);assert.equal(order[0],'rep');assert.equal(order[order.indexOf('risk')-1],'data');
dom.window.close();console.log('PASS discount-only and revenue drill-downs, unknown doctors, privacy, risk sections and tab order');
