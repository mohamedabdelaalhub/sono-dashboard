const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),XLSX=require('xlsx');
(async()=>{
const base=path.resolve(__dirname,'..'),dom=new JSDOM('<body><div id="report"></div><div id="kpi"></div></body>',{url:'https://test.invalid',runScripts:'outside-only'}),w=dom.window;
for(const n of ['parser','charts','roles','privacy','reports','insights','analytics','rules','render','render-reports','exporters'])w.eval(fs.readFileSync(base+'/assets/js/'+n+'.js','utf8'));
let user={role:'محاسب'},saved;
w.SonoAuth={user:()=>user};w.XLSX={...XLSX,writeFile:(wb,name)=>{saved={wb,name}}};
const row={date:'2026-09-01',doctor:'طبيب',service:'كشف',qty:1,price:100,discount:20,total:80,patient:'اسم للاختبار',fileNo:'F-123',phone:'PRIVATEPHONE'};
w.SonoApp={state:{activeDatasets:[{id:'statusDetail',rows:[row]}],ctx:{}}};
const I=w.SonoInsights.build([{id:'statusDetail',name:'بيان',rows:[row]}],{}),A={ins:I};
assert(!JSON.stringify(I).includes('اسم للاختبار'));assert(!JSON.stringify(I).includes('F-123'));
w.document.getElementById('report').innerHTML=w.SonoRender.insHtml(A);w.SonoRender.insDraw(A);
assert(w.document.querySelector('[data-table-export="xlsx"]'));
w.document.querySelector('.detailLink').click();let box=w.document.getElementById('financialDetailModal');assert(box.textContent.includes('اسم للاختبار'));assert(box.textContent.includes('F-123'));assert(!box.textContent.includes('PRIVATEPHONE'));
await w.SonoExport.tableExport(box.querySelector('table'),'التفاصيل','xlsx');const data=XLSX.utils.sheet_to_json(saved.wb.Sheets['التفاصيل'],{header:1});assert(JSON.stringify(data).includes('اسم للاختبار'));assert(saved.name.endsWith('.xlsx'));
const pdfCalls=[];w.jspdf={jsPDF:class{constructor(){this.internal={pageSize:{getWidth:()=>297,getHeight:()=>210}}}addImage(){}addPage(){}setFontSize(){}setTextColor(){}text(){}save(name){pdfCalls.push(name)}}};w.html2canvas=async host=>{assert(host.textContent.includes('اسم للاختبار'));return {width:100,height:100,toDataURL:()=> 'data:image/png;base64,AA==',getContext:()=>({drawImage(){}})}};
w.HTMLCanvasElement.prototype.getContext=function(){return {fillRect(){},drawImage(){}}};
w.HTMLCanvasElement.prototype.toDataURL=function(){return 'data:image/jpeg;base64,AA=='};
await w.SonoExport.tableExport(box.querySelector('table'),'التفاصيل','pdf');assert.equal(pdfCalls[0],'التفاصيل.pdf');assert(!w.document.querySelector('.pdf-capture'));
// Verify the modal button uses the same scoped table.
let pdfHandOff=false;const original=w.SonoExport.tableExport;w.SonoExport.tableExport=async(table,title,kind)=>{if(kind==='pdf'){pdfHandOff=true;assert(table.textContent.includes('اسم للاختبار'));}else return original(table,title,kind)};
box.querySelector('[data-table-export="pdf"]').click();await Promise.resolve();assert(pdfHandOff);
user={role:'مستخدم'};box.remove();w.document.querySelector('.detailLink').click();box=w.document.getElementById('financialDetailModal');assert(!box.textContent.includes('اسم للاختبار'));assert(!box.querySelector('[data-table-export]'));assert(!w.SonoPrivacy.displayColumns(['patient','fileNo','total']).includes('patient'));await assert.rejects(()=>original(box.querySelector('table'),'تقرير','xlsx'));
const AA=w.SonoAnalytics.analyze([{date:'2026-09-01',amount:80,receipt:'1',services:['كشف'],_financialKind:'statusDetail'}],[],{}),E=w.SonoRules.evaluate(AA,null);w.SonoRender.renderKpi(w.document.getElementById('kpi'),AA,E,null);assert(!w.document.getElementById('kpi').textContent.includes('span'));assert(!w.document.getElementById('kpi').textContent.includes('class='));assert(w.document.querySelector('#kpi .kpi .val .unavailable'));
dom.window.close();console.log('PASS patient names/file numbers by role, anonymized analytics, Excel content, PDF handoff, export permission and unavailable badges without HTML leakage');
})().catch(e=>{console.error(e);process.exit(1)});
